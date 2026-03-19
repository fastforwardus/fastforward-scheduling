export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { Resend } from "resend";
import { createMeetEvent } from "@/lib/google";
import { createZoomMeeting } from "@/lib/zoom";
import { formatInTimeZone } from "date-fns-tz";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "sales_rep") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { appointmentId, userId } = await req.json();
  if (!appointmentId || !userId) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });

  try {
    const [rep] = await db.select({
      id: users.id, fullName: users.fullName, email: users.email,
      googleRefreshToken: users.googleRefreshToken, whatsappPhone: users.whatsappPhone,
    }).from(users).where(eq(users.id, userId)).limit(1);
    if (!rep) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const [appt] = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
    if (!appt) return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });

    // ── Generar link de reunion ──────────────────────────────
    let meetingLink = appt.meetingLink || "";

    if (appt.platform === "meet") {
      if (rep.googleRefreshToken) {
        try {
          const endTime = new Date(new Date(appt.scheduledAt).getTime() + 30 * 60 * 1000);
          const { meetLink } = await createMeetEvent({
            refreshToken: rep.googleRefreshToken,
            title: `Consulta FastForward — ${appt.clientName} (${appt.clientCompany})`,
            startTime: new Date(appt.scheduledAt),
            endTime,
            attendeeEmail: appt.clientEmail,
            attendeeName: appt.clientName,
            description: [
              "Consulta FastForward FDA Experts",
              `Empresa: ${appt.clientCompany}`,
              `Servicio: ${appt.serviceInterest || "General"}`,
              `WhatsApp: ${appt.clientWhatsapp}`,
            ].join("\n"),
          });
          meetingLink = meetLink;
          console.log("Meet creado para", rep.fullName, ":", meetLink);
        } catch (meetErr: unknown) {
          const errMsg = meetErr instanceof Error ? meetErr.message : String(meetErr);
          console.error("Error creando Meet para", rep.fullName, ":", errMsg);
          meetingLink = "";
        }
      } else {
        console.warn("Rep", rep.fullName, "no tiene Google Calendar conectado");
      }
    } else if (appt.platform === "zoom") {
      try {
        const { joinUrl } = await createZoomMeeting({
          title: `Consulta FastForward - ${appt.clientName} (${appt.clientCompany})`,
          startTime: new Date(appt.scheduledAt),
          durationMinutes: 30,
          hostEmail: rep.email,
          attendeeEmail: appt.clientEmail,
          attendeeName: appt.clientName,
        });
        meetingLink = joinUrl;
        console.log("Zoom meeting creado:", joinUrl);
      } catch (zoomErr: unknown) {
        const errMsg = zoomErr instanceof Error ? zoomErr.message : String(zoomErr);
        console.error("Error creando Zoom:", errMsg);
        meetingLink = "";
      }
    }

    // ── Actualizar cita ──────────────────────────────────────
    await db.update(appointments)
      .set({ assignedTo: userId, status: "scheduled", meetingLink: meetingLink || null })
      .where(eq(appointments.id, appointmentId));

    // ── Formatear fecha ──────────────────────────────────────
    const slotDate = new Date(appt.scheduledAt);
    const formattedDate = slotDate.toLocaleDateString("es-ES", {
      weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/New_York",
    });
    const formattedTime = formatInTimeZone(slotDate, "America/New_York", "h:mm a");
    const platformLabel = appt.platform === "meet" ? "Google Meet" : appt.platform === "zoom" ? "Zoom" : "WhatsApp";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";

    // ── Email al rep ─────────────────────────────────────────
    await resend.emails.send({
      from: "FastForward Scheduling <noreply@fastfwdus.com>",
      to: rep.email,
      subject: `Nueva cita asignada - ${appt.clientName} (${appt.clientCompany})`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
          <div style="background:#27295C;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
            <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="32" alt="FastForward">
          </div>
          <div style="background:white;border-radius:12px;padding:24px;border:1px solid #E5E7EB;">
            <p style="font-size:18px;font-weight:700;color:#27295C;margin:0 0 4px;">Hola, ${rep.fullName}</p>
            <p style="color:#6B7280;font-size:14px;margin:0 0 20px;">Te fue asignada una nueva cita.</p>
            <div style="background:#F8F9FB;border-radius:10px;padding:16px;margin-bottom:20px;border:1px solid #E5E7EB;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="padding:8px 0;border-bottom:1px solid #F0F0F0;">
                  <span style="font-size:11px;color:#9CA3AF;text-transform:uppercase;">Cliente</span><br>
                  <span style="font-size:14px;font-weight:600;color:#27295C;">${appt.clientName} — ${appt.clientCompany}</span>
                </td></tr>
                <tr><td style="padding:8px 0;border-bottom:1px solid #F0F0F0;">
                  <span style="font-size:11px;color:#9CA3AF;text-transform:uppercase;">Fecha y hora (Miami)</span><br>
                  <span style="font-size:14px;font-weight:600;color:#27295C;">${formattedDate} · ${formattedTime}</span>
                </td></tr>
                <tr><td style="padding:8px 0;border-bottom:1px solid #F0F0F0;">
                  <span style="font-size:11px;color:#9CA3AF;text-transform:uppercase;">Plataforma</span><br>
                  <span style="font-size:14px;font-weight:600;color:#27295C;">${platformLabel}</span>
                </td></tr>
                ${meetingLink ? `<tr><td style="padding:8px 0;border-bottom:1px solid #F0F0F0;">
                  <span style="font-size:11px;color:#9CA3AF;text-transform:uppercase;">Link reunion</span><br>
                  <a href="${meetingLink}" style="font-size:14px;font-weight:600;color:#C9A84C;">${meetingLink}</a>
                </td></tr>` : ""}
                <tr><td style="padding:8px 0;">
                  <span style="font-size:11px;color:#9CA3AF;text-transform:uppercase;">WhatsApp</span><br>
                  <span style="font-size:14px;font-weight:600;color:#27295C;">${appt.clientWhatsapp}</span>
                </td></tr>
              </table>
            </div>
            <a href="${appUrl}/dashboard" style="display:block;text-align:center;background:#C9A84C;color:#1A1C3E;padding:14px;border-radius:10px;font-weight:700;text-decoration:none;">
              Ver en dashboard →
            </a>
            ${!rep.googleRefreshToken && appt.platform === "meet" ? `
            <p style="margin-top:16px;padding:12px;background:#FEF9C3;border-radius:8px;font-size:12px;color:#854D0E;">
              ⚠️ No conectaste tu Google Calendar. Ve a <a href="${appUrl}/dashboard/settings" style="color:#854D0E;font-weight:600;">Configuracion</a> para generar el link de Meet.
            </p>` : ""}
          </div>
        </div>`,
    });

    // ── Email al cliente ─────────────────────────────────────
    await resend.emails.send({
      from: "FastForward FDA Experts <noreply@fastfwdus.com>",
      to: appt.clientEmail,
      subject: `Tu cita fue confirmada - ${rep.fullName} te atendera`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
          <div style="background:#27295C;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
            <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="32" alt="FastForward">
          </div>
          <div style="background:white;border-radius:12px;padding:24px;border:1px solid #E5E7EB;">
            <p style="font-size:18px;font-weight:700;color:#27295C;margin:0 0 16px;">Hola, ${appt.clientName}</p>
            <p style="color:#6B7280;font-size:14px;margin:0 0 20px;">
              <strong style="color:#27295C;">${rep.fullName}</strong> de FastForward te atendera en tu cita.
            </p>
            <div style="background:#F8F9FB;border-radius:10px;padding:16px;margin-bottom:20px;border:1px solid #E5E7EB;">
              <p style="font-size:14px;font-weight:600;color:#27295C;margin:0 0 4px;">${formattedDate} · ${formattedTime} (Miami)</p>
              <p style="font-size:13px;color:#6B7280;margin:0;">${platformLabel} · 30 minutos</p>
            </div>
            ${meetingLink ? `<a href="${meetingLink}" style="display:block;text-align:center;background:#C9A84C;color:#1A1C3E;padding:14px;border-radius:10px;font-weight:700;text-decoration:none;margin-bottom:12px;">
              🔗 Unirse a la reunion →
            </a>` : ""}
            <a href="${appUrl}/book/confirm/${appt.confirmToken}" style="display:block;text-align:center;background:#27295C;color:white;padding:14px;border-radius:10px;font-weight:700;text-decoration:none;">
              Ver detalles completos →
            </a>
          </div>
        </div>`,
    });

    return NextResponse.json({ ok: true, meetingLink });
  } catch (err) {
    console.error("Assign error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
