import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, users, clientProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { Resend } from "resend";
import { formatInTimeZone } from "date-fns-tz";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      clientName, clientEmail, clientCompany, clientWhatsapp,
      clientTimezone, clientLanguage, serviceInterest, exportVolume,
      platform, repSlug, utmSource, scheduledAt,
    } = body;

    if (!clientName || !clientEmail || !clientCompany || !clientWhatsapp || !scheduledAt || !platform) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    // Buscar sales rep
    let assignedTo: string | null = null;
    let assignedName = "";
    let status: "scheduled" | "pending_assignment" = "pending_assignment";

    if (repSlug && repSlug !== "general") {
      const [rep] = await db.select().from(users).where(eq(users.slug, repSlug)).limit(1);
      if (rep) {
        assignedTo = rep.id;
        assignedName = rep.fullName;
        status = "scheduled";
      }
    }

    const confirmToken = nanoid(32);

    const [appointment] = await db
      .insert(appointments)
      .values({
        clientName,
        clientEmail: clientEmail.toLowerCase().trim(),
        clientCompany,
        clientWhatsapp,
        clientTimezone: clientTimezone || "America/Argentina/Buenos_Aires",
        clientLanguage: clientLanguage || "es",
        serviceInterest,
        exportVolume,
        isB2b: true,
        platform,
        assignedTo,
        bookedVia: repSlug || "general",
        scheduledAt: new Date(scheduledAt),
        status,
        confirmToken,
        leadScore: "warm",
        utmSource,
      })
      .returning();

    // Upsert client profile
    await db
      .insert(clientProfiles)
      .values({
        email: clientEmail.toLowerCase().trim(),
        name: clientName,
        company: clientCompany,
        whatsapp: clientWhatsapp,
        timezone: clientTimezone,
        language: clientLanguage || "es",
        isB2b: true,
      })
      .onConflictDoUpdate({
        target: clientProfiles.email,
        set: { name: clientName, company: clientCompany, whatsapp: clientWhatsapp },
      });

    // Formatear fecha
    const tz = clientTimezone || "America/Argentina/Buenos_Aires";
    const slotDate = new Date(scheduledAt);
    const lang = clientLanguage || "es";
    const dateLocale = lang === "pt" ? "pt-BR" : lang === "en" ? "en-US" : "es-ES";
    const formattedDate = slotDate.toLocaleDateString(dateLocale, {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      timeZone: tz,
    });
    const formattedTime = formatInTimeZone(slotDate, tz, "h:mm a");

    const platformLabel = platform === "meet" ? "Google Meet" : platform === "zoom" ? "Zoom" : "WhatsApp";

    const subject = lang === "en"
      ? `Your meeting with FastForward is confirmed — ${formattedDate}`
      : lang === "pt"
      ? `Sua reunião com FastForward está confirmada — ${formattedDate}`
      : `Tu cita con FastForward está confirmada — ${formattedDate}`;

    const greeting = lang === "en" ? `Hi ${clientName},`
      : lang === "pt" ? `Olá ${clientName},`
      : `Hola ${clientName},`;

    const bodyIntro = lang === "en"
      ? `Your free consultation with FastForward ® | FDA Experts has been confirmed.`
      : lang === "pt"
      ? `Sua consulta gratuita com FastForward ® | FDA Experts foi confirmada.`
      : `Tu cita gratuita con FastForward ® | FDA Experts está confirmada.`;

    const pendingText = lang === "en"
      ? `We will confirm who will assist you shortly.`
      : lang === "pt"
      ? `Em breve confirmaremos quem vai atendê-lo.`
      : `En breve te confirmamos quién te atenderá.`;

    const assignedText = assignedName
      ? (lang === "en" ? `Your expert: <strong>${assignedName}</strong>` : lang === "pt" ? `Seu especialista: <strong>${assignedName}</strong>` : `Tu experto: <strong>${assignedName}</strong>`)
      : pendingText;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8F9FB;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FB;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

        <!-- Header -->
        <tr><td style="background:#27295C;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
          <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png"
               alt="FastForward ® | FDA Experts" height="36" style="object-fit:contain;">
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#ffffff;padding:32px;border-radius:0 0 16px 16px;border:1px solid #E5E7EB;border-top:none;">

          <!-- Check icon -->
          <div style="text-align:center;margin-bottom:24px;">
            <div style="width:56px;height:56px;background:rgba(201,168,76,0.12);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:24px;">✓</div>
          </div>

          <p style="font-size:22px;font-weight:700;color:#27295C;margin:0 0 8px;text-align:center;">${greeting}</p>
          <p style="font-size:15px;color:#6B7280;margin:0 0 28px;text-align:center;">${bodyIntro}</p>

          <!-- Appointment details -->
          <div style="background:#F8F9FB;border:1px solid #E5E7EB;border-radius:12px;padding:20px;margin-bottom:20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:6px 0;border-bottom:1px solid #F0F0F0;">
                  <span style="font-size:12px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;">📅 ${lang === "en" ? "Date & Time" : lang === "pt" ? "Data e Hora" : "Fecha y Hora"}</span><br>
                  <span style="font-size:14px;font-weight:600;color:#27295C;">${formattedDate} · ${formattedTime}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;border-bottom:1px solid #F0F0F0;">
                  <span style="font-size:12px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;">🎥 ${lang === "en" ? "Platform" : lang === "pt" ? "Plataforma" : "Plataforma"}</span><br>
                  <span style="font-size:14px;font-weight:600;color:#27295C;">${platformLabel}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;">
                  <span style="font-size:12px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;">👤 ${lang === "en" ? "Expert" : lang === "pt" ? "Especialista" : "Experto"}</span><br>
                  <span style="font-size:14px;font-weight:600;color:#27295C;">${assignedText}</span>
                </td>
              </tr>
            </table>
          </div>

          <p style="font-size:13px;color:#9CA3AF;text-align:center;margin:0 0 24px;">
            ${lang === "en" ? "You will receive a reminder 24h and 2h before your meeting." : lang === "pt" ? "Você receberá um lembrete 24h e 2h antes da reunião." : "Recibirás recordatorios 24h y 2h antes de tu cita."}
          </p>

          <!-- Footer -->
          <div style="border-top:1px solid #F0F0F0;padding-top:20px;text-align:center;">
            <p style="font-size:12px;color:#9CA3AF;margin:0;">FastForward ® | FDA Experts · Miami, FL</p>
            <p style="font-size:12px;color:#9CA3AF;margin:4px 0 0;">
              <a href="https://fastfwdus.com" style="color:#C9A84C;text-decoration:none;">fastfwdus.com</a>
            </p>
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // Send confirmation email
    try {
      await resend.emails.send({
        from: "FastForward ® | FDA Experts <noreply@fastfwdus.com>",
        to: clientEmail,
        subject,
        html,
      });

      // Notify admin/manager if unassigned
      if (status === "pending_assignment") {
        await resend.emails.send({
          from: "FastForward Scheduling <noreply@fastfwdus.com>",
          to: ["info@fastfwdus.com", "tmarino@fastfwdus.com"],
          subject: `⚡ Nueva cita sin asignar — ${clientName} (${clientCompany})`,
          html: `
            <p><strong>Nueva cita sin asignar</strong></p>
            <p><strong>Cliente:</strong> ${clientName} — ${clientCompany}</p>
            <p><strong>Email:</strong> ${clientEmail}</p>
            <p><strong>WhatsApp:</strong> ${clientWhatsapp}</p>
            <p><strong>Fecha:</strong> ${formattedDate} ${formattedTime} (Miami)</p>
            <p><strong>Plataforma:</strong> ${platformLabel}</p>
            <p><strong>Servicio:</strong> ${serviceInterest || "No especificado"}</p>
            <br>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/manager"
               style="background:#C9A84C;color:#27295C;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
              Asignar ahora →
            </a>
          `,
        });
      }
    } catch (emailErr) {
      console.error("Email error (non-fatal):", emailErr);
    }

    return NextResponse.json({
      ok: true,
      appointmentId: appointment.id,
      confirmToken,
      status: appointment.status,
      isPendingAssignment: status === "pending_assignment",
    });

  } catch (err) {
    console.error("Book error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
