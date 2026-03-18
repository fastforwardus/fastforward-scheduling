import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { appointmentId, outcome, nextStep, notes, status } = await req.json();
  if (!appointmentId) return NextResponse.json({ error: "appointmentId required" }, { status: 400 });

  const [appt] = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
  if (!appt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (session.role === "sales_rep" && appt.assignedTo !== session.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let leadScore = appt.leadScore;
  if (outcome === "closed" || outcome === "proposal_sent") leadScore = "hot";
  else if (outcome === "interested") leadScore = "warm";
  else if (outcome === "not_qualified") leadScore = "cold";

  await db.update(appointments)
    .set({ outcome: outcome || null, nextStep: nextStep || null, notes: notes || null, status: status || "completed", leadScore })
    .where(eq(appointments.id, appointmentId));

  // Crear secuencia de follow-up si el outcome lo amerita
  const shouldFollowUp = ["interested", "needs_time", "proposal_sent"].includes(outcome);
  if (shouldFollowUp && status === "completed") {
    const now = new Date();
    const nextSendAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // dia 1 manana

    // Verificar si ya existe una secuencia
    const { followUpSequences } = await import("@/db/schema");
    const { eq: eqSeq } = await import("drizzle-orm");
    const existing = await db.select().from(followUpSequences)
      .where(eqSeq(followUpSequences.appointmentId, appointmentId)).limit(1);

    if (!existing.length) {
      await db.insert(followUpSequences).values({
        appointmentId,
        currentStep: 0,
        nextSendAt,
        isActive: true,
      });
    } else {
      await db.update(followUpSequences)
        .set({ isActive: true, nextSendAt, currentStep: 0, completedAt: null })
        .where(eqSeq(followUpSequences.appointmentId, appointmentId));
    }
  }

  // Enviar encuesta si la cita fue completada
  if (status === "completed" && appt.confirmToken) {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";
    const surveyUrl = `${appUrl}/survey/${appt.confirmToken}`;
    const lang = appt.clientLanguage || "es";

    const subjects: Record<string, string> = {
      es: "Como fue tu consulta con FastForward?",
      en: "How was your consultation with FastForward?",
      pt: "Como foi sua consulta com a FastForward?",
    };

    await resend.emails.send({
      from: "FastForward FDA Experts <noreply@fastfwdus.com>",
      to: appt.clientEmail,
      subject: subjects[lang] || subjects.es,
      html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  <div style="background:#27295C;border-radius:12px;padding:20px;text-align:center;margin-bottom:20px;">
    <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="28" alt="FastForward">
  </div>
  <div style="background:white;border-radius:12px;padding:24px;border:1px solid #E5E7EB;text-align:center;">
    <p style="font-size:24px;margin:0 0 12px;">🙏</p>
    <h2 style="font-size:20px;font-weight:700;color:#27295C;margin:0 0 8px;">${subjects[lang]}</h2>
    <p style="color:#6B7280;font-size:14px;margin:0 0 24px;">
      ${lang === "en" ? "Your feedback helps us improve. It only takes 30 seconds." : lang === "pt" ? "Seu feedback nos ajuda a melhorar. Leva apenas 30 segundos." : "Tu opinion nos ayuda a mejorar. Solo toma 30 segundos."}
    </p>
    <a href="${surveyUrl}" style="display:inline-block;background:#C9A84C;color:#1A1C3E;padding:14px 32px;border-radius:10px;font-weight:700;text-decoration:none;font-size:14px;">
      ${lang === "en" ? "Rate my experience" : lang === "pt" ? "Avaliar minha experiencia" : "Calificar mi experiencia"} →
    </a>
  </div>
</div>`,
    }).catch(console.error);
  }

  return NextResponse.json({ ok: true });
}
