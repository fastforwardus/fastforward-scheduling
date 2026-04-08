export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { proposals, appointments } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { Resend } from "resend";
import { getZohoBooksInvoice, getZohoBooksInvoicePdf } from "@/lib/zohobooks";

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
    const rows = await db.execute(sql`SELECT client_name, client_email FROM appointments WHERE id::text = ${proposal.appointmentId} LIMIT 1`) as unknown as { rows: { client_name: string; client_email: string }[] };
    clientName = rows.rows?.[0]?.client_name || clientName;
    clientEmail = rows.rows?.[0]?.client_email || clientEmail;
  }

  if (!clientEmail) return NextResponse.json({ error: "No client email" }, { status: 400 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";
  const payLink = `${appUrl}/pay/${proposal.confirmToken}`;
  const lang = (proposal.lang || "es") as "es" | "en" | "pt";
  const fmt = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2 });

  const L = lang === "en"
    ? { subject: `Invoice ${proposal.proposalNum} — FastForward`, greeting: `Hello ${clientName},`, intro: "Please find attached the invoice for the requested service.", payBtn: "View & Pay Invoice" }
    : lang === "pt"
    ? { subject: `Fatura ${proposal.proposalNum} — FastForward`, greeting: `Olá ${clientName},`, intro: "Segue em anexo a fatura referente ao serviço solicitado.", payBtn: "Ver e Pagar Fatura" }
    : { subject: `Factura ${proposal.proposalNum} — FastForward`, greeting: `Hola ${clientName},`, intro: "Adjunto encontrarás la factura correspondiente al servicio solicitado.", payBtn: "Ver y Pagar Factura" };

  const services = (typeof proposal.services === "string" ? JSON.parse(proposal.services || "[]") : proposal.services) as { name: string; price: number }[];

  let pdfBuffer: Buffer | null = null;
  try { pdfBuffer = await getZohoBooksInvoicePdf(proposal.zohoInvoiceId); } catch {}

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'Helvetica Neue',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
<tr><td style="background:#111827;padding:24px 32px;">
<img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" alt="FastForward" height="32">
</td></tr>
<tr><td style="background:#1f2937;padding:28px 32px;text-align:center;">
<p style="margin:0 0 4px;color:#9ca3af;font-size:12px;letter-spacing:1px;text-transform:uppercase;">Balance Due</p>
<p style="margin:0;color:#fff;font-size:40px;font-weight:700;">${fmt(proposal.total)}</p>
<p style="margin:8px 0 0;color:#6b7280;font-size:13px;">${proposal.proposalNum}</p>
</td></tr>
<tr><td style="padding:32px;">
<p style="margin:0 0 16px;color:#111827;font-size:15px;font-weight:600;">${L.greeting}</p>
<p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6;">${L.intro}</p>
<table width="100%" style="margin-bottom:20px;border-collapse:collapse;">
${services.map(s => `<tr><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#374151;font-size:14px;">${s.name}</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-size:14px;font-weight:500;text-align:right;">${fmt(s.price)}</td></tr>`).join("")}
</table>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
<tr><td align="center">
<a href="${payLink}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;">${L.payBtn} →</a>
</td></tr>
</table>
<p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">🔒 Pago seguro via Stripe · info@fastfwdus.com</p>
</td></tr>
<tr><td style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
<p style="margin:0;color:#9ca3af;font-size:11px;">FastForward Trading Company LLC · 33 SW 2nd Ave Ste 1202, Miami FL 33130</p>
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
