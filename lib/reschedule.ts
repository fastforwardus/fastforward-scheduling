import { db } from "@/db";
import { appointments, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { createMeetEvent } from "@/lib/google";

const resend = new Resend(process.env.RESEND_API_KEY);
const INTERNAL_EMAIL = "info@fastfwdus.com";

export type RescheduleResult =
  | { ok: true; meetingLink: string | null; appt: typeof appointments.$inferSelect }
  | { ok: false; error: string; status: number };

function fmtMiami(d: Date) {
  const fecha = d.toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/New_York" });
  const hora = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" });
  return { fecha, hora };
}

/**
 * Mueve una cita existente a una nueva fecha manteniendo el mismo rep asignado.
 * Regenera el link de Meet si corresponde, envía el email de reagendado al cliente
 * y avisa al rep asignado (con copia a info@) de la nueva fecha.
 * Lo usan el dashboard (/api/appointments/reschedule) y la tool reschedule_booking de Adriana.
 */
export async function rescheduleAppointment(appointmentId: string, newScheduledAt: Date, origen: "dashboard" | "adriana_whatsapp" = "dashboard"): Promise<RescheduleResult> {
  const [appt] = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
  if (!appt) return { ok: false, error: "Cita no encontrada", status: 404 };

  const anteriorScheduledAt = appt.scheduledAt;
  let meetingLink = appt.meetingLink;
  let rep: { googleRefreshToken: string | null; fullName: string; email: string } | undefined;

  if (appt.assignedTo) {
    [rep] = await db.select({
      googleRefreshToken: users.googleRefreshToken,
      fullName: users.fullName,
      email: users.email,
    }).from(users).where(eq(users.id, appt.assignedTo)).limit(1);
  }

  if (rep?.googleRefreshToken && appt.platform === "meet") {
    try {
      const endTime = new Date(newScheduledAt.getTime() + 30 * 60 * 1000);
      const { meetLink } = await createMeetEvent({
        refreshToken: rep.googleRefreshToken,
        title: `Consulta FastForward — ${appt.clientName} (${appt.clientCompany})`,
        startTime: newScheduledAt,
        endTime,
        attendeeEmail: appt.clientEmail,
        attendeeName: appt.clientName,
        description: `Reagendamiento de consulta FastForward FDA Experts`,
      });
      meetingLink = meetLink;
    } catch (err) {
      console.error("Error regenerating Meet link:", err);
    }
  }

  await db.update(appointments).set({
    scheduledAt: newScheduledAt,
    status: "scheduled",
    meetingLink: meetingLink || appt.meetingLink,
  }).where(eq(appointments.id, appointmentId));

  const nueva = fmtMiami(newScheduledAt);
  const anterior = fmtMiami(anteriorScheduledAt);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";

  // Email al cliente
  await resend.emails.send({
    from: "FastForward FDA Experts <info@fastfwdus.com>",
    replyTo: "info@fastfwdus.com",
    to: appt.clientEmail,
    subject: `Tu cita fue reagendada — FastForward`,
    html: `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  <div style="background:#000000;border-radius:16px 16px 0 0;padding:28px;text-align:center;">
    <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="32" alt="FastForward">
  </div>
  <div style="background:white;border-radius:0 0 16px 16px;padding:32px;border:1px solid #E5E7EB;border-top:none;">
    <p style="font-size:18px;font-weight:700;color:#000000;margin:0 0 8px;">Hola, ${appt.clientName.split(" ")[0]}</p>
    <p style="color:#6B7280;font-size:14px;margin:0 0 20px;">Tu cita fue reagendada para una nueva fecha.</p>
    <div style="background:#F8F9FB;border-radius:12px;padding:16px;margin-bottom:24px;border:1px solid #E5E7EB;">
      <p style="font-size:14px;font-weight:600;color:#000000;margin:0 0 4px;">${nueva.fecha}</p>
      <p style="font-size:13px;color:#6B7280;margin:0;">${nueva.hora} (hora Miami) · 30 minutos</p>
    </div>
    ${meetingLink ? `<a href="${meetingLink}" style="display:block;text-align:center;background:#0183FF;color:#000000;padding:14px;border-radius:10px;font-weight:700;text-decoration:none;margin-bottom:12px;">Unirse a la reunión →</a>` : ""}
    <a href="${appUrl}/book/confirm/${appt.confirmToken}" style="display:block;text-align:center;background:#000000;color:white;padding:12px;border-radius:10px;font-weight:600;text-decoration:none;font-size:13px;">Ver detalles →</a>
    <div style="border-top:1px solid #F0F0F0;padding-top:20px;margin-top:24px;text-align:center;">
      <p style="font-size:12px;color:#9CA3AF;margin:0;">FastForward Trading Company LLC · Miami, FL</p>
    </div>
  </div>
</div>`,
  }).catch(console.error);

  // Aviso interno: rep asignado + info@ (solo info@ si la cita no tiene rep)
  const destinatarios = rep?.email && rep.email.toLowerCase() !== INTERNAL_EMAIL ? [rep.email, INTERNAL_EMAIL] : [INTERNAL_EMAIL];
  const origenLabel = origen === "adriana_whatsapp" ? "Adriana (WhatsApp)" : "Dashboard";
  await resend.emails.send({
    from: "FastForward Sistema <info@fastfwdus.com>",
    to: destinatarios,
    subject: `🔁 Cita reagendada — ${appt.clientName} (${appt.clientCompany})`,
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:system-ui,sans-serif;background:#F8F9FB;margin:0;padding:0">
<div style="max-width:580px;margin:0 auto;padding:24px">
  <div style="background:linear-gradient(135deg,#000000,#1e2150);border-radius:20px;padding:28px;text-align:center;margin-bottom:20px">
    <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="36" style="margin-bottom:16px" />
    <p style="color:rgba(201,168,76,0.9);font-size:13px;font-weight:600;margin:0 0 8px;text-transform:uppercase;letter-spacing:2px">Cita reagendada</p>
    <h1 style="color:white;font-size:24px;font-weight:800;margin:0">${appt.clientName}</h1>
    <p style="color:rgba(255,255,255,0.6);font-size:14px;margin:8px 0 0">${appt.clientCompany || ""}</p>
  </div>
  <div style="background:white;border-radius:16px;padding:24px;border:1px solid #E5E7EB">
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr><td style="padding:8px 0;color:#6B7280">Nueva fecha</td><td style="padding:8px 0;font-weight:700;color:#000">${nueva.fecha}, ${nueva.hora} (hora Miami)</td></tr>
      <tr style="border-top:1px solid #F3F4F6"><td style="padding:8px 0;color:#6B7280">Fecha anterior</td><td style="padding:8px 0;color:#6B7280;text-decoration:line-through">${anterior.fecha}, ${anterior.hora}</td></tr>
      <tr style="border-top:1px solid #F3F4F6"><td style="padding:8px 0;color:#6B7280">Consultor</td><td style="padding:8px 0">${rep?.fullName || "Sin asignar"}</td></tr>
      <tr style="border-top:1px solid #F3F4F6"><td style="padding:8px 0;color:#6B7280">Email</td><td style="padding:8px 0"><a href="mailto:${appt.clientEmail}" style="color:#0183FF">${appt.clientEmail}</a></td></tr>
      ${appt.clientWhatsapp ? `<tr style="border-top:1px solid #F3F4F6"><td style="padding:8px 0;color:#6B7280">WhatsApp</td><td style="padding:8px 0">${appt.clientWhatsapp}</td></tr>` : ""}
      <tr style="border-top:1px solid #F3F4F6"><td style="padding:8px 0;color:#6B7280">Reagendado desde</td><td style="padding:8px 0">${origenLabel}</td></tr>
    </table>
    ${meetingLink ? `<a href="${meetingLink}" style="display:block;text-align:center;background:#0183FF;color:#000;padding:12px;border-radius:10px;font-weight:700;text-decoration:none;margin-top:20px">Link de la reunión →</a>` : ""}
    <a href="${appUrl}/dashboard/appointments" style="display:block;text-align:center;background:#000;color:#fff;padding:12px;border-radius:10px;font-weight:600;text-decoration:none;font-size:13px;margin-top:10px">Ver en el dashboard →</a>
  </div>
</div></body></html>`,
  }).catch((err) => console.error("Error aviso interno reagendado:", err));

  return { ok: true, meetingLink: meetingLink ?? null, appt };
}
