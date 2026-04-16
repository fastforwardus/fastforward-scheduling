import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, users, remindersLog } from "@/db/schema";
import { and, eq, lte, gte } from "drizzle-orm";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const tenMinutesAgo  = new Date(now.getTime() - 45 * 60 * 1000);
  const sixtyMinutesAgo = new Date(now.getTime() - 120 * 60 * 1000);

  const missed = await db.select({
    id: appointments.id,
    clientName: appointments.clientName,
    clientEmail: appointments.clientEmail,
    clientCompany: appointments.clientCompany,
    clientWhatsapp: appointments.clientWhatsapp,
    clientLanguage: appointments.clientLanguage,
    platform: appointments.platform,
    scheduledAt: appointments.scheduledAt,
    confirmToken: appointments.confirmToken,
    assignedTo: appointments.assignedTo,
    noShowCount: appointments.noShowCount,
  }).from(appointments).where(
    and(
      lte(appointments.scheduledAt, tenMinutesAgo),
      gte(appointments.scheduledAt, sixtyMinutesAgo),
      eq(appointments.status, "scheduled"),
    )
  );

  let processed = 0;

  for (const appt of missed) {
    const already = await db.select().from(remindersLog).where(
      and(eq(remindersLog.appointmentId, appt.id), eq(remindersLog.type, "noshow_client"))
    ).limit(1);
    if (already.length) continue;

    await db.update(appointments)
      .set({ status: "no_show", noShowCount: appt.noShowCount + 1 })
      .where(eq(appointments.id, appt.id));

    let lang = appt.clientLanguage || "es";
    if (!appt.clientLanguage && appt.clientWhatsapp) {
      const phone = appt.clientWhatsapp.replace(/\D/g, "");
      if (phone.startsWith("55") || phone.startsWith("351")) lang = "pt";
      else if (phone.startsWith("1") && phone.length === 11) lang = "en";
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";

    const subjects: Record<string, string> = {
      es: "Le esperábamos - Reagende su consulta",
      en: "We missed you - Reschedule your consultation",
      pt: "Sentimos sua falta - Reagende sua consulta",
    };

    const bodies: Record<string, string> = {
      es: `Estimado/a ${appt.clientName}, teníamos una reunión agendada hoy pero no pudimos conectar. Puede reagendar con un clic.`,
      en: `Hi ${appt.clientName}, we had a meeting scheduled today but couldn't connect. You can reschedule with one click.`,
      pt: `Ola ${appt.clientName}, tinhamos uma reuniao agendada hoje mas nao conseguimos conectar. Voce pode reagendar com um clique.`,
    };

    const ctas: Record<string, string> = {
      es: "Reagendar mi consulta",
      en: "Reschedule my consultation",
      pt: "Reagendar minha consulta",
    };

    try {
      await resend.emails.send({
        from: "FastForward FDA Experts <noreply@fastfwdus.com>",
        to: appt.clientEmail,
        subject: subjects[lang] || subjects.es,
        html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  <div style="background:#27295C;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
    <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="32" alt="FastForward">
  </div>
  <div style="background:white;border-radius:12px;padding:24px;border:1px solid #E5E7EB;">
    <p style="font-size:18px;font-weight:700;color:#27295C;margin:0 0 12px;">${subjects[lang] || subjects.es}</p>
    <p style="color:#6B7280;font-size:14px;margin:0 0 20px;">${bodies[lang] || bodies.es}</p>
    <a href="${appUrl}/book" style="display:block;text-align:center;background:#C9A84C;color:#1A1C3E;padding:14px;border-radius:10px;font-weight:700;text-decoration:none;font-size:14px;">
      ${ctas[lang] || ctas.es} →
    </a>
  </div>
</div>`,
      });
      await db.insert(remindersLog).values({
        appointmentId: appt.id, type: "noshow_client",
        channel: "email", sentAt: new Date(), status: "sent",
      });
    } catch (err) {
      await db.insert(remindersLog).values({
        appointmentId: appt.id, type: "noshow_client",
        channel: "email", sentAt: new Date(), status: "failed", errorMessage: String(err),
      });
    }

    if (appt.assignedTo) {
      try {
        const [rep] = await db.select({ email: users.email, fullName: users.fullName })
          .from(users).where(eq(users.id, appt.assignedTo)).limit(1);
        if (rep) {
          await resend.emails.send({
            from: "FastForward Scheduling <noreply@fastfwdus.com>",
            to: rep.email,
            subject: `No-show - ${appt.clientName} (${appt.clientCompany})`,
            html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  <div style="background:#27295C;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
    <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="32" alt="FastForward">
  </div>
  <div style="background:white;border-radius:12px;padding:24px;border:1px solid #E5E7EB;">
    <p style="font-size:16px;font-weight:700;color:#27295C;margin:0 0 8px;">No-show detectado</p>
    <p style="color:#6B7280;font-size:14px;margin:0 0 16px;">
      <strong>${appt.clientName}</strong> de <strong>${appt.clientCompany}</strong> no se presento a la cita.
      Le enviamos un email automatico para reagendar.
    </p>
    <div style="background:#FEF9C3;border-radius:8px;padding:12px;margin-bottom:16px;">
      <p style="font-size:12px;color:#854D0E;margin:0;">WhatsApp: ${appt.clientWhatsapp}</p>
    </div>
    <a href="${appUrl}/dashboard" style="display:block;text-align:center;background:#27295C;color:white;padding:12px;border-radius:10px;font-weight:700;text-decoration:none;font-size:14px;">
      Ver en dashboard →
    </a>
  </div>
</div>`,
          });
          await db.insert(remindersLog).values({
            appointmentId: appt.id, type: "noshow_sales",
            channel: "email", sentAt: new Date(), status: "sent",
          });
        }
      } catch (err) {
        console.error("Error notifying rep:", err);
      }
    }

    processed++;
  }

  return NextResponse.json({ ok: true, processed, timestamp: now.toISOString() });
}
