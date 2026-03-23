export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { Resend } from "resend";
import { createMeetEvent } from "@/lib/google";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { appointmentId, newScheduledAt } = await req.json();
  if (!appointmentId || !newScheduledAt) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });

  const [appt] = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
  if (!appt) return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });

  let meetingLink = appt.meetingLink;

  // Regenerate Meet link if assigned
  if (appt.assignedTo && appt.platform === "meet") {
    const [rep] = await db.select({
      googleRefreshToken: users.googleRefreshToken,
      fullName: users.fullName,
    }).from(users).where(eq(users.id, appt.assignedTo)).limit(1);

    if (rep?.googleRefreshToken) {
      try {
        const endTime = new Date(new Date(newScheduledAt).getTime() + 30 * 60 * 1000);
        const { meetLink } = await createMeetEvent({
          refreshToken: rep.googleRefreshToken,
          title: `Consulta FastForward — ${appt.clientName} (${appt.clientCompany})`,
          startTime: new Date(newScheduledAt),
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
  }

  await db.update(appointments).set({
    scheduledAt: new Date(newScheduledAt),
    status: "scheduled",
    meetingLink: meetingLink || appt.meetingLink,
  }).where(eq(appointments.id, appointmentId));

  const slotDate = new Date(newScheduledAt);
  const formattedDate = slotDate.toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/New_York" });
  const formattedTime = slotDate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";

  // Email to client
  await resend.emails.send({
    from: "FastForward FDA Experts <info@fastfwdus.com>",
    replyTo: "info@fastfwdus.com",
    to: appt.clientEmail,
    subject: `Tu cita fue reagendada — FastForward`,
    html: `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  <div style="background:#27295C;border-radius:16px 16px 0 0;padding:28px;text-align:center;">
    <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="32" alt="FastForward">
  </div>
  <div style="background:white;border-radius:0 0 16px 16px;padding:32px;border:1px solid #E5E7EB;border-top:none;">
    <p style="font-size:18px;font-weight:700;color:#27295C;margin:0 0 8px;">Hola, ${appt.clientName.split(" ")[0]}</p>
    <p style="color:#6B7280;font-size:14px;margin:0 0 20px;">Tu cita fue reagendada para una nueva fecha.</p>
    <div style="background:#F8F9FB;border-radius:12px;padding:16px;margin-bottom:24px;border:1px solid #E5E7EB;">
      <p style="font-size:14px;font-weight:600;color:#27295C;margin:0 0 4px;">${formattedDate}</p>
      <p style="font-size:13px;color:#6B7280;margin:0;">${formattedTime} (hora Miami) · 30 minutos</p>
    </div>
    ${meetingLink ? `<a href="${meetingLink}" style="display:block;text-align:center;background:#C9A84C;color:#1A1C3E;padding:14px;border-radius:10px;font-weight:700;text-decoration:none;margin-bottom:12px;">Unirse a la reunión →</a>` : ""}
    <a href="${appUrl}/book/confirm/${appt.confirmToken}" style="display:block;text-align:center;background:#27295C;color:white;padding:12px;border-radius:10px;font-weight:600;text-decoration:none;font-size:13px;">Ver detalles →</a>
    <div style="border-top:1px solid #F0F0F0;padding-top:20px;margin-top:24px;text-align:center;">
      <p style="font-size:12px;color:#9CA3AF;margin:0;">FastForward Trading Company LLC · Miami, FL</p>
    </div>
  </div>
</div>`,
  }).catch(console.error);

  return NextResponse.json({ ok: true, meetingLink });
}
