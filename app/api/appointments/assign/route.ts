import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "sales_rep") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { appointmentId, userId } = await req.json();
  if (!appointmentId || !userId) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });

  try {
    // Obtener el rep asignado
    const [rep] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!rep) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    // Obtener la cita
    const [appt] = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
    if (!appt) return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });

    // Actualizar cita
    await db
      .update(appointments)
      .set({ assignedTo: userId, status: "scheduled" })
      .where(eq(appointments.id, appointmentId));

    // Email al sales rep asignado
    const slotDate = new Date(appt.scheduledAt);
    const formattedDate = slotDate.toLocaleDateString("es-ES", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      timeZone: "America/New_York",
    });
    const formattedTime = slotDate.toLocaleTimeString("es-ES", {
      hour: "2-digit", minute: "2-digit", timeZone: "America/New_York",
    });

    const platformLabel = appt.platform === "meet" ? "Google Meet" : appt.platform === "zoom" ? "Zoom" : "WhatsApp";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fastforward-scheduling.vercel.app";

    // Notificar al sales rep
    await resend.emails.send({
      from: "FastForward Scheduling <noreply@fastfwdus.com>",
      to: rep.email,
      subject: `Nueva cita asignada - ${appt.clientName} (${appt.clientCompany})`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;background:#F8F9FB;padding:24px;border-radius:16px;">
          <div style="background:#27295C;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
            <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="32" alt="FastForward">
          </div>
          <div style="background:white;border-radius:12px;padding:24px;border:1px solid #E5E7EB;">
            <p style="font-size:18px;font-weight:700;color:#27295C;margin:0 0 4px;">Hola, ${rep.fullName}</p>
            <p style="color:#6B7280;font-size:14px;margin:0 0 20px;">Te fue asignada una nueva cita.</p>

            <div style="background:#F8F9FB;border-radius:10px;padding:16px;margin-bottom:20px;border:1px solid #E5E7EB;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="padding:6px 0;border-bottom:1px solid #F0F0F0;">
                  <span style="font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;">Cliente</span><br>
                  <span style="font-size:14px;font-weight:600;color:#27295C;">${appt.clientName} — ${appt.clientCompany}</span>
                </td></tr>
                <tr><td style="padding:6px 0;border-bottom:1px solid #F0F0F0;">
                  <span style="font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;">Fecha y hora (Miami)</span><br>
                  <span style="font-size:14px;font-weight:600;color:#27295C;">${formattedDate} · ${formattedTime}</span>
                </td></tr>
                <tr><td style="padding:6px 0;border-bottom:1px solid #F0F0F0;">
                  <span style="font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;">Plataforma</span><br>
                  <span style="font-size:14px;font-weight:600;color:#27295C;">${platformLabel}</span>
                </td></tr>
                <tr><td style="padding:6px 0;">
                  <span style="font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;">WhatsApp</span><br>
                  <span style="font-size:14px;font-weight:600;color:#27295C;">${appt.clientWhatsapp}</span>
                </td></tr>
              </table>
            </div>

            <a href="${appUrl}/dashboard/sales"
               style="display:block;text-align:center;background:#C9A84C;color:#1A1C3E;padding:14px;border-radius:10px;font-weight:700;text-decoration:none;font-size:14px;">
              Ver en mi dashboard →
            </a>
          </div>
          <p style="text-align:center;font-size:11px;color:#9CA3AF;margin-top:16px;">FastForward FDA Experts · Miami, FL</p>
        </div>
      `,
    });

    // Notificar al cliente que ya tiene asignado
    await resend.emails.send({
      from: "FastForward FDA Experts <noreply@fastfwdus.com>",
      to: appt.clientEmail,
      subject: `Tu cita fue confirmada - ${rep.fullName} te atendra`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;background:#F8F9FB;padding:24px;border-radius:16px;">
          <div style="background:#27295C;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
            <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="32" alt="FastForward">
          </div>
          <div style="background:white;border-radius:12px;padding:24px;border:1px solid #E5E7EB;">
            <p style="font-size:18px;font-weight:700;color:#27295C;margin:0 0 16px;">Hola, ${appt.clientName}</p>
            <p style="color:#6B7280;font-size:14px;margin:0 0 20px;">
              Confirmamos que <strong style="color:#27295C;">${rep.fullName}</strong>, experto de FastForward, te atenderá en tu cita.
            </p>
            <div style="background:#F8F9FB;border-radius:10px;padding:16px;margin-bottom:20px;border:1px solid #E5E7EB;">
              <p style="font-size:13px;color:#27295C;margin:0;font-weight:600;">${formattedDate} · ${formattedTime} (Miami)</p>
              <p style="font-size:13px;color:#6B7280;margin:4px 0 0;">${platformLabel} · 30 minutos</p>
            </div>
            <a href="${appUrl}/book/confirm/${appt.confirmToken}"
               style="display:block;text-align:center;background:#27295C;color:white;padding:14px;border-radius:10px;font-weight:700;text-decoration:none;font-size:14px;">
              Ver detalles de mi cita →
            </a>
          </div>
          <p style="text-align:center;font-size:11px;color:#9CA3AF;margin-top:16px;">FastForward FDA Experts · Miami, FL</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Assign error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
