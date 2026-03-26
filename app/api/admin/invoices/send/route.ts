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

  const lang = (proposal.lang || "es") as "es" | "en" | "pt";
  const firstName = appt.clientName.split(" ")[0];
  const LABELS = {
    es: { subject: `Tu factura — ${appt.clientCompany} — FastForward`, greeting: `Hola, ${firstName}`, body: `Adjunto tu factura por los servicios contratados con FastForward FDA Experts. Por favor realizá el pago para dar inicio a tus trámites.`, invoiceLabel: "Factura", totalLabel: "Total", dueDateLabel: "Vencimiento", payBtn: "Ver y pagar factura", thanks: "Gracias por confiar en FastForward." },
    en: { subject: `Your invoice — ${appt.clientCompany} — FastForward`, greeting: `Hi, ${firstName}`, body: `Please find your invoice for the services contracted with FastForward FDA Experts. Please proceed with payment to initiate your registration process.`, invoiceLabel: "Invoice", totalLabel: "Total", dueDateLabel: "Due date", payBtn: "View and pay invoice", thanks: "Thank you for trusting FastForward." },
    pt: { subject: `Sua fatura — ${appt.clientCompany} — FastForward`, greeting: `Olá, ${firstName}`, body: `Segue sua fatura pelos serviços contratados com a FastForward FDA Experts. Por favor, realize o pagamento para iniciar seus trâmites.`, invoiceLabel: "Fatura", totalLabel: "Total", dueDateLabel: "Vencimento", payBtn: "Ver e pagar fatura", thanks: "Obrigado por confiar na FastForward." },
  };
  const L = LABELS[lang];

  const services = (typeof proposal.services === "string" ? JSON.parse(proposal.services || "[]") : proposal.services) as { name: string; price: number }[];

  await resend.emails.send({
    from: `${repName} — FastForward <info@fastfwdus.com>`,
    replyTo: repEmail,
    to: appt.clientEmail,
    subject: L.subject,
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
