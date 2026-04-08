export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { proposals } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getZohoBooksInvoice } from "@/lib/zohobooks";

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const [proposal] = await db.select().from(proposals)
    .where(eq(proposals.confirmToken, params.token)).limit(1);

  if (!proposal || !proposal.zohoInvoiceId)
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });

  // Obtener datos del cliente — soporta propuestas directas y con cita
  let clientName = (proposal as Record<string,unknown>).clientName as string || "";
  let clientEmail = (proposal as Record<string,unknown>).clientEmail as string || "";
  let clientCompany = "";

  if (!clientEmail && proposal.appointmentId && !proposal.appointmentId.startsWith("direct-")) {
    const rows = await db.execute(
      sql`SELECT client_name, client_email, client_company FROM appointments WHERE id::text = ${proposal.appointmentId} LIMIT 1`
    ) as unknown as { rows: { client_name: string; client_email: string; client_company: string }[] };
    clientName = rows.rows?.[0]?.client_name || clientName;
    clientEmail = rows.rows?.[0]?.client_email || clientEmail;
    clientCompany = rows.rows?.[0]?.client_company || "";
  }

  const inv = await getZohoBooksInvoice(proposal.zohoInvoiceId);

  const services = (typeof proposal.services === "string"
    ? JSON.parse(proposal.services || "[]")
    : proposal.services) as { name: string; price: number }[];

  return NextResponse.json({
    invoiceNumber: inv?.invoice_number || proposal.proposalNum,
    referenceNumber: proposal.proposalNum,
    clientName,
    clientEmail,
    clientCompany,
    total: inv?.total ?? proposal.total,
    balance: inv?.balance ?? proposal.total,
    status: inv?.status || "sent",
    paymentLink: proposal.zohoPaymentLink || inv?.invoice_url || "",
    services,
    lang: proposal.lang || "es",
    dueDate: inv?.due_date || "",
  });
}
