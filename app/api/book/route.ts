export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, users, clientProfiles, systemConfig } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { Resend } from "resend";
import { createOrUpdateZohoLead } from "@/lib/zoho";
import { formatInTimeZone } from "date-fns-tz";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      clientName, clientEmail, clientCompany, clientWhatsapp,
      clientTimezone, clientLanguage, serviceInterest, exportVolume,
      platform, repSlug, utmSource, scheduledAt, partnerSlug, clientNotes,
    } = body;

    if (!clientName || !clientEmail || !clientCompany || !clientWhatsapp || !scheduledAt || !platform) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    // Limpiar número — solo dígitos con código de país
    const cleanPhone = clientWhatsapp.replace(/\D/g, "");

    // Detectar idioma por código de país como fallback
    const ptCodes = ["55", "351"];
    const enCodes = ["1"];
    let detectedLang = clientLanguage || "es";
    if (!clientLanguage) {
      if (ptCodes.some(c => cleanPhone.startsWith(c))) detectedLang = "pt";
      else if (enCodes.some(c => cleanPhone.startsWith(c))) detectedLang = "en";
    }

    // Buscar sales rep
    let assignedTo: string | null = null;
    let assignedEmail: string | null = null;
    let assignedName = "";
    let status: "scheduled" | "pending_assignment" = "pending_assignment";

    if (repSlug && repSlug !== "general") {
      const [rep] = await db.select().from(users).where(eq(users.slug, repSlug)).limit(1);
      if (rep) {
        assignedTo = rep.id;
        assignedName = rep.fullName;
        assignedEmail = rep.email;
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
        clientWhatsapp: cleanPhone,
        clientTimezone: clientTimezone || "America/Argentina/Buenos_Aires",
        clientLanguage: detectedLang as "es" | "en" | "pt",
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
        partnerSlug: partnerSlug || null,
        clientNotes: clientNotes || null,
      })
      .returning();

    // Notify partner if referral
    if (partnerSlug) {
      try {
        const { partners } = await import("@/db/schema");
        const { eq: eqP } = await import("drizzle-orm");
        const [partner] = await db.select({ name: partners.name, email: partners.email })
          .from(partners).where(eqP(partners.slug, partnerSlug)).limit(1);
        if (partner) {
          await resend.emails.send({
            from: "FastForward <info@fastfwdus.com>",
            replyTo: "info@fastfwdus.com",
            to: partner.email,
            subject: `Nuevo referido: ${clientName} (${clientCompany})`,
            html: `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  <div style="background:#27295C;border-radius:16px 16px 0 0;padding:28px;text-align:center;">
    <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="32" alt="FastForward">
  </div>
  <div style="background:white;border-radius:0 0 16px 16px;padding:32px;border:1px solid #E5E7EB;border-top:none;">
    <p style="font-size:18px;font-weight:700;color:#27295C;margin:0 0 8px;">Hola, ${partner.name} 👋</p>
    <p style="color:#6B7280;font-size:14px;margin:0 0 20px;">¡Uno de tus referidos acaba de agendar una consulta con FastForward!</p>
    <div style="background:#F8F9FB;border-radius:12px;padding:16px;margin-bottom:24px;border:1px solid #E5E7EB;">
      <p style="font-size:11px;color:#9CA3AF;margin:0 0 4px;text-transform:uppercase;">Cliente</p>
      <p style="font-size:15px;font-weight:700;color:#27295C;margin:0 0 2px;">${clientName}</p>
      <p style="font-size:13px;color:#6B7280;margin:0 0 12px;">${clientCompany}</p>
      <p style="font-size:11px;color:#9CA3AF;margin:0 0 4px;text-transform:uppercase;">Email</p>
      <p style="font-size:13px;color:#374151;margin:0 0 12px;">${clientEmail}</p>
      <p style="font-size:11px;color:#9CA3AF;margin:0 0 4px;text-transform:uppercase;">WhatsApp</p>
      <p style="font-size:13px;color:#374151;margin:0;">${clientWhatsapp}</p>
    </div>
    <p style="font-size:13px;color:#6B7280;margin:0;">Podés seguir el estado de tus referidos en tu portal de partner.</p>
    <div style="border-top:1px solid #F0F0F0;padding-top:20px;margin-top:20px;text-align:center;">
      <p style="font-size:12px;color:#9CA3AF;">FastForward Trading Company LLC · Miami, FL</p>
    </div>
  </div>
</div>`,
          });
        }
      } catch (err) { console.error("Partner notify error:", err); }
    }

    // Upsert client profile
    await db
      .insert(clientProfiles)
      .values({
        email: clientEmail.toLowerCase().trim(),
        name: clientName,
        company: clientCompany,
        whatsapp: cleanPhone,
        timezone: clientTimezone,
        language: detectedLang as "es" | "en" | "pt",
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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fastforward-scheduling.vercel.app";
    const meetingLinkHtml = platform === "whatsapp"
      ? `<span style="font-size:14px;font-weight:600;color:#27295C;">📞 ${clientWhatsapp}</span>`
      : `<a href="${appUrl}/book/confirm/${confirmToken}" style="font-size:14px;font-weight:600;color:#C9A84C;text-decoration:none;">
          ${lang === "en" ? "Click here to get your meeting link" : lang === "pt" ? "Clique aqui para obter o link da reunião" : "Haga clic para obtener el enlace de la reunión"} →
         </a>`;

    const subject = lang === "en"
      ? `Meeting confirmed - FastForward FDA Experts - ${formattedDate}`
      : lang === "pt"
      ? `Reunião confirmada - FastForward FDA Experts - ${formattedDate}`
      : `Cita confirmada - FastForward FDA Experts - ${formattedDate}`;

    const greeting = lang === "en" ? `Hi ${clientName},`
      : lang === "pt" ? `Olá ${clientName},`
      : `Estimado/a ${clientName},`;

    const bodyIntro = lang === "en"
      ? `Your free consultation with FastForward ® | FDA Experts has been confirmed.`
      : lang === "pt"
      ? `Sua consulta gratuita com FastForward ® | FDA Experts foi confirmada.`
      : `Su consulta gratuita con FastForward ® | FDA Experts ha sido confirmada.`;

    const pendingText = lang === "en"
      ? `We will confirm who will assist you shortly.`
      : lang === "pt"
      ? `Em breve confirmaremos quem vai atendê-lo.`
      : `En breve le confirmaremos quién le atenderá.`;

    const assignedText = assignedName
      ? (lang === "en" ? `Your expert: <strong>${assignedName}</strong>` : lang === "pt" ? `Seu especialista: <strong>${assignedName}</strong>` : `Su experto: <strong>${assignedName}</strong>`)
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
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td align="center">
              <table cellpadding="0" cellspacing="0">
                <tr><td width="56" height="56" align="center" valign="middle"
                    style="background:#C9A84C;border-radius:28px;font-size:26px;color:#ffffff;font-weight:700;line-height:56px;">
                  ✓
                </td></tr>
              </table>
            </td></tr>
          </table>

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
                <td style="padding:6px 0;border-bottom:1px solid #F0F0F0;">
                  <span style="font-size:12px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;">🔗 ${lang === "en" ? "Meeting Link" : lang === "pt" ? "Link da Reunião" : "Link de la reunión"}</span><br>
                  ${meetingLinkHtml}
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
            ${lang === "en" ? "You will receive a reminder 24h and 2h before your meeting." : lang === "pt" ? "Você receberá um lembrete 24h e 2h antes da reunião." : "Recibirá recordatorios 24h y 2h antes de su consulta."}
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
        from: "FastForward FDA Experts <noreply@fastfwdus.com>",
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

    // Zoho CRM sync
    try {
      await createOrUpdateZohoLead({
        clientName,
        clientEmail: clientEmail.toLowerCase().trim(),
        clientCompany,
        clientWhatsapp,
        clientLanguage,
        serviceInterest,
        exportVolume,
        clientNotes,
        repName: assignedName || undefined,
        repEmail: repSlug && repSlug !== "general" ? (await db.select({ email: users.email }).from(users).where(eq(users.slug, repSlug)).limit(1))[0]?.email : undefined,
        noteToAdd: `[${new Date().toLocaleString("es-ES", { timeZone: "America/New_York" })}] Nueva cita agendada — Plataforma: ${platform}`,
      });
      console.log("ZOHO OK:", clientEmail);
      // Notify rep of new lead
      if (assignedEmail && assignedName) {
        const apptDate = new Date(scheduledAt).toLocaleString("es-ES", { timeZone: "America/New_York", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
        const serviceLabel: Record<string, string> = { fda_fsma: "Registro FDA / FSMA", register_company: "Apertura de Empresa", market_entry: "Ingreso al Mercado", not_sure: "Sin definir" };
        await resend.emails.send({
          from: "FastForward Sistema <info@fastfwdus.com>",
          to: assignedEmail,
          subject: `🎯 Nuevo lead asignado — ${clientName}`,
          html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:system-ui,sans-serif;background:#F8F9FB;margin:0;padding:0}*{box-sizing:border-box}</style></head><body>
<div style="max-width:580px;margin:0 auto;padding:24px">
  <div style="background:linear-gradient(135deg,#27295C,#1e2150);border-radius:20px;padding:32px;text-align:center;margin-bottom:20px">
    <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="36" style="margin-bottom:16px" />
    <p style="color:rgba(201,168,76,0.9);font-size:13px;font-weight:600;margin:0 0 8px;text-transform:uppercase;letter-spacing:2px">Nuevo Lead Asignado</p>
    <h1 style="color:white;font-size:26px;font-weight:800;margin:0">${clientName}</h1>
    <p style="color:rgba(255,255,255,0.6);font-size:14px;margin:8px 0 0">${clientCompany}</p>
  </div>

  <div style="background:white;border-radius:16px;padding:24px;margin-bottom:16px;border:1px solid #E5E7EB">
    <p style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;margin:0 0 16px">Datos del Lead</p>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:8px 0;color:#6B7280;font-size:13px;width:130px">Nombre</td><td style="padding:8px 0;color:#27295C;font-size:13px;font-weight:600">${clientName}</td></tr>
      <tr style="border-top:1px solid #F3F4F6"><td style="padding:8px 0;color:#6B7280;font-size:13px">Empresa</td><td style="padding:8px 0;color:#27295C;font-size:13px;font-weight:600">${clientCompany}</td></tr>
      <tr style="border-top:1px solid #F3F4F6"><td style="padding:8px 0;color:#6B7280;font-size:13px">Email</td><td style="padding:8px 0;font-size:13px"><a href="mailto:${clientEmail}" style="color:#C9A84C">${clientEmail}</a></td></tr>
      <tr style="border-top:1px solid #F3F4F6"><td style="padding:8px 0;color:#6B7280;font-size:13px">WhatsApp</td><td style="padding:8px 0;color:#27295C;font-size:13px;font-weight:600">${clientWhatsapp}</td></tr>
      <tr style="border-top:1px solid #F3F4F6"><td style="padding:8px 0;color:#6B7280;font-size:13px">Servicio</td><td style="padding:8px 0;color:#27295C;font-size:13px;font-weight:600">${serviceLabel[serviceInterest] || serviceInterest || "Sin definir"}</td></tr>
      <tr style="border-top:1px solid #F3F4F6"><td style="padding:8px 0;color:#6B7280;font-size:13px">Cita</td><td style="padding:8px 0;color:#27295C;font-size:13px;font-weight:600">${apptDate} (EST)</td></tr>
      <tr style="border-top:1px solid #F3F4F6"><td style="padding:8px 0;color:#6B7280;font-size:13px">Plataforma</td><td style="padding:8px 0;color:#27295C;font-size:13px;font-weight:600">${platform === "meet" ? "Google Meet" : "WhatsApp"}</td></tr>
      ${clientNotes ? `<tr style="border-top:1px solid #F3F4F6"><td style="padding:8px 0;color:#6B7280;font-size:13px">Notas</td><td style="padding:8px 0;color:#27295C;font-size:13px">${clientNotes}</td></tr>` : ""}
    </table>
  </div>

  <div style="background:#EEF2FF;border-radius:16px;padding:20px;margin-bottom:16px;border:1px solid #C7D2FE">
    <p style="font-size:13px;font-weight:700;color:#27295C;margin:0 0 8px">📋 Cómo dar seguimiento en Zoho CRM</p>
    <p style="font-size:13px;color:#374151;margin:0 0 8px">Este lead ya está registrado en Zoho CRM con vos como owner. Para darle seguimiento:</p>
    <ol style="font-size:13px;color:#374151;margin:0;padding-left:20px;line-height:2">
      <li>Abrí Zoho CRM → <strong>Leads</strong></li>
      <li>Buscá por email: <strong>${clientEmail}</strong></li>
      <li>En la sección <strong>Notas</strong> vas a ver toda la cronología de actividades (cita agendada, propuesta enviada, aceptación, etc.)</li>
      <li>Podés agregar tus propias notas, llamadas y seguimientos desde ahí</li>
    </ol>
  </div>

  <div style="text-align:center;padding:16px">
    <a href="https://scheduling.fastfwdus.com/dashboard" style="display:inline-block;background:#C9A84C;color:#1A1C3E;padding:14px 32px;border-radius:12px;font-weight:700;text-decoration:none;font-size:14px">Ver en el Dashboard →</a>
  </div>

  <p style="text-align:center;font-size:11px;color:#9CA3AF;margin:16px 0 0">FastForward FDA Experts · Miami, FL</p>
</div>
</body></html>`,
        });
      }
    } catch (zohoErr) {
      console.error("ZOHO FAIL:", String(zohoErr));
      // Save error to DB for debugging
      await db.insert(systemConfig).values({ key: "ZOHO_LAST_ERROR", value: String(zohoErr) })
        .onConflictDoUpdate({ target: systemConfig.key, set: { value: String(zohoErr), updatedAt: new Date() } })
        .catch(() => {});
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
