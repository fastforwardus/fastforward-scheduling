export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { proposals, appointments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getZohoBooksInvoice } from "@/lib/zohobooks";

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const [proposal] = await db.select().from(proposals)
    .where(eq(proposals.confirmToken, params.token)).limit(1);

  if (!proposal || !proposal.zohoInvoiceId)
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });

  const [appt] = await db.select({
    clientName: appointments.clientName,
    clientEmail: appointments.clientEmail,
    clientCompany: appointments.clientCompany,
  }).from(appointments).where(eq(appointments.id, proposal.appointmentId)).limit(1);

  const inv = await getZohoBooksInvoice(proposal.zohoInvoiceId);

  const services = (typeof proposal.services === "string"
    ? JSON.parse(proposal.services || "[]")
    : proposal.services) as { name: string; price: number }[];

  return NextResponse.json({
    invoiceNumber: inv?.invoice_number || proposal.proposalNum,
    referenceNumber: proposal.proposalNum,
    clientName: appt?.clientName || "",
    clientEmail: appt?.clientEmail || "",
    clientCompany: appt?.clientCompany || "",
    total: inv?.total ?? proposal.total,
    balance: inv?.balance ?? proposal.total,
    status: inv?.status || "sent",
    paymentLink: proposal.zohoPaymentLink || inv?.invoice_url || "",
    services,
    lang: proposal.lang || "es",
    dueDate: inv?.due_date || "",
  });
}
