import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, users, remindersLog } from "@/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { Resend } from "resend";
import { formatInTimeZone } from "date-fns-tz";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const results = { sent: 0, skipped: 0, errors: 0 };

  const windows = [
    { minutesBefore: 24 * 60, toleranceMin: 30, type: "24h" as const },
    { minutesBefore: 2 * 60,  toleranceMin: 10, type: "2h"  as const },
  ];

  for (const window of windows) {
    const targetStart = new Date(now.getTime() + (window.minutesBefore - window.toleranceMin) * 60 * 1000);
    const targetEnd   = new Date(now.getTime() + (window.minutesBefore + window.toleranceMin) * 60 * 1000);

    const upcoming = await db.select({
      id: appointments.id,
      clientName: appointments.clientName,
      clientEmail: appointments.clientEmail,
      clientWhatsapp: appointments.clientWhatsapp,
      clientTimezone: appointments.clientTimezone,
      clientLanguage: appointments.clientLanguage,
      platform: appointments.platform,
      meetingLink: appointments.meetingLink,
      scheduledAt: appointments.scheduledAt,
      confirmToken: appointments.confirmToken,
      assignedTo: appointments.assignedTo,
    }).from(appointments).where(
      and(
        gte(appointments.scheduledAt, targetStart),
        lte(appointments.scheduledAt, targetEnd),
        eq(appointments.status, "scheduled"),
      )
    );

    for (const appt of upcoming) {
      const already = await db.select().from(remindersLog).where(
        and(
          eq(remindersLog.appointmentId, appt.id),
          eq(remindersLog.type, window.type),
          eq(remindersLog.channel, "email"),
          eq(remindersLog.status, "sent"),
        )
      ).limit(1);

      if (already.length) { results.skipped++; continue; }

      let repName = "un experto de FastForward";
      if (appt.assignedTo) {
        const [rep] = await db.select({ fullName: users.fullName })
          .from(users).where(eq(users.id, appt.assignedTo)).limit(1);
        if (rep) repName = rep.fullName;
      }

      // Detectar idioma por teléfono si no hay guardado
      let lang = appt.clientLanguage || "es";
      if (!appt.clientLanguage && appt.clientWhatsapp) {
        const phone = appt.clientWhatsapp.replace(/\D/g, "");
        if (phone.startsWith("55") || phone.startsWith("351")) lang = "pt";
        else if (phone.startsWith("1") && phone.length === 11) lang = "en";
      }

      const tz = appt.clientTimezone || "America/New_York";
      const slotDate = new Date(appt.scheduledAt);
      const dateLocale = lang === "pt" ? "pt-BR" : lang === "en" ? "en-US" : "es-ES";
      const formattedDate = slotDate.toLocaleDateString(dateLocale, {
        weekday: "long", day: "numeric", month: "long", timeZone: tz,
      });
      const formattedTime = formatInTimeZone(slotDate, tz, "h:mm a");
      const platformLabel = appt.platform === "meet" ? "Google Meet" : appt.platform === "zoom" ? "Zoom" : "WhatsApp";
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";
      const confirmUrl = `${appUrl}/book/confirm/${appt.confirmToken || appt.id}`;
      const isIn24h = window.type === "24h";

      const subjects: Record<string, string> = {
        es: isIn24h ? "Recordatorio - Tu reunion es manana" : "Tu reunion comienza en 2 horas",
        en: isIn24h ? "Reminder - Your meeting is tomorrow" : "Your meeting starts in 2 hours",
        pt: isIn24h ? "Lembrete - Sua reuniao e amanha" : "Sua reuniao comeca em 2 horas",
      };

      const intros: Record<string, string> = {
        es: isIn24h ? `Te recordamos que manana tenes una reunion con ${repName} de FastForward.` : `Tu reunion con ${repName} comienza en 2 horas.`,
        en: isIn24h ? `Reminder: tomorrow you have a meeting with ${repName} from FastForward.` : `Your meeting with ${repName} starts in 2 hours.`,
        pt: isIn24h ? `Lembrete: amanha voce tem uma reuniao com ${repName} da FastForward.` : `Sua reuniao com ${repName} comeca em 2 horas.`,
      };

      const ctas: Record<string, string> = {
        es: appt.meetingLink ? "Unirse a la reunion" : "Ver detalles",
        en: appt.meetingLink ? "Join meeting" : "View details",
        pt: appt.meetingLink ? "Entrar na reuniao" : "Ver detalhes",
      };

      const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F8F9FB;font-family:system-ui,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
<tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="background:#27295C;border-radius:16px 16px 0 0;padding:24px 32px;text-align:center;">
  <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="32" alt="FastForward">
</td></tr>
<tr><td style="background:white;padding:32px;border-radius:0 0 16px 16px;border:1px solid #E5E7EB;border-top:none;">
  <p style="font-size:13px;font-weight:600;color:#C9A84C;text-transform:uppercase;margin:0 0 8px;">
    ${isIn24h ? "Recordatorio 24 horas" : "Recordatorio 2 horas"}
  </p>
  <p style="font-size:20px;font-weight:700;color:#27295C;margin:0 0 8px;">Hola, ${appt.clientName}</p>
  <p style="font-size:14px;color:#6B7280;margin:0 0 24px;">${intros[lang] || intros.es}</p>
  <div style="background:#F8F9FB;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #E5E7EB;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:6px 0;border-bottom:1px solid #F0F0F0;">
        <span style="font-size:11px;color:#9CA3AF;text-transform:uppercase;">Fecha y hora</span><br>
        <span style="font-size:14px;font-weight:600;color:#27295C;">${formattedDate} · ${formattedTime}</span>
      </td></tr>
      <tr><td style="padding:6px 0;border-bottom:1px solid #F0F0F0;">
        <span style="font-size:11px;color:#9CA3AF;text-transform:uppercase;">Plataforma</span><br>
        <span style="font-size:14px;font-weight:600;color:#27295C;">${platformLabel}</span>
      </td></tr>
      <tr><td style="padding:6px 0;">
        <span style="font-size:11px;color:#9CA3AF;text-transform:uppercase;">Tu experto</span><br>
        <span style="font-size:14px;font-weight:600;color:#27295C;">${repName}</span>
      </td></tr>
    </table>
  </div>
  <a href="${appt.meetingLink || confirmUrl}"
     style="display:block;text-align:center;background:#C9A84C;color:#1A1C3E;padding:14px;border-radius:10px;font-weight:700;text-decoration:none;font-size:14px;margin-bottom:12px;">
    ${ctas[lang] || ctas.es} →
  </a>
  <a href="${confirmUrl}" style="display:block;text-align:center;color:#9CA3AF;font-size:12px;text-decoration:none;">
    Ver todos los detalles
  </a>
  <div style="border-top:1px solid #F0F0F0;padding-top:20px;margin-top:24px;text-align:center;">
    <p style="font-size:12px;color:#9CA3AF;margin:0;">FastForward FDA Experts · Miami, FL</p>
    <a href="https://fastfwdus.com" style="font-size:12px;color:#C9A84C;text-decoration:none;">fastfwdus.com</a>
  </div>
</td></tr>
</table></td></tr>
</table></body></html>`;

      try {
        await resend.emails.send({
          from: "FastForward FDA Experts <noreply@fastfwdus.com>",
          to: appt.clientEmail,
          subject: subjects[lang] || subjects.es,
          html,
        });
        await db.insert(remindersLog).values({
          appointmentId: appt.id, type: window.type,
          channel: "email", sentAt: new Date(), status: "sent",
        });
        results.sent++;
      } catch (err) {
        await db.insert(remindersLog).values({
          appointmentId: appt.id, type: window.type,
          channel: "email", sentAt: new Date(), status: "failed",
          errorMessage: String(err),
        });
        results.errors++;
      }
    }
  }

  return NextResponse.json({ ok: true, ...results, timestamp: now.toISOString() });
}
