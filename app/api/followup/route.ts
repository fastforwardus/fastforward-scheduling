import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, users, followUpSequences, remindersLog } from "@/db/schema";
import { and, eq, lte, isNull } from "drizzle-orm";
import { Resend } from "resend";
import Anthropic from "@anthropic-ai/sdk";

const resend  = new Resend(process.env.RESEND_API_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SERVICE_LABELS: Record<string, string> = {
  fda_fsma:         "FDA / FSMA compliance",
  register_company: "formacion de LLC en EE.UU.",
  market_entry:     "ingreso al mercado americano",
  not_sure:         "asesoria general",
};

async function generateFollowUpEmail(params: {
  clientName: string;
  clientCompany: string;
  serviceInterest: string;
  scheduledAt: Date;
  repName: string;
  step: 1 | 3 | 7;
  lang: string;
}): Promise<string> {
  const { clientName, clientCompany, serviceInterest, scheduledAt, repName, step, lang } = params;

  const dateStr = scheduledAt.toLocaleDateString(
    lang === "pt" ? "pt-BR" : lang === "en" ? "en-US" : "es-ES",
    { day: "numeric", month: "long", year: "numeric" }
  );

  const serviceLabel = SERVICE_LABELS[serviceInterest] || serviceInterest;

  const prompts: Record<string, string> = {
    es: `Eres el asistente de FastForward LLC, consultora de Miami especializada en FDA compliance y entrada al mercado de EE.UU. para empresas exportadoras.
Genera un email de seguimiento en español neutro (sin regionalismos) para ${clientName} de ${clientCompany}, quien agendó una consulta sobre ${serviceLabel} el ${dateStr} con ${repName}.
Es el seguimiento del día ${step} después de la consulta.
${step === 1 ? "Email de agradecimiento y valor agregado." : step === 3 ? "Email con recurso de valor y recordatorio suave." : "Email de cierre preguntando si pudieron avanzar."}
Profesional, cálido, máximo 100 palabras, un solo CTA para re-agendar en https://scheduling.fastfwdus.com/book. Sin emojis. Sin asunto. Solo el cuerpo del email en HTML simple (p, strong, a tags solamente). Firma: ${repName} | FastForward FDA Experts`,

    en: `You are the assistant of FastForward LLC, a Miami-based consultancy specializing in FDA compliance and US market entry for exporting companies.
Write a follow-up email in professional English for ${clientName} from ${clientCompany}, who had a consultation about ${serviceLabel} on ${dateStr} with ${repName}.
This is day ${step} follow-up.
${step === 1 ? "Thank you email with added value." : step === 3 ? "Value resource email with gentle reminder." : "Closing email asking if they were able to move forward."}
Professional, warm, maximum 100 words, one CTA to reschedule at https://scheduling.fastfwdus.com/book. No emojis. No subject line. Only email body in simple HTML (p, strong, a tags only). Signature: ${repName} | FastForward FDA Experts`,

    pt: `Voce e o assistente da FastForward LLC, consultoria de Miami especializada em conformidade FDA e entrada no mercado dos EUA para empresas exportadoras.
Escreva um email de acompanhamento em portugues profissional para ${clientName} da ${clientCompany}, que agendou uma consulta sobre ${serviceLabel} em ${dateStr} com ${repName}.
Este e o acompanhamento do dia ${step}.
${step === 1 ? "Email de agradecimento com valor agregado." : step === 3 ? "Email com recurso de valor e lembrete suave." : "Email de encerramento perguntando se conseguiram avançar."}
Profissional, caloroso, maximo 100 palavras, um CTA para reagendar em https://scheduling.fastfwdus.com/book. Sem emojis. Sem assunto. Apenas o corpo do email em HTML simples (tags p, strong, a apenas). Assinatura: ${repName} | FastForward FDA Experts`,
  };

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 400,
    messages: [{ role: "user", content: prompts[lang] || prompts.es }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  // Strip markdown code fences if AI wraps in ```html ... ```
  const text = raw.replace(/^```(?:html)?\n?/i, "").replace(/\n?```$/i, "").trim();
  return text;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const results = { processed: 0, sent: 0, errors: 0 };

  // Buscar secuencias activas con nextSendAt <= now
  const sequences = await db
    .select()
    .from(followUpSequences)
    .where(
      and(
        eq(followUpSequences.isActive, true),
        lte(followUpSequences.nextSendAt, now),
        isNull(followUpSequences.completedAt),
      )
    );

  for (const seq of sequences) {
    const [appt] = await db
      .select({
        id: appointments.id,
        clientName: appointments.clientName,
        clientEmail: appointments.clientEmail,
        clientCompany: appointments.clientCompany,
        clientLanguage: appointments.clientLanguage,
        clientWhatsapp: appointments.clientWhatsapp,
        serviceInterest: appointments.serviceInterest,
        scheduledAt: appointments.scheduledAt,
        outcome: appointments.outcome,
        assignedTo: appointments.assignedTo,
        status: appointments.status,
      })
      .from(appointments)
      .where(eq(appointments.id, seq.appointmentId))
      .limit(1);

    if (!appt) continue;

    // No hacer follow-up si fue closed o not_qualified
    if (appt.outcome === "closed" || appt.outcome === "not_qualified") {
      await db.update(followUpSequences)
        .set({ isActive: false, completedAt: now })
        .where(eq(followUpSequences.id, seq.id));
      continue;
    }

    let repName = "El equipo de FastForward";
    if (appt.assignedTo) {
      const [rep] = await db.select({ fullName: users.fullName })
        .from(users).where(eq(users.id, appt.assignedTo)).limit(1);
      if (rep) repName = rep.fullName;
    }

    // Detectar idioma
    let lang = appt.clientLanguage || "es";
    if (!appt.clientLanguage && appt.clientWhatsapp) {
      const phone = appt.clientWhatsapp.replace(/\D/g, "");
      if (phone.startsWith("55") || phone.startsWith("351")) lang = "pt";
      else if (phone.startsWith("1") && phone.length === 11) lang = "en";
    }

    const rawStep = seq.currentStep + 1;
    const stepDay = rawStep === 0 ? 1 : rawStep === 1 ? 3 : 7;

    const subjects: Record<string, Record<number, string>> = {
      es: { 1: `Gracias por su tiempo, ${appt.clientName}`, 3: "Un recurso que puede ayudarle", 7: "¿Cómo avanza su proyecto?" },
      en: { 1: `Thank you for your time, ${appt.clientName}`, 3: "A resource that might help you", 7: "How is your project moving forward?" },
      pt: { 1: `Obrigado pelo seu tempo, ${appt.clientName}`, 3: "Um recurso que pode ajudá-lo", 7: "Como está avançando o seu projeto?" },
    };

    try {
      // Generar draft con IA
      const emailBody = await generateFollowUpEmail({
        clientName: appt.clientName,
        clientCompany: appt.clientCompany,
        serviceInterest: appt.serviceInterest || "asesoria general",
        scheduledAt: new Date(appt.scheduledAt),
        repName,
        step: (stepDay as 1 | 3 | 7),
        lang,
      });

      // Guardar draft en la secuencia
      const draftField: "aiDraftD1" | "aiDraftD3" | "aiDraftD7" = stepDay === 1 ? "aiDraftD1" : stepDay === 3 ? "aiDraftD3" : "aiDraftD7";
      await db.update(followUpSequences)
        .set({ [draftField]: emailBody })
        .where(eq(followUpSequences.id, seq.id));

      const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F8F9FB;font-family:system-ui,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
<tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="background:#27295C;border-radius:16px 16px 0 0;padding:24px 32px;text-align:center;">
  <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="32" alt="FastForward">
</td></tr>
<tr><td style="background:white;padding:32px;border-radius:0 0 16px 16px;border:1px solid #E5E7EB;border-top:none;">
  ${emailBody}
  <div style="margin-top:24px;padding-top:20px;border-top:1px solid #F0F0F0;text-align:center;">
    <p style="font-size:12px;color:#9CA3AF;margin:0;">FastForward FDA Experts · Miami, FL</p>
    <a href="https://fastfwdus.com" style="font-size:12px;color:#C9A84C;text-decoration:none;">fastfwdus.com</a>
  </div>
</td></tr>
</table></td></tr>
</table></body></html>`;

      await resend.emails.send({
        from: "FastForward FDA Experts <noreply@fastfwdus.com>",
        to: appt.clientEmail,
        subject: (subjects[lang] || subjects.es)[stepDay] || subjects.es[1],
        html,
      });

      await db.insert(remindersLog).values({
        appointmentId: appt.id,
        type: stepDay === 1 ? "followup_d1" : stepDay === 3 ? "followup_d3" : "followup_d7",
        channel: "email",
        sentAt: now,
        status: "sent",
      });

      // Calcular siguiente envio o completar secuencia
      let nextSendAt: Date | null = null;
      const newStep = rawStep;

      if (newStep === 1) {
        nextSendAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // dia 3
      } else if (newStep === 2) {
        nextSendAt = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000); // dia 7
      }

      if (newStep >= 3 || !nextSendAt) {
        await db.update(followUpSequences)
          .set({ currentStep: newStep, isActive: false, completedAt: now, nextSendAt: null })
          .where(eq(followUpSequences.id, seq.id));
      } else {
        await db.update(followUpSequences)
          .set({ currentStep: newStep, nextSendAt })
          .where(eq(followUpSequences.id, seq.id));
      }

      results.sent++;
    } catch (err) {
      console.error("Follow-up error:", err);
      await db.insert(remindersLog).values({
        appointmentId: appt.id,
        type: "followup_d1",
        channel: "email",
        sentAt: now,
        status: "failed",
        errorMessage: String(err),
      }).catch(() => {});
      results.errors++;
    }

    results.processed++;
  }

  return NextResponse.json({ ok: true, ...results, timestamp: now.toISOString() });
}
