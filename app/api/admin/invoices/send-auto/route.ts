export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { proposals } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { Resend } from "resend";
import { getZohoBooksInvoicePdf } from "@/lib/zohobooks";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const internalKey = req.headers.get("x-internal-key");
  if (internalKey !== (process.env.INTERNAL_API_KEY || "ff-internal-2024"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { proposalId } = await req.json();
  if (!proposalId) return NextResponse.json({ error: "proposalId requerido" }, { status: 400 });

  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
  if (!proposal || !proposal.zohoInvoiceId) return NextResponse.json({ error: "No invoice" }, { status: 404 });

  // Obtener email del cliente
  let clientName = (proposal as Record<string, unknown>).clientName as string || "";
  let clientEmail = (proposal as Record<string, unknown>).clientEmail as string || "";

  if (!clientEmail && proposal.appointmentId && !proposal.appointmentId.startsWith("direct-")) {
    const rows = await db.execute(sql`SELECT client_name, client_email FROM appointments WHERE id::text = ${proposal.appointmentId} LIMIT 1`);
    clientName = ((Array.isArray(rows) ? rows[0] : undefined) as Record<string, string> | undefined)?.client_name || clientName;
    clientEmail = ((Array.isArray(rows) ? rows[0] : undefined) as Record<string, string> | undefined)?.client_email || clientEmail;
  }

  if (!clientEmail) return NextResponse.json({ error: "No client email" }, { status: 400 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";
  const payLink = (proposal as Record<string,unknown>).zohoPaymentLink as string || `${appUrl}/pay/${proposal.confirmToken}`;
  const lang = (proposal.lang || "es") as "es" | "en" | "pt";
  // total y discount son numeric en la base: el driver los entrega como string.
  const fmt = (n: number | string) => "$" + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

  // Un solo correo bilingue: espanol arriba, ingles abajo.
  const L = {
    subject: `Factura / Invoice ${proposal.proposalNum} — FastForward`,
    es: {
      greeting: `Hola ${clientName},`,
      intro: "Adjuntamos la factura correspondiente al servicio contratado. Puede abonarla en linea con el boton de abajo o descargar el PDF adjunto.",
      detalle: "Detalle",
      due: "Total a pagar",
      payBtn: "Ver y pagar factura",
      seguro: "Pago seguro procesado por Stripe",
      dudas: "Cualquier consulta, responda a este correo.",
    },
    en: {
      greeting: `Hello ${clientName},`,
      intro: "Attached is the invoice for the contracted service. You can pay online using the button below or download the attached PDF.",
      detalle: "Details",
      due: "Amount due",
      payBtn: "View and pay invoice",
      seguro: "Secure payment processed by Stripe",
      dudas: "If you have any questions, just reply to this email.",
    },
  };
  const services = (typeof proposal.services === "string" ? JSON.parse(proposal.services || "[]") : proposal.services) as { name: string; price: number }[];

  let pdfBuffer: Buffer | null = null;
  try { pdfBuffer = await getZohoBooksInvoicePdf(proposal.zohoInvoiceId); } catch {}

  const filas = services.map(sv => `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #eef0f3;color:#3f4753;font-size:14px;line-height:1.4;">${sv.name}</td>
    <td style="padding:10px 0;border-bottom:1px solid #eef0f3;color:#11161d;font-size:14px;font-weight:600;text-align:right;white-space:nowrap;">${fmt(sv.price)}</td>
  </tr>`).join("");

  const bloque = (t: typeof L.es, idioma: string) => `
  <tr><td style="padding:0 36px 4px;">
    <p style="margin:0 0 6px;color:#9aa3af;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;">${idioma}</p>
    <p style="margin:0 0 10px;color:#11161d;font-size:16px;font-weight:600;">${t.greeting}</p>
    <p style="margin:0 0 22px;color:#5b6472;font-size:14px;line-height:1.65;">${t.intro}</p>
  </td></tr>`;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eef1f5;font-family:-apple-system,'Segoe UI','Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;padding:32px 12px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(16,24,40,.08);">

<tr><td style="background:#0d1117;padding:26px 36px;">
<img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" alt="FastForward" height="30">
</td></tr>

<tr><td style="background:linear-gradient(180deg,#151b24,#0d1117);padding:34px 36px;text-align:center;">
<p style="margin:0 0 6px;color:#8b95a5;font-size:11px;letter-spacing:2px;text-transform:uppercase;">${L.es.due} · ${L.en.due}</p>
<p style="margin:0;color:#fff;font-size:44px;font-weight:700;letter-spacing:-1px;">${fmt(proposal.total)}</p>
<p style="margin:10px 0 0;color:#6b7480;font-size:13px;">${proposal.proposalNum}</p>
</td></tr>

<tr><td style="height:28px;"></td></tr>
${bloque(L.es, "Espa\u00f1ol")}
<tr><td style="padding:6px 36px 20px;"><div style="height:1px;background:#eef0f3;"></div></td></tr>
${bloque(L.en, "English")}

<tr><td style="padding:8px 36px 0;">
<p style="margin:0 0 8px;color:#9aa3af;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;">${L.es.detalle} · ${L.en.detalle}</p>
<table width="100%" style="border-collapse:collapse;">${filas}</table>
</td></tr>

<tr><td style="padding:26px 36px 8px;" align="center">
<a href="${payLink}" style="display:inline-block;background:#1a56db;color:#fff;text-decoration:none;padding:15px 40px;border-radius:9px;font-size:15px;font-weight:600;">${L.es.payBtn} · ${L.en.payBtn}</a>
</td></tr>

<tr><td style="padding:14px 36px 30px;text-align:center;">
<p style="margin:0 0 4px;color:#9aa3af;font-size:12px;">${L.es.seguro} · ${L.en.seguro}</p>
<p style="margin:0;color:#9aa3af;font-size:12px;">${L.es.dudas}</p>
</td></tr>

<tr><td style="background:#f7f8fa;padding:18px 36px;text-align:center;border-top:1px solid #eef0f3;">
<p style="margin:0;color:#9aa3af;font-size:11px;line-height:1.6;">FastForward Trading Company LLC · 33 SW 2nd Ave, Suite 702, Miami, FL 33130<br>info@fastfwdus.com · fastfwdus.com</p>
</td></tr>

</table>
</td></tr>
</table>
</body></html>`;
  await resend.emails.send({
    from: "FastForward <info@fastfwdus.com>",
    to: clientEmail,
    replyTo: "info@fastfwdus.com",
    subject: L.subject,
    html,
    ...(pdfBuffer ? { attachments: [{ filename: `Factura-FastForward-${proposal.proposalNum}.pdf`, content: pdfBuffer.toString("base64") }] } : {}),
  });

  await db.update(proposals).set({ invoiceSentAt: new Date() }).where(eq(proposals.id, proposalId));
  return NextResponse.json({ ok: true });
}
