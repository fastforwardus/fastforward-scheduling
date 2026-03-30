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
  // Re-fetch invoice to get InvoiceLink after send
  let qbPaymentUrl = inv?.InvoiceLink || "";
  if (!qbPaymentUrl) {
    try {
      const invRes2 = await fetch(
        `https://quickbooks.api.intuit.com/v3/company/${realmId}/invoice/${proposal.qbInvoiceId}?minorversion=65`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
      );
      const invData2 = await invRes2.json();
      qbPaymentUrl = invData2.Invoice?.InvoiceLink || "";
    } catch {}
  }

  const lang = (proposal.lang || "es") as "es" | "en" | "pt";
  const firstName = appt.clientName.split(" ")[0];
  const LABELS = {
    es: { subject: `Tu factura — ${appt.clientCompany} — FastForward`, greeting: `Hola, ${firstName}`, body: `Adjunto tu factura por los servicios contratados con FastForward FDA Experts. Por favor realizá el pago para dar inicio a tus trámites.`, invoiceLabel: "Factura", totalLabel: "Total", dueDateLabel: "Vencimiento", payBtn: "Ver y pagar factura", thanks: "Gracias por confiar en FastForward." },
    en: { subject: `Your invoice — ${appt.clientCompany} — FastForward`, greeting: `Hi, ${firstName}`, body: `Please find your invoice for the services contracted with FastForward FDA Experts. Please proceed with payment to initiate your registration process.`, invoiceLabel: "Invoice", totalLabel: "Total", dueDateLabel: "Due date", payBtn: "View and pay invoice", thanks: "Thank you for trusting FastForward." },
    pt: { subject: `Sua fatura — ${appt.clientCompany} — FastForward`, greeting: `Olá, ${firstName}`, body: `Segue sua fatura pelos serviços contratados com a FastForward FDA Experts. Por favor, realize o pagamento para iniciar seus trâmites.`, invoiceLabel: "Fatura", totalLabel: "Total", dueDateLabel: "Vencimento", payBtn: "Ver e pagar fatura", thanks: "Obrigado por confiar na FastForward." },
  };
  const L = LABELS[lang];

  const services = (typeof proposal.services === "string" ? JSON.parse(proposal.services || "[]") : proposal.services) as { name: string; price: number }[];

  // Send via QB email first to get proper payment link
  try {
    await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${realmId}/invoice/${proposal.qbInvoiceId}/send?sendTo=${encodeURIComponent(appt.clientEmail)}&minorversion=65`,
      { method: "POST", headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/octet-stream" } }
    );
    console.log("QB email sent for invoice", proposal.qbInvoiceId);
  } catch (err) { console.error("QB send error:", err); }

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


  await db.update(proposals).set({ invoiceSentAt: new Date() })
    .where(eq(proposals.id, proposalId));

  return NextResponse.json({ ok: true });
}
