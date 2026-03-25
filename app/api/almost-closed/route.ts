export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments } from "@/db/schema";
import { eq, and, lte, isNull } from "drizzle-orm";
import { Resend } from "resend";
import Anthropic from "@anthropic-ai/sdk";

const resend = new Resend(process.env.RESEND_API_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

  // Citas marcadas como "needs_time" hace más de 10 días sin reagendar
  const stale = await db.select({
    id: appointments.id,
    clientName: appointments.clientName,
    clientEmail: appointments.clientEmail,
    clientCompany: appointments.clientCompany,
    serviceInterest: appointments.serviceInterest,
    clientLanguage: appointments.clientLanguage,
    outcome: appointments.outcome,
    scheduledAt: appointments.scheduledAt,
    assignedTo: appointments.assignedTo,
  }).from(appointments)
    .where(
      and(
        eq(appointments.outcome, "needs_time"),
        lte(appointments.scheduledAt, tenDaysAgo),
        isNull(appointments.almostClosedSentAt),
      )
    );

  let sent = 0;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";

  const SERVICE_LABELS: Record<string, string> = {
    fda_fsma: "FDA / FSMA Compliance",
    register_company: "apertura de LLC en EE.UU.",
    not_sure: "asesoría regulatoria",
  };

  for (const appt of stale) {
    try {
      const lang = appt.clientLanguage || "es";
      const firstName = appt.clientName.split(" ")[0];
      const service = SERVICE_LABELS[appt.serviceInterest || ""] || "nuestros servicios";

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        messages: [{
          role: "user",
          content: `Sos asesor de FastForward FDA Experts en Miami. 
Escribí un email corto en ${lang === "en" ? "English" : lang === "pt" ? "português" : "español"} para ${firstName} de ${appt.clientCompany}.
Hace 10+ días consultaron sobre ${service} y dijeron que necesitaban tiempo para decidir.
El email debe: ser cálido y sin presión, mencionar que entendés que es una decisión importante, ofrecer resolver dudas, incluir un beneficio sutil (ej: podemos arrancar esta semana y tener el registro listo antes de tu próximo envío).
Máx 80 palabras. Sin asunto. Solo el cuerpo en HTML simple (p, strong tags). Sin firma.`
        }],
      });

      const body = message.content[0].type === "text" ? message.content[0].text : "";

      const bookUrl = `${appUrl}/book`;

      await resend.emails.send({
        from: "Carlos Bisio — FastForward <info@fastfwdus.com>",
        replyTo: "info@fastfwdus.com",
        to: appt.clientEmail,
        subject: lang === "en"
          ? `${firstName}, still thinking about it?`
          : lang === "pt"
          ? `${firstName}, ainda pensando?`
          : `${firstName}, ¿todavía lo estás pensando?`,
        html: `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  <div style="background:#27295C;border-radius:16px 16px 0 0;padding:28px;text-align:center;">
    <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="32" alt="FastForward">
  </div>
  <div style="background:white;border-radius:0 0 16px 16px;padding:32px;border:1px solid #E5E7EB;border-top:none;">
    ${body}
    <div style="margin-top:24px;">
      <a href="${bookUrl}" style="display:inline-block;background:#C9A84C;color:#1A1C3E;padding:12px 24px;border-radius:10px;font-weight:700;text-decoration:none;font-size:13px;">
        ${lang === "en" ? "Schedule a quick call →" : lang === "pt" ? "Agendar uma conversa →" : "Agendar una consulta →"}
      </a>
    </div>
    <div style="border-top:1px solid #F0F0F0;padding-top:20px;margin-top:24px;">
      <p style="font-size:12px;color:#9CA3AF;margin:0;">Carlos Bisio · FastForward FDA Experts · Miami, FL</p>
      <a href="https://fastfwdus.com" style="font-size:12px;color:#C9A84C;">fastfwdus.com</a>
    </div>
  </div>
</div>`,
      });

      // Mark as sent
      await db.update(appointments)
        .set({ almostClosedSentAt: now })
        .where(eq(appointments.id, appt.id));

      sent++;
    } catch (err) {
      console.error("Almost closed error:", err);
    }
  }

  return NextResponse.json({ ok: true, sent, checked: stale.length });
}
