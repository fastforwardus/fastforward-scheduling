export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { proposals, appointments, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { getQBToken } from "@/lib/quickbooks";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { proposalId } = await req.json();

  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
  if (!proposal) return NextResponse.json({ error: "Propuesta no encontrada" }, { status: 404 });

  const [appt] = await db.select({
    clientName: appointments.clientName,
    clientCompany: appointments.clientCompany,
    clientEmail: appointments.clientEmail,
    assignedTo: appointments.assignedTo,
  }).from(appointments).where(eq(appointments.id, proposal.appointmentId as string)).limit(1);

  if (!appt) return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });

  let repName = "FastForward FDA Experts";
  let repEmail = "info@fastfwdus.com";
  if (appt.assignedTo) {
    const [rep] = await db.select({ fullName: users.fullName, email: users.email })
      .from(users).where(eq(users.id, appt.assignedTo)).limit(1);
    if (rep) { repName = rep.fullName; repEmail = rep.email; }
  }

  // Get QB invoice details
  const token = await getQBToken();
  const realmId = process.env.QB_REALM_ID;
  const res = await fetch(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/invoice/${proposal.qbInvoiceId}?minorversion=65`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
  );
  const data = await res.json();
  const inv = data.Invoice;
  // QB payment link
  const qbPaymentUrl = inv?.InvoiceLink || `https://app.qbo.intuit.com/app/customerinvoice?txnId=${proposal.qbInvoiceId}`;

  const lang = (proposal.lang || "es") as "es" | "en" | "pt";
  const firstName = appt.clientName.split(" ")[0];
  const LABELS = {
    es: { subject: `Tu factura — ${appt.clientCompany} — FastForward`, greeting: `Hola, ${firstName}`, body: `Adjunto tu factura por los servicios contratados con FastForward FDA Experts. Por favor realizá el pago para dar inicio a tus trámites.`, invoiceLabel: "Factura", totalLabel: "Total", dueDateLabel: "Vencimiento", payBtn: "Ver y pagar factura", thanks: "Gracias por confiar en FastForward." },
    en: { subject: `Your invoice — ${appt.clientCompany} — FastForward`, greeting: `Hi, ${firstName}`, body: `Please find your invoice for the services contracted with FastForward FDA Experts. Please proceed with payment to initiate your registration process.`, invoiceLabel: "Invoice", totalLabel: "Total", dueDateLabel: "Due date", payBtn: "View and pay invoice", thanks: "Thank you for trusting FastForward." },
    pt: { subject: `Sua fatura — ${appt.clientCompany} — FastForward`, greeting: `Olá, ${firstName}`, body: `Segue sua fatura pelos serviços contratados com a FastForward FDA Experts. Por favor, realize o pagamento para iniciar seus trâmites.`, invoiceLabel: "Fatura", totalLabel: "Total", dueDateLabel: "Vencimento", payBtn: "Ver e pagar fatura", thanks: "Obrigado por confiar na FastForward." },
  };
  const L = LABELS[lang];

  const services = (typeof proposal.services === "string" ? JSON.parse(proposal.services || "[]") : proposal.services) as { name: string; price: number }[];

  // Fetch QB invoice PDF
  let pdfAttachment: { filename: string; content: string } | null = null;
  try {
    const pdfRes = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${realmId}/invoice/${proposal.qbInvoiceId}/pdf?minorversion=65`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/pdf" } }
    );
    if (pdfRes.ok) {
      const pdfBuffer = await pdfRes.arrayBuffer();
      pdfAttachment = {
        filename: `Factura-FastForward-${proposal.proposalNum}.pdf`,
        content: Buffer.from(pdfBuffer).toString("base64"),
      };
    }
  } catch (err) { console.error("QB PDF error:", err); }

  await resend.emails.send({
    from: `${repName} — FastForward <info@fastfwdus.com>`,
    replyTo: repEmail,
    to: appt.clientEmail,
    subject: L.subject,
    ...(pdfAttachment ? { attachments: [{ filename: pdfAttachment.filename, content: pdfAttachment.content }] } : {}),
    html: `
<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <div style="background:#27295C;border-radius:16px 16px 0 0;padding:28px;text-align:center;">
    <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="32" alt="FastForward">
  </div>
  <div style="background:white;border-radius:0 0 16px 16px;padding:32px;border:1px solid #E5E7EB;border-top:none;">
    <p style="font-size:18px;font-weight:700;color:#27295C;margin:0 0 8px;">${L.greeting}</p>
    <p style="font-size:14px;color:#374151;margin:0 0 24px;">${L.body}</p>

    <div style="background:#F8F9FB;border-radius:12px;padding:16px;margin-bottom:20px;border:1px solid #E5E7EB;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:12px;color:#9CA3AF;text-transform:uppercase;">${L.invoiceLabel}</span>
        <span style="font-size:13px;font-weight:600;color:#27295C;">${proposal.proposalNum}</span>
      </div>
      ${inv?.DueDate ? `<div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:12px;color:#9CA3AF;text-transform:uppercase;">${L.dueDateLabel}</span>
        <span style="font-size:13px;font-weight:600;color:#27295C;">${inv.DueDate}</span>
      </div>` : ""}
      <div style="border-top:1px solid #E5E7EB;padding-top:10px;margin-top:8px;">
        ${services.map(s => `
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="font-size:13px;color:#374151;">${s.name}</span>
            <span style="font-size:13px;font-weight:600;color:#374151;">$${s.price.toLocaleString("en-US")}</span>
          </div>`).join("")}
      </div>
      <div style="border-top:1px solid #E5E7EB;padding-top:10px;margin-top:8px;display:flex;justify-content:space-between;">
        <span style="font-size:14px;font-weight:700;color:#27295C;">${L.totalLabel}</span>
        <span style="font-size:18px;font-weight:700;color:#C9A84C;">USD $${proposal.total.toLocaleString("en-US")}</span>
      </div>
    </div>

    <a href="${qbPaymentUrl}"
       style="display:block;text-align:center;background:#22C55E;color:white;padding:16px;border-radius:12px;font-weight:700;text-decoration:none;font-size:16px;margin-bottom:8px;">
      💳 ${lang === "en" ? "Pay now" : lang === "pt" ? "Efetuar pagamento" : "Efectuar pago"} →
    </a>
    <p style="text-align:center;font-size:11px;color:#9CA3AF;margin:0 0 24px;">${lang === "en" ? "Accepts: Credit card, ACH, bank transfer" : lang === "pt" ? "Aceita: Cartão de crédito, ACH, transferência bancária" : "Acepta: Tarjeta de crédito, ACH, transferencia bancaria"}</p>

    <div style="background:#F8F9FB;border-radius:12px;padding:16px;margin-bottom:20px;border:1px solid #E5E7EB;">
      <p style="font-size:12px;font-weight:700;color:#27295C;margin:0 0 10px;text-transform:uppercase;letter-spacing:0.05em;">${lang === "en" ? "Wire Transfer / ACH Details" : lang === "pt" ? "Dados para Transferência Bancária" : "Datos para Transferencia Bancaria"}</p>
      <table style="width:100%;font-size:12px;color:#374151;border-collapse:collapse;">
        <tr><td style="padding:3px 0;color:#9CA3AF;width:45%;">${lang === "en" ? "Beneficiary" : "Beneficiario"}</td><td style="padding:3px 0;font-weight:600;">FastForward Trading Company LLC</td></tr>
        <tr><td style="padding:3px 0;color:#9CA3AF;">${lang === "en" ? "Address" : lang === "pt" ? "Endereço" : "Dirección"}</td><td style="padding:3px 0;">201 SE 2ND AVE, OFFICE 1202, Miami, FL 33131</td></tr>
        <tr><td style="padding:3px 0;color:#9CA3AF;">TAX ID</td><td style="padding:3px 0;font-weight:600;">85-3074008</td></tr>
        <tr><td style="padding:3px 0;color:#9CA3AF;">${lang === "en" ? "Bank" : "Banco"}</td><td style="padding:3px 0;">JPMorgan Chase Bank, N.A.</td></tr>
        <tr><td style="padding:3px 0;color:#9CA3AF;">${lang === "en" ? "Account number" : lang === "pt" ? "Número da conta" : "Número de cuenta"}</td><td style="padding:3px 0;font-weight:600;">586380837</td></tr>
        <tr><td style="padding:3px 0;color:#9CA3AF;">Routing Number</td><td style="padding:3px 0;font-weight:600;">267084131</td></tr>
        <tr><td style="padding:3px 0;color:#9CA3AF;">SWIFT (${lang === "en" ? "International" : lang === "pt" ? "Internacional" : "Internacional"})</td><td style="padding:3px 0;font-weight:600;">CHASUS33</td></tr>
        <tr><td style="padding:3px 0;color:#9CA3AF;">SWIFT (${lang === "en" ? "Domestic" : lang === "pt" ? "Doméstico" : "Doméstico"})</td><td style="padding:3px 0;font-weight:600;">021000021</td></tr>
        <tr><td style="padding:3px 0;color:#9CA3AF;">ACH</td><td style="padding:3px 0;font-weight:600;">267084131</td></tr>
        <tr><td style="padding:3px 0;color:#9CA3AF;">${lang === "en" ? "Bank address" : lang === "pt" ? "Endereço do banco" : "Dirección del banco"}</td><td style="padding:3px 0;">270 Park Avenue, 43rd floor, New York, NY 10017</td></tr>
      </table>
    </div>

    <p style="font-size:13px;color:#6B7280;margin:0 0 20px;">${L.thanks}</p>

    <div style="border-top:1px solid #F0F0F0;padding-top:20px;text-align:center;">
      <p style="font-size:12px;color:#9CA3AF;margin:0;">FastForward Trading Company LLC · Miami, FL · info@fastfwdus.com</p>
    </div>
  </div>
</div>`,
  });

  await db.update(proposals).set({ invoiceSentAt: new Date() })
    .where(eq(proposals.id, proposalId));

  return NextResponse.json({ ok: true });
}
