import { Resend } from "resend";
import { portal } from "./portal-db";
import { getCase, type CaseRow } from "./queries";
import { sendWhatsAppTemplate } from "@/lib/adriana/whatsapp-sender";

const PORTAL_URL = "https://clients.fastfwdus.com";
const LOGO_WHITE = "https://scheduling.fastfwdus.com/brand/FF_Logo_06.png";
const WA_TEMPLATES = ["caso_estado", "caso_actualizacion"]; // preferencia: UTILITY primero

type Lang = "es" | "en";
export type UpdateKind = "stage_change" | "manual" | "completed";

function t(lang: Lang) {
  return lang === "en"
    ? {
        subject: (f: string) => `Update on your filing: ${f} — FastForward`,
        greeting: (n: string) => `Hello ${n},`,
        intro: (f: string) => `Here is the latest on your filing <strong>${f}</strong>:`,
        stage: (p: number, tot: number, name: string) => `Current stage: <strong>${p} of ${tot} — ${name}</strong>`,
        done: "Your filing has been <strong>completed</strong>. Thank you for trusting FastForward.",
        waitClient: (s: string) => `To move forward we need the following from you: <strong>${s}</strong>`,
        waitAuth: "We are now waiting for the authority to respond. We will let you know as soon as we hear back.",
        waitUs: (s: string) => `Our team is working on the next step${s ? `: <strong>${s}</strong>` : "."}`,
        cta: "View in client portal",
        contact: "Reply to this email or write to us on WhatsApp if you have any questions.",
        wa: (p: number, tot: number, name: string) => `now at stage ${p} of ${tot} (${name})`,
        waDone: "completed",
      }
    : {
        subject: (f: string) => `Actualización de su trámite: ${f} — FastForward`,
        greeting: (n: string) => `Hola ${n},`,
        intro: (f: string) => `Le compartimos la novedad de su trámite <strong>${f}</strong>:`,
        stage: (p: number, tot: number, name: string) => `Etapa actual: <strong>${p} de ${tot} — ${name}</strong>`,
        done: "Su trámite ha sido <strong>completado</strong>. Gracias por confiar en FastForward.",
        waitClient: (s: string) => `Para continuar necesitamos de su parte: <strong>${s}</strong>`,
        waitAuth: "Estamos a la espera de la respuesta de la autoridad. Le avisaremos apenas tengamos novedades.",
        waitUs: (s: string) => `Nuestro equipo está trabajando en el siguiente paso${s ? `: <strong>${s}</strong>` : "."}`,
        cta: "Ver en el portal de clientes",
        contact: "Si tiene alguna duda, responda este correo o escríbanos por WhatsApp.",
        wa: (p: number, tot: number, name: string) => `ahora en etapa ${p} de ${tot} (${name})`,
        waDone: "completado",
      };
}

export function buildStatusEmail(c: CaseRow) {
  const lang: Lang = c.language === "en" ? "en" : "es";
  const L = t(lang);
  const name = (c.contactName || c.company || "").split(" ")[0] || (lang === "en" ? "there" : "");
  const completed = !!c.closedAt && c.closedReason === "completed";
  const pct = c.stageTotal ? Math.round((c.stageDone / c.stageTotal) * 100) : 0;
  const detail = completed ? L.done : c.stageName ? L.stage(c.stagePos ?? 0, c.stageTotal, c.stageName) : "";
  let next = "";
  if (!completed) {
    if (c.waitingOn === "client" && c.nextStep) next = L.waitClient(c.nextStep);
    else if (c.waitingOn === "authority") next = L.waitAuth;
    else if (c.waitingOn === "us") next = L.waitUs(c.nextStep || "");
  }
  const html = `
<div style="font-family:system-ui,sans-serif;max-width:580px;margin:0 auto;padding:24px;">
  <div style="background:#0183FF;border-radius:16px 16px 0 0;padding:28px;text-align:center;">
    <img src="${LOGO_WHITE}" height="34" alt="FastForward">
  </div>
  <div style="background:white;border-radius:0 0 16px 16px;padding:32px;border:1px solid #E5E7EB;border-top:none;">
    <p style="font-size:18px;font-weight:700;color:#000;margin:0 0 8px;">${L.greeting(name)}</p>
    <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 18px;">${L.intro(c.filingName)}</p>
    <div style="background:#F8F9FB;border-radius:12px;padding:20px;margin-bottom:18px;">
      <p style="font-size:15px;color:#111;margin:0 0 10px;">${detail}</p>
      <div style="background:#E5E7EB;border-radius:6px;height:8px;overflow:hidden;"><div style="background:#0183FF;width:${completed ? 100 : pct}%;height:8px;"></div></div>
      ${next ? `<p style="font-size:14px;color:#374151;line-height:1.6;margin:14px 0 0;">${next}</p>` : ""}
    </div>
    <div style="text-align:center;margin:24px 0;">
      <a href="${PORTAL_URL}/my/filings/${c.id}" style="display:inline-block;background:#0183FF;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;">${L.cta}</a>
    </div>
    <p style="font-size:13px;color:#6B7280;margin:0 0 4px;">${L.contact}</p>
    <p style="font-size:13px;font-weight:600;color:#000;margin:0;">${c.agentName || "FastForward"} · FastForward FDA Experts</p>
    <div style="border-top:1px solid #F0F0F0;padding-top:20px;margin-top:24px;text-align:center;">
      <p style="font-size:12px;color:#9CA3AF;margin:0;">FastForward Trading Company LLC · 33 SW 2nd Ave, Suite 702, Miami, FL</p>
      <a href="https://fastfwdus.com" style="font-size:12px;color:#0183FF;">fastfwdus.com</a>
    </div>
  </div>
</div>`;
  const waStatus = completed ? L.waDone : c.stageName ? L.wa(c.stagePos ?? 0, c.stageTotal, c.stageName) : "";
  return { lang, subject: L.subject(c.filingName), html, waParams: [name, c.filingName, waStatus] };
}

let tplCache: { at: number; map: Map<string, string> } | null = null;
/** Devuelve el nombre de la plantilla aprobada para el idioma (prefiere caso_estado), o null. */
async function approvedTemplate(lang: Lang): Promise<string | null> {
  if (process.env.WA_STATUS_TEMPLATE_ENABLED === "0") return null;
  if (!tplCache || Date.now() - tplCache.at > 3600_000) {
    const map = new Map<string, string>();
    try {
      const waba = process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID;
      const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
      for (const name of WA_TEMPLATES) {
        const r = await fetch(`https://graph.facebook.com/v22.0/${waba}/message_templates?name=${name}&fields=name,language,status`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const j = (await r.json()) as { data?: { name: string; language: string; status: string }[] };
        for (const d of j.data || []) if (d.name === name && d.status === "APPROVED" && !map.has(d.language)) map.set(d.language, name);
      }
    } catch { /* sin red: se reintenta en la próxima */ }
    tplCache = { at: Date.now(), map };
  }
  return tplCache.map.get(lang) ?? null;
}

/** Envía la actualización al cliente por email (+ WhatsApp si la plantilla está habilitada) y deja registro. */
export async function sendStatusUpdate(filingId: string, actor: { email: string; name: string }, kind: UpdateKind) {
  const data = await getCase(filingId);
  if (!data) return { ok: false as const, error: "Caso no encontrado" };
  const c = data.case;
  const { lang, subject, html, waParams } = buildStatusEmail(c);
  const out: { email?: string; whatsapp?: string } = {};

  // Email
  const email = (c.email || "").toLowerCase();
  if (email && !email.endsWith("@no-email.fastfwdus.local")) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const r = await resend.emails.send({ from: "FastForward FDA Experts <info@fastfwdus.com>", to: email, subject, html, replyTo: c.agentEmail || "info@fastfwdus.com" });
      const err = (r as { error?: { message?: string } }).error;
      await portal`INSERT INTO case_notifications (filing_id, channel, kind, recipient, payload, status, error, sent_by)
                   VALUES (${filingId}, 'email', ${kind}, ${email}, ${portal.json({ subject })}, ${err ? "error" : "sent"}, ${err?.message ?? null}, ${actor.name})`;
      out.email = err ? `error: ${err.message}` : "enviado";
    } catch (e) {
      await portal`INSERT INTO case_notifications (filing_id, channel, kind, recipient, status, error, sent_by) VALUES (${filingId}, 'email', ${kind}, ${email}, 'error', ${String(e)}, ${actor.name})`;
      out.email = `error: ${String(e)}`;
    }
  } else out.email = "sin email";

  // WhatsApp (solo con plantilla aprobada en Meta; se verifica el estado con caché de 1 h)
  const phone = (c.whatsapp || c.phone || "").replace(/\D/g, "");
  const tpl = phone.length >= 8 ? await approvedTemplate(lang) : null;
  if (tpl) {
    const r = await sendWhatsAppTemplate({ toPhone: phone, templateName: tpl, languageCode: lang === "en" ? "en" : "es", bodyParams: waParams });
    await portal`INSERT INTO case_notifications (filing_id, channel, kind, recipient, payload, status, error, sent_by)
                 VALUES (${filingId}, 'whatsapp', ${kind}, ${phone}, ${portal.json({ template: tpl, params: waParams })}, ${r.ok ? "sent" : "error"}, ${r.error ?? null}, ${actor.name})`;
    out.whatsapp = r.ok ? "enviado" : `error: ${r.error}`;
  } else out.whatsapp = phone.length >= 8 ? "plantilla Meta aún no aprobada" : "sin teléfono";

  // Notificación in-app en el portal del cliente
  const bodyEs = c.closedAt ? `Su trámite "${c.filingName}" fue completado.` : `Su trámite "${c.filingName}" está en la etapa ${c.stagePos ?? "-"} de ${c.stageTotal}${c.stageName ? ` (${c.stageName})` : ""}.`;
  const bodyEn = c.closedAt ? `Your filing "${c.filingName}" has been completed.` : `Your filing "${c.filingName}" is at stage ${c.stagePos ?? "-"} of ${c.stageTotal}${c.stageName ? ` (${c.stageName})` : ""}.`;
  await portal`INSERT INTO notifications (recipient_type, recipient_id, type, title_es, title_en, body_es, body_en, payload, action_url, email_sent_at)
               VALUES ('client', ${c.clientId}, 'status_update', 'Actualización de su trámite', 'Filing update', ${bodyEs}, ${bodyEn}, ${portal.json({ filingId })}, ${`/my/filings/${filingId}`}, ${out.email === "enviado" ? new Date() : null})`;

  await portal`INSERT INTO case_comments (filing_id, author_email, author_name, kind, body)
               VALUES (${filingId}, ${actor.email}, ${actor.name}, 'system', ${`Aviso al cliente (${kind === "manual" ? "manual" : kind === "completed" ? "trámite completado" : "cambio de etapa"}) — email: ${out.email}; WhatsApp: ${out.whatsapp}`})`;
  return { ok: true as const, ...out };
}
