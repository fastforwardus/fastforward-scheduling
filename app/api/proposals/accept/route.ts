export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { proposals, appointments, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { getQBToken } from "@/lib/quickbooks";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "Token requerido" }, { status: 400 });

  const [proposal] = await db.select().from(proposals)
    .where(eq(proposals.confirmToken, token as string)).limit(1);

  if (!proposal) return NextResponse.json({ error: "Propuesta no encontrada" }, { status: 404 });
  if ((proposal as { status?: string | null }).status === "accepted") return NextResponse.json({ ok: true, alreadyAccepted: true });

  const [appt] = await db.select({
    clientName: appointments.clientName,
    clientCompany: appointments.clientCompany,
    clientEmail: appointments.clientEmail,
    clientWhatsapp: appointments.clientWhatsapp,
    assignedTo: appointments.assignedTo,
  }).from(appointments).where(eq(appointments.id, proposal.appointmentId)).limit(1);

  if (!appt) return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });

  const services = JSON.parse(proposal.services as string) as { name: string; price: number }[];

  // ── QuickBooks: Find or create customer ─────────────────────────
  let qbCustomerId = "";
  let qbInvoiceId = "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";

  try {
    const qbToken = await getQBToken();
    const realmId = process.env.QB_REALM_ID;

    // Search for existing customer
    const searchRes = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=SELECT * FROM Customer WHERE PrimaryEmailAddr = '${appt.clientEmail}'&minorversion=65`,
      { headers: { Authorization: `Bearer ${qbToken}`, Accept: "application/json" } }
    );
    const searchData = await searchRes.json();
    const existingCustomer = searchData.QueryResponse?.Customer?.[0];

    if (existingCustomer) {
      qbCustomerId = existingCustomer.Id;
    } else {
      // Create customer
      const nameParts = appt.clientName.split(" ");
      const createRes = await fetch(
        `https://quickbooks.api.intuit.com/v3/company/${realmId}/customer?minorversion=65`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${qbToken}`, Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({
            DisplayName: `${appt.clientCompany} — ${appt.clientName}`,
            GivenName: nameParts[0],
            FamilyName: nameParts.slice(1).join(" ") || "-",
            CompanyName: appt.clientCompany,
            PrimaryEmailAddr: { Address: appt.clientEmail },
            PrimaryPhone: { FreeFormNumber: appt.clientWhatsapp },
          }),
        }
      );
      const createData = await createRes.json();
      qbCustomerId = createData.Customer?.Id || "";
      console.log("QB Customer created:", qbCustomerId);
    }

    // Create invoice
    const invoiceLines = services.map((svc, i) => ({
      LineNum: i + 1,
      Description: svc.name,
      Amount: svc.price,
      DetailType: "SalesItemLineDetail",
      SalesItemLineDetail: {
        ItemRef: { value: "1", name: "Services" },
        UnitPrice: svc.price,
        Qty: 1,
      },
    }));

    const invoiceRes = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${realmId}/invoice?minorversion=65`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${qbToken}`, Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          Line: invoiceLines,
          CustomerRef: { value: qbCustomerId },
          DocNumber: proposal.proposalNum,
          PrivateNote: `Propuesta aceptada desde scheduling.fastfwdus.com — ${proposal.proposalNum}`,
          ...(proposal.discount && proposal.discount > 0 ? {
            GlobalTaxCalculation: "NotApplicable",
          } : {}),
        }),
      }
    );
    const invoiceData = await invoiceRes.json();
    qbInvoiceId = invoiceData.Invoice?.Id || "";
    console.log("QB Invoice created:", qbInvoiceId);

  } catch (err) {
    console.error("QB error:", err);
    // Continue even if QB fails
  }

  // ── Update proposal status ───────────────────────────────────────
  await db.update(proposals).set({
    status: "accepted",
    acceptedAt: new Date(),
    qbCustomerId: qbCustomerId || null,
    qbInvoiceId: qbInvoiceId || null,
  }).where(eq(proposals.id, proposal.id));

  // ── Update appointment outcome ───────────────────────────────────
  await db.update(appointments).set({
    outcome: "closed",
  }).where(eq(appointments.id, proposal.appointmentId));

  const lang = (proposal.lang || "es") as "es" | "en" | "pt";

  const confirmMessages = {
    es: { subject: "Propuesta confirmada — FastForward", body: `Hola ${appt.clientName.split(" ")[0]},

Hemos recibido tu confirmación. Tu factura fue generada y te llegará por email en los próximos minutos.

Nuestro equipo se pondrá en contacto contigo para coordinar los próximos pasos.

Gracias por confiar en FastForward.` },
    en: { subject: "Proposal confirmed — FastForward", body: `Hi ${appt.clientName.split(" ")[0]},

We have received your confirmation. Your invoice has been generated and will arrive by email shortly.

Our team will contact you to coordinate next steps.

Thank you for trusting FastForward.` },
    pt: { subject: "Proposta confirmada — FastForward", body: `Olá ${appt.clientName.split(" ")[0]},

Recebemos sua confirmação. Sua fatura foi gerada e chegará por email em breve.

Nossa equipe entrará em contato para coordenar os próximos passos.

Obrigado por confiar na FastForward.` },
  };

  const msg = confirmMessages[lang];

  // Email to client
  await resend.emails.send({
    from: "FastForward FDA Experts <info@fastfwdus.com>",
    replyTo: "info@fastfwdus.com",
    to: appt.clientEmail,
    subject: msg.subject,
    html: `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  <div style="background:#27295C;border-radius:16px 16px 0 0;padding:28px;text-align:center;">
    <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="32" alt="FastForward">
  </div>
  <div style="background:white;border-radius:0 0 16px 16px;padding:32px;border:1px solid #E5E7EB;border-top:none;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="width:56px;height:56px;background:#DCFCE7;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;">
        <span style="font-size:28px;">✅</span>
      </div>
      <h1 style="font-size:20px;font-weight:700;color:#27295C;margin:0 0 8px;">${lang === "en" ? "Proposal confirmed!" : lang === "pt" ? "Proposta confirmada!" : "¡Propuesta confirmada!"}</h1>
    </div>
    <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 20px;white-space:pre-line;">${msg.body}</p>
    <div style="background:#F8F9FB;border-radius:10px;padding:14px;border:1px solid #E5E7EB;">
      <p style="font-size:12px;color:#9CA3AF;margin:0 0 4px;">${lang === "en" ? "Proposal" : "Propuesta"}</p>
      <p style="font-size:15px;font-weight:700;color:#27295C;margin:0 0 8px;">${proposal.proposalNum}</p>
      <p style="font-size:12px;color:#9CA3AF;margin:0 0 4px;">Total</p>
      <p style="font-size:20px;font-weight:700;color:#C9A84C;margin:0;">USD $${proposal.total.toLocaleString("en-US")}</p>
    </div>
    <div style="border-top:1px solid #F0F0F0;padding-top:20px;margin-top:24px;text-align:center;">
      <p style="font-size:12px;color:#9CA3AF;">FastForward Trading Company LLC · Miami, FL</p>
    </div>
  </div>
</div>`,
  }).catch(console.error);

  // Get rep info
  let repEmail = "info@fastfwdus.com";
  let repName = "FastForward";
  if (appt.assignedTo) {
    const [rep] = await db.select({ email: users.email, fullName: users.fullName })
      .from(users).where(eq(users.id, appt.assignedTo)).limit(1);
    if (rep) { repEmail = rep.email; repName = rep.fullName; }
  }

  // Notify Carlos + Rep
  const notifyEmails = ["info@fastfwdus.com"];
  if (repEmail !== "info@fastfwdus.com") notifyEmails.push(repEmail);

  await resend.emails.send({
    from: "FastForward Sistema <info@fastfwdus.com>",
    to: notifyEmails,
    subject: `🏆 Propuesta aceptada — ${appt.clientName} (${appt.clientCompany})`,
    html: `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  <div style="background:#27295C;border-radius:16px 16px 0 0;padding:28px;text-align:center;">
    <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="32" alt="FastForward">
  </div>
  <div style="background:white;border-radius:0 0 16px 16px;padding:32px;border:1px solid #E5E7EB;border-top:none;">
    <p style="font-size:20px;font-weight:700;color:#27295C;margin:0 0 4px;">🏆 Propuesta aceptada</p>
    <p style="color:#6B7280;font-size:14px;margin:0 0 24px;">${repName} — ${appt.clientName} confirmó la propuesta.</p>
    <div style="background:#F8F9FB;border-radius:12px;padding:16px;border:1px solid #E5E7EB;">
      <p style="font-size:11px;color:#9CA3AF;margin:0 0 2px;text-transform:uppercase;">Cliente</p>
      <p style="font-size:15px;font-weight:700;color:#27295C;margin:0 0 12px;">${appt.clientName} — ${appt.clientCompany}</p>
      <p style="font-size:11px;color:#9CA3AF;margin:0 0 2px;text-transform:uppercase;">Propuesta</p>
      <p style="font-size:14px;font-weight:600;color:#27295C;margin:0 0 12px;">${proposal.proposalNum}</p>
      <p style="font-size:11px;color:#9CA3AF;margin:0 0 2px;text-transform:uppercase;">Total</p>
      <p style="font-size:20px;font-weight:700;color:#C9A84C;margin:0 0 12px;">USD $${proposal.total.toLocaleString("en-US")}</p>
      ${qbInvoiceId ? `<p style="font-size:11px;color:#9CA3AF;margin:0 0 2px;text-transform:uppercase;">Invoice QB</p>
      <p style="font-size:13px;font-weight:600;color:#22C55E;margin:0;">✅ Creado — ID: ${qbInvoiceId}</p>` : ""}
    </div>
    <a href="${appUrl}/dashboard" style="display:block;text-align:center;background:#C9A84C;color:#1A1C3E;padding:14px;border-radius:10px;font-weight:700;text-decoration:none;margin-top:20px;">
      Ver en dashboard →
    </a>
  </div>
</div>`,
  }).catch(console.error);

  return NextResponse.json({ ok: true, qbInvoiceId, qbCustomerId });
}
