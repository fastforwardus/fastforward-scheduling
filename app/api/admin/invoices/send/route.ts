export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { proposals, appointments, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { getQBToken } from "@/lib/quickbooks";

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


  // Send via QB email first to get proper payment link
  try {
    await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${realmId}/invoice/${proposal.qbInvoiceId}/send?sendTo=${encodeURIComponent(appt.clientEmail)}&minorversion=65`,
      { method: "POST", headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/octet-stream" } }
    );
    console.log("QB email sent for invoice", proposal.qbInvoiceId);
  } catch (err) { console.error("QB send error:", err); }



  await db.update(proposals).set({ invoiceSentAt: new Date() })
    .where(eq(proposals.id, proposalId));

  return NextResponse.json({ ok: true });
}
