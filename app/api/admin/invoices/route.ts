import { NextResponse } from "next/server";
import { db } from "@/db";
import { proposals } from "@/db/schema";
import { isNotNull } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { getQBToken } from "@/lib/quickbooks";

export async function GET() {
  try {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Get accepted proposals with QB invoice
  const accepted = await db.select({
    id: proposals.id,
    proposalNum: proposals.proposalNum,
    total: proposals.total,
    qbInvoiceId: proposals.qbInvoiceId,
    qbCustomerId: proposals.qbCustomerId,
    appointmentId: proposals.appointmentId,
    lang: proposals.lang,
    acceptedAt: proposals.acceptedAt,
    invoiceSentAt: proposals.invoiceSentAt,
  }).from(proposals)
    .where(isNotNull(proposals.qbInvoiceId));

  // Get QB invoice details
  const token = await getQBToken();
  const realmId = process.env.QB_REALM_ID;
  const results = [];

  for (const prop of accepted) {
    try {
      const res = await fetch(
        `https://quickbooks.api.intuit.com/v3/company/${realmId}/invoice/${prop.qbInvoiceId}?minorversion=65`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
      );
      const data = await res.json();
      const inv = data.Invoice;
      if (inv) {
        results.push({
          ...prop,
          customerName: inv.CustomerRef?.name,
          dueDate: inv.DueDate,
          balance: inv.Balance,
          totalAmt: inv.TotalAmt,
          emailStatus: inv.EmailStatus,
          billEmail: inv.BillEmail?.Address,
        });
      }
    } catch { results.push(prop); }
  }

  return NextResponse.json({ invoices: results });
  } catch (err) {
    console.error("Invoices API error:", err);
    return NextResponse.json({ error: String(err), invoices: [] }, { status: 500 });
  }
}
