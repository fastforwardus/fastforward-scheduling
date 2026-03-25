export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments } from "@/db/schema";
import { and, eq, lte, isNull, or } from "drizzle-orm";
import { Resend } from "resend";
import Anthropic from "@anthropic-ai/sdk";

const resend = new Resend(process.env.RESEND_API_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

  // Leads with "needs_time" outcome, no followup in 10+ days, not closed
  const leads = await db.select({
    id: appointments.id,
    clientName: appointments.clientName,
    clientEmail: appointments.clientEmail,
    clientCompany: appointments.clientCompany,
    clientLanguage: appointments.clientLanguage,
    serviceInterest: appointments.serviceInterest,
    exportVolume: appointments.exportVolume,
    notes: appointments.notes,
    assignedTo: appointments.assignedTo,
  }).from(appointments)
    .where(
      and(
        eq(appointments.outcome, "needs_time"),
        lte(appointments.createdAt, tenDaysAgo),
        or(
          isNull(appointments.almostClosedSentAt),
        )
      )
    )
    .limit(20);

  let sent = 0;

  for (const lead of leads) {
    const firstName = lead.clientName.split(" ")[0];
    const lang = lead.clientLanguage || "es";

    const SERVICE_LABELS: Record<string, string> = {
      fda_fsma: "FDA / FSMA Compliance",
      register_company: "apertura de LLC en EE.UU.",
      not_sure: "asesoría en el mercado americano",
    };
    const serviceLabel = SERVICE_LABELS[lead.serviceInterest || ""] || "nuestros servicios";

    const prompt = lang === "en"
      ? `Write a short, warm follow-up email in English for ${firstName} from ${lead.clientCompany}. They were interested in ${serviceLabel} but needed time to think. It's been 10+ days. Be friendly, not pushy. Mention a subtle incentive (free consultation, quick process). Max 80 words. HTML with <p> tags only. Sign: FastForward FDA Experts Team`
      : lang === "pt"
      ? `Escreva um email de acompanhamento curto e caloroso em português para ${firstName} da ${lead.clientCompany}. Eles estavam interessados em ${serviceLabel} mas precisavam de tempo. Já faz 10+ dias. Seja amigável, sem pressão. Mencione um incentivo sutil. Max 80 palavras. HTML com tags <p> apenas. Assine: Equipe FastForward FDA Experts`
      : `Escribí un email de seguimiento corto y cálido en español para ${firstName} de ${lead.clientCompany}. Estaban interesados en ${serviceLabel} pero necesitaban tiempo para pensar. Ya pasaron 10+ días. Sé amigable, sin presión. Mencioná un incentivo sutil (consulta rápida, proceso ágil). Máx 80 palabras. HTML con tags <p> solo. Firma: Equipo FastForward FDA Experts`;

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const emailBody = msg.content[0].type === "text" ? msg.content[0].text : "";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";

    const subject = lang === "en"
      ? `${firstName}, still thinking about entering the US market?`
      : lang === "pt"
      ? `${firstName}, ainda pensando em entrar no mercado americano?`
      : `${firstName}, ¿todavía estás pensando en ingresar al mercado americano?`;

    const ctaText = lang === "en" ? "Schedule free consultation →"
      : lang === "pt" ? "Agendar consulta gratuita →"
      : "Agendar consulta gratuita →";

    await resend.emails.send({
      from: "Carlos Bisio — FastForward <info@fastfwdus.com>",
      replyTo: "info@fastfwdus.com",
      to: lead.clientEmail,
      subject,
      html: `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  <div style="background:#27295C;border-radius:16px 16px 0 0;padding:28px;text-align:center;">
    <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="32" alt="FastForward">
  </div>
  <div style="background:white;border-radius:0 0 16px 16px;padding:32px;border:1px solid #E5E7EB;border-top:none;">
    ${emailBody}
    <a href="${appUrl}/book" style="display:block;text-align:center;background:#C9A84C;color:#1A1C3E;padding:14px;border-radius:10px;font-weight:700;text-decoration:none;margin-top:20px;">
      ${ctaText}
    </a>
    <div style="border-top:1px solid #F0F0F0;padding-top:16px;margin-top:20px;text-align:center;">
      <p style="font-size:11px;color:#9CA3AF;margin:0;">FastForward Trading Company LLC · Miami, FL</p>
    </div>
  </div>
</div>`,
    });

    // Mark as sent to avoid duplicates
    await db.update(appointments)
      .set({ almostClosedSentAt: new Date() })
      .where(eq(appointments.id, lead.id));

    sent++;
  }

  return NextResponse.json({ ok: true, sent, checked: leads.length });
}
