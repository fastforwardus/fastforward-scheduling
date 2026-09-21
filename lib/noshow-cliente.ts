import { db } from "@/db";
import { users, remindersLog } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { Resend } from "resend";
import { sendWhatsAppTemplate } from "@/lib/adriana/whatsapp-sender";
import { calidadWhatsApp } from "@/lib/calidad-wa";

export interface NoShowAppt {
  id: string;
  clientName: string | null;
  clientEmail: string;
  clientWhatsapp: string | null;
  clientLanguage: string | null;
  assignedTo: string | null;
}

// Mensaje de reagendar al cliente (email + WhatsApp). Se llama SOLO cuando el
// rep marca No-show en el dashboard: el cron ya no asume no-show por falta de
// outcome, porque le escribia a clientes que si habian tenido la cita.
export async function enviarNoShowCliente(appt: NoShowAppt, opts: { test?: boolean } = {}) {
  const test = !!opts.test;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const resultado = { email: "omitido", whatsapp: "omitido" };

  let lang: string = appt.clientLanguage || "es";
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

  // ── Email ──
  const yaEmail = test ? [] : await db.select().from(remindersLog).where(
    and(eq(remindersLog.appointmentId, appt.id),
        eq(remindersLog.type, "noshow_client"),
        eq(remindersLog.channel, "email"))
  ).limit(1);

  if (!yaEmail.length) {
    try {
      await resend.emails.send({
        from: "FastForward FDA Experts <noreply@fastfwdus.com>",
        to: appt.clientEmail,
        subject: subjects[lang] || subjects.es,
        html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  <div style="background:#000000;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
    <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="32" alt="FastForward">
  </div>
  <div style="background:white;border-radius:12px;padding:24px;border:1px solid #E5E7EB;">
    <p style="font-size:16px;font-weight:700;color:#000000;margin:0 0 14px;">${saludos[lang] || saludos.es}</p>
    <p style="color:#4B5563;font-size:14px;line-height:1.6;margin:0 0 20px;">${bodies[lang] || bodies.es}</p>
    <a href="${linkReagendar}" style="display:block;text-align:center;background:#0183FF;color:#000000;padding:14px;border-radius:10px;font-weight:700;text-decoration:none;font-size:14px;">
      ${ctas[lang] || ctas.es} →
    </a>
    <p style="color:#6B7280;font-size:13px;line-height:1.6;margin:18px 0 0;">${cierres[lang] || cierres.es}</p>
    <p style="color:#000000;font-size:13px;font-weight:600;margin:16px 0 0;">Carlos Bisio<br>
      <span style="color:#9CA3AF;font-weight:400;">FastForward Trading Company LLC</span></p>
  </div>
</div>`,
      });
      resultado.email = "sent";
      if (!test) await db.insert(remindersLog).values({
        appointmentId: appt.id, type: "noshow_client",
        channel: "email", sentAt: new Date(), status: "sent",
      });
    } catch (err) {
      resultado.email = "failed";
      if (!test) await db.insert(remindersLog).values({
        appointmentId: appt.id, type: "noshow_client",
        channel: "email", sentAt: new Date(), status: "failed", errorMessage: String(err),
      });
    }
  }

  // ── WhatsApp ── en LATAM convierte bastante mejor que el email. Con el
  // numero degradado no se inician conversaciones nuevas.
  if (!test && appt.clientWhatsapp) {
    const cal = await calidadWhatsApp();
    if (!cal.ok) {
      console.warn("[noshow] WhatsApp frenado — calidad:", cal.rating);
    } else {
      const yaWa = await db.select().from(remindersLog).where(
        and(eq(remindersLog.appointmentId, appt.id),
            eq(remindersLog.type, "noshow_client"),
            eq(remindersLog.channel, "whatsapp"))
      ).limit(1);
      if (!yaWa.length) {
        try {
          const r = await sendWhatsAppTemplate({
            toPhone: appt.clientWhatsapp.replace(/\D/g, ""),
            templateName: "noshow_reagendar",
            languageCode: lang === "pt" ? "pt_BR" : lang,
            bodyParams: [primerNombre],
          });
          resultado.whatsapp = r?.ok === false ? "failed" : "sent";
          await db.insert(remindersLog).values({
            appointmentId: appt.id, type: "noshow_client",
            channel: "whatsapp", sentAt: new Date(),
            status: r?.ok === false ? "failed" : "sent",
            errorMessage: r?.ok === false ? String(r.error).slice(0, 240) : null,
          });
        } catch (err) {
          console.error("[noshow] wa error:", err);
          resultado.whatsapp = "failed";
          await db.insert(remindersLog).values({
            appointmentId: appt.id, type: "noshow_client",
            channel: "whatsapp", sentAt: new Date(), status: "failed",
            errorMessage: String(err).slice(0, 240),
          });
        }
      }
    }
  }

  return resultado;
}
