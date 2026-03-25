export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, users } from "@/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
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
  // Find appointments starting in 25-35 minutes
  const from = new Date(now.getTime() + 25 * 60 * 1000);
  const to   = new Date(now.getTime() + 35 * 60 * 1000);

  const upcoming = await db.select({
    id: appointments.id,
    clientName: appointments.clientName,
    clientEmail: appointments.clientEmail,
    clientCompany: appointments.clientCompany,
    clientWhatsapp: appointments.clientWhatsapp,
    serviceInterest: appointments.serviceInterest,
    exportVolume: appointments.exportVolume,
    clientNotes: appointments.clientNotes,
    clientLanguage: appointments.clientLanguage,
    scheduledAt: appointments.scheduledAt,
    platform: appointments.platform,
    meetingLink: appointments.meetingLink,
    assignedTo: appointments.assignedTo,
    utmSource: appointments.utmSource,
    partnerSlug: appointments.partnerSlug,
  }).from(appointments)
    .where(
      and(
        gte(appointments.scheduledAt, from),
        lte(appointments.scheduledAt, to),
        eq(appointments.status, "scheduled"),
      )
    );

  let sent = 0;

  for (const appt of upcoming) {
    if (!appt.assignedTo) continue;

    const [rep] = await db.select({
      fullName: users.fullName,
      email: users.email,
    }).from(users).where(eq(users.id, appt.assignedTo)).limit(1);

    if (!rep) continue;

    // Get client history
    const history = await db.select({
      scheduledAt: appointments.scheduledAt,
      outcome: appointments.outcome,
      serviceInterest: appointments.serviceInterest,
      notes: appointments.notes,
    }).from(appointments)
      .where(eq(appointments.clientEmail, appt.clientEmail))
      .orderBy(desc(appointments.scheduledAt))
      .limit(5);

    const previousAppts = history.filter(h => h.scheduledAt !== appt.scheduledAt);

    const SERVICE_LABELS: Record<string, string> = {
      fda_fsma: "FDA / FSMA Compliance",
      register_company: "Apertura de LLC en EE.UU.",
      not_sure: "Asesoría general",
    };

    const EXPORT_LABELS: Record<string, string> = {
      not_exporting: "No exporta aún",
      starting_under_100k: "Iniciando — menos de USD 100k",
      exporting_100k_1m: "USD 100k — 1M",
      high_volume_over_1m: "Más de USD 1M",
    };

    const context = [
      `Cliente: ${appt.clientName} — ${appt.clientCompany}`,
      `Servicio de interés: ${SERVICE_LABELS[appt.serviceInterest || ""] || appt.serviceInterest || "General"}`,
      `Volumen de exportación: ${EXPORT_LABELS[appt.exportVolume || ""] || "No especificado"}`,
      `Idioma: ${appt.clientLanguage || "es"}`,
      appt.clientNotes ? `Comentario del cliente: "${appt.clientNotes}"` : "",
      appt.utmSource ? `Origen: ${appt.utmSource}` : "",
      appt.partnerSlug ? `Referido por partner: ${appt.partnerSlug}` : "",
      previousAppts.length > 0
        ? `Historial: ${previousAppts.length} cita(s) anterior(es). Último outcome: ${previousAppts[0].outcome || "sin outcome"}`
        : "Primera consulta con FastForward",
    ].filter(Boolean).join("\n");

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      messages: [{
        role: "user",
        content: `Sos asistente de FastForward FDA Experts. 
Generá un briefing pre-llamada en español para el sales rep ${rep.fullName.split(" ")[0]}, que tiene una consulta en 30 minutos.

Contexto del cliente:
${context}

El briefing debe incluir:
1. Resumen del cliente en 2 líneas
2. Lo que probablemente necesita / dolor principal
3. 2-3 servicios específicos de FastForward para mencionar (de: Registro FDA, Revisión de etiquetas, FSVP, LLC Miami, Marca USPTO, USDA)
4. 1 pregunta clave para hacerle al cliente
5. Tip de cierre (máx 1 línea)

Formato: HTML simple con <strong> para títulos. Sin listas con viñetas, usar <p> tags. Máx 250 palabras.`
      }],
    });

    const briefingHtml = message.content[0].type === "text" ? message.content[0].text : "";

    const apptTime = new Date(appt.scheduledAt).toLocaleTimeString("es-ES", {
      hour: "2-digit", minute: "2-digit", timeZone: "America/New_York"
    });

    await resend.emails.send({
      from: "FastForward Sistema <info@fastfwdus.com>",
      replyTo: "info@fastfwdus.com",
      to: rep.email,
      subject: `🎯 Briefing pre-llamada — ${appt.clientName} (${apptTime} Miami)`,
      html: `
<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <div style="background:#27295C;border-radius:16px 16px 0 0;padding:24px 28px;">
    <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="28" alt="FastForward">
    <p style="color:rgba(255,255,255,0.6);font-size:11px;margin:8px 0 0;text-transform:uppercase;letter-spacing:0.05em;">Briefing Pre-Llamada</p>
  </div>
  <div style="background:white;border-radius:0 0 16px 16px;padding:28px;border:1px solid #E5E7EB;border-top:none;">
    <div style="background:#F8F9FB;border-radius:10px;padding:14px;margin-bottom:20px;border:1px solid #E5E7EB;">
      <p style="font-size:16px;font-weight:700;color:#27295C;margin:0 0 2px;">${appt.clientName}</p>
      <p style="font-size:13px;color:#6B7280;margin:0 0 8px;">${appt.clientCompany}</p>
      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        <span style="font-size:12px;color:#374151;">🕐 ${apptTime} (Miami)</span>
        <span style="font-size:12px;color:#374151;">📱 ${appt.platform === "meet" ? "Google Meet" : "WhatsApp"}</span>
        ${appt.meetingLink ? `<a href="${appt.meetingLink}" style="font-size:12px;color:#C9A84C;font-weight:600;">🔗 Unirse ahora</a>` : ""}
      </div>
    </div>

    <div style="background:#EEF2FF;border-left:3px solid #27295C;border-radius:0 8px 8px 0;padding:14px;margin-bottom:20px;">
      ${briefingHtml}
    </div>

    ${appt.clientNotes ? `
    <div style="background:#FFF7ED;border-radius:10px;padding:12px;margin-bottom:16px;border:1px solid #FED7AA;">
      <p style="font-size:11px;color:#9CA3AF;margin:0 0 4px;text-transform:uppercase;">Comentario del cliente</p>
      <p style="font-size:13px;color:#374151;margin:0;">"${appt.clientNotes}"</p>
    </div>` : ""}

    ${previousAppts.length > 0 ? `
    <div style="background:#F8F9FB;border-radius:10px;padding:12px;border:1px solid #E5E7EB;">
      <p style="font-size:11px;color:#9CA3AF;margin:0 0 6px;text-transform:uppercase;">Historial (${previousAppts.length} cita${previousAppts.length > 1 ? "s" : ""} anterior${previousAppts.length > 1 ? "es" : ""})</p>
      ${previousAppts.slice(0, 3).map(h => `
        <p style="font-size:12px;color:#374151;margin:0 0 3px;">
          ${new Date(h.scheduledAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
          ${h.outcome ? `— <strong>${h.outcome.replace(/_/g, " ")}</strong>` : "— sin outcome"}
        </p>`).join("")}
    </div>` : ""}

    <div style="border-top:1px solid #F0F0F0;padding-top:16px;margin-top:20px;text-align:center;">
      <p style="font-size:11px;color:#9CA3AF;margin:0;">FastForward Trading Company LLC · Miami, FL</p>
    </div>
  </div>
</div>`,
    });

    sent++;
    console.log(`Briefing sent to ${rep.fullName} for ${appt.clientName}`);
  }

  return NextResponse.json({ ok: true, sent, checked: upcoming.length });
}
