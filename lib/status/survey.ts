import { randomBytes } from "crypto";
import { Resend } from "resend";
import { portal } from "./portal-db";
import { getCase } from "./queries";

const LOGO_WHITE = "https://scheduling.fastfwdus.com/brand/FF_Logo_06.png";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";

export async function sendCloseSurvey(filingId: string) {
  const data = await getCase(filingId);
  if (!data) return { ok: false, error: "no case" };
  const c = data.case;
  const email = (c.email || "").toLowerCase();
  if (!email || email.endsWith("@no-email.fastfwdus.local")) return { ok: false, error: "sin email" };
  const token = randomBytes(16).toString("hex");
  await portal`UPDATE case_meta SET survey_token = ${token}, updated_at = now() WHERE filing_id = ${filingId}`;
  const en = c.language === "en";
  const name = (c.contactName || c.company || "").split(" ")[0];
  const link = (s: number) => `${APP_URL}/api/status/encuesta/${token}?s=${s}`;
  const face = (s: number, emoji: string, label: string) => `<a href="${link(s)}" style="display:inline-block;margin:0 10px;text-decoration:none;text-align:center;"><div style="font-size:44px;line-height:1;">${emoji}</div><div style="font-size:12px;color:#6B7280;margin-top:6px;">${label}</div></a>`;
  const html = `
<div style="font-family:system-ui,sans-serif;max-width:580px;margin:0 auto;padding:24px;">
  <div style="background:#0183FF;border-radius:16px 16px 0 0;padding:28px;text-align:center;"><img src="${LOGO_WHITE}" height="34" alt="FastForward"></div>
  <div style="background:white;border-radius:0 0 16px 16px;padding:32px;border:1px solid #E5E7EB;border-top:none;text-align:center;">
    <p style="font-size:18px;font-weight:700;color:#000;margin:0 0 8px;">${en ? `Hello ${name},` : `Hola ${name},`}</p>
    <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 24px;">${en ? `Your filing <strong>${c.filingName}</strong> is complete. How was your experience with FastForward? One click is enough:` : `Su trámite <strong>${c.filingName}</strong> quedó completado. ¿Cómo fue su experiencia con FastForward? Con un clic alcanza:`}</p>
    <div style="margin:10px 0 28px;">${face(1, "☹️", en ? "Poor" : "Mala")}${face(2, "😐", en ? "OK" : "Regular")}${face(3, "😊", en ? "Great" : "Excelente")}</div>
    <p style="font-size:13px;color:#6B7280;margin:0;">${c.agentName || "FastForward"} · FastForward FDA Experts</p>
    <div style="border-top:1px solid #F0F0F0;padding-top:20px;margin-top:24px;"><p style="font-size:12px;color:#9CA3AF;margin:0;">FastForward Trading Company LLC · Miami, FL</p></div>
  </div>
</div>`;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const r = await resend.emails.send({ from: "FastForward FDA Experts <info@fastfwdus.com>", to: email, subject: en ? `How was your experience? — ${c.filingName}` : `¿Cómo fue su experiencia? — ${c.filingName}`, html, replyTo: c.agentEmail || "info@fastfwdus.com" });
  const err = (r as { error?: { message?: string } }).error;
  await portal`INSERT INTO case_notifications (filing_id, channel, kind, recipient, status, error, sent_by) VALUES (${filingId}, 'email', 'survey', ${email}, ${err ? "error" : "sent"}, ${err?.message ?? null}, 'Sistema')`;
  return { ok: !err, error: err?.message };
}
