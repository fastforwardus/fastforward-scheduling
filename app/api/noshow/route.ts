import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, users, remindersLog } from "@/db/schema";
import { and, eq, lte, gte } from "drizzle-orm";
import { Resend } from "resend";
import { sendWhatsAppTemplate } from "@/lib/adriana/whatsapp-sender";

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
      and(eq(remindersLog.appointmentId, appt.id),
          eq(remindersLog.type, "noshow_client"),
          eq(remindersLog.channel, "email"))
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

    let linkReagendar = `${appUrl}/book`;
    if (appt.assignedTo) {
      const [r] = await db.select({ slug: users.slug }).from(users)
        .where(eq(users.id, appt.assignedTo)).limit(1);
      if (r?.slug) linkReagendar = `${appUrl}/book/${r.slug}`;
    }

    // Sin reproche: "le esperabamos" suena a reclamo y el que no aparecio
    // sigue siendo un lead que agendo por voluntad propia.
    const primerNombre = (appt.clientName || "").split(" ")[0] || "";

    const subjects: Record<string, string> = {
      es: "¿Reagendamos tu llamada?",
      en: "Shall we reschedule your call?",
      pt: "Vamos remarcar sua ligação?",
    };

    const saludos: Record<string, string> = {
      es: `Hola ${primerNombre},`,
      en: `Hi ${primerNombre},`,
      pt: `Olá ${primerNombre},`,
    };

    const bodies: Record<string, string> = {
      es: "Teníamos una llamada agendada y no pudimos conectar. Pasa seguido, no hay problema.<br><br>Si el tema sigue en pie, elige un horario nuevo acá y lo dejamos coordinado:",
      en: "We had a call scheduled and couldn't connect. It happens, no problem at all.<br><br>If you're still interested, pick a new time here and we'll get it set:",
      pt: "Tínhamos uma ligação agendada e não conseguimos conectar. Acontece, sem problema.<br><br>Se o assunto continua de pé, escolha um novo horário aqui e deixamos combinado:",
    };

    const cierres: Record<string, string> = {
      es: "Si prefieres, responde este correo y lo vemos.",
      en: "If you'd rather, just reply to this email and we'll sort it out.",
      pt: "Se preferir, responda este e-mail que a gente resolve.",
    };

    const ctas: Record<string, string> = {
      es: "Elegir otro horario",
      en: "Pick another time",
      pt: "Escolher outro horário",
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
    <p style="font-size:16px;font-weight:700;color:#27295C;margin:0 0 14px;">${saludos[lang] || saludos.es}</p>
    <p style="color:#4B5563;font-size:14px;line-height:1.6;margin:0 0 20px;">${bodies[lang] || bodies.es}</p>
    <a href="${linkReagendar}" style="display:block;text-align:center;background:#C9A84C;color:#1A1C3E;padding:14px;border-radius:10px;font-weight:700;text-decoration:none;font-size:14px;">
      ${ctas[lang] || ctas.es} →
    </a>
    <p style="color:#6B7280;font-size:13px;line-height:1.6;margin:18px 0 0;">${cierres[lang] || cierres.es}</p>
    <p style="color:#27295C;font-size:13px;font-weight:600;margin:16px 0 0;">Carlos Bisio<br>
      <span style="color:#9CA3AF;font-weight:400;">FastForward Trading Company LLC</span></p>
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

    // WhatsApp ademas del email: en LATAM convierte bastante mejor, y el que
    // no aparecio a una cita que el mismo agendo sigue siendo un lead tibio.
    if (appt.clientWhatsapp) {
      const yaWa = await db.select().from(remindersLog).where(
        and(eq(remindersLog.appointmentId, appt.id),
            eq(remindersLog.type, "noshow_client"),
            eq(remindersLog.channel, "whatsapp"))
      ).limit(1);
      if (!yaWa.length) {
        try {
          const nombre = (appt.clientName || "").split(" ")[0] || "";
          const r = await sendWhatsAppTemplate({
            toPhone: appt.clientWhatsapp.replace(/\D/g, ""),
            templateName: "noshow_reagendar",
            languageCode: lang === "pt" ? "pt_BR" : lang,
            bodyParams: [nombre],
          });
          await db.insert(remindersLog).values({
            appointmentId: appt.id, type: "noshow_client",
            channel: "whatsapp", sentAt: new Date(),
            status: r?.ok === false ? "failed" : "sent",
            errorMessage: r?.ok === false ? String(r.error).slice(0, 240) : null,
          });
        } catch (err) {
          console.error("[noshow] wa error:", err);
          await db.insert(remindersLog).values({
            appointmentId: appt.id, type: "noshow_client",
            channel: "whatsapp", sentAt: new Date(), status: "failed",
            errorMessage: String(err).slice(0, 240),
          });
        }
      }
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
