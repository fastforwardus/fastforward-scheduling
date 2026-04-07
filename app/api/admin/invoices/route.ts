export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { proposals } from "@/db/schema";
import { isNotNull } from "drizzle-orm";
import { getZohoBooksInvoice } from "@/lib/zohobooks";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Propuestas aceptadas con invoice de Zoho Books
    const accepted = await db
      .select({
        id: proposals.id,
        proposalNum: proposals.proposalNum,
        total: proposals.total,
        zohoInvoiceId: proposals.zohoInvoiceId,
        zohoPaymentLink: proposals.zohoPaymentLink,
        appointmentId: proposals.appointmentId,
        lang: proposals.lang,
        acceptedAt: proposals.acceptedAt,
        invoiceSentAt: proposals.invoiceSentAt,
      })
      .from(proposals)
      .where(isNotNull(proposals.zohoInvoiceId));

    // Para cada propuesta, obtener detalles del invoice en Zoho Books
    const results = [];
    for (const prop of accepted) {
      try {
        const inv = await getZohoBooksInvoice(prop.zohoInvoiceId!);
        results.push({
          ...prop,
          customerName: inv?.customer_name ?? "",
          dueDate: inv?.due_date ?? "",
          balance: inv?.balance ?? prop.total,
          totalAmt: inv?.total ?? prop.total,
          status: inv?.status ?? "draft",
          invoiceUrl: inv?.invoice_url ?? prop.zohoPaymentLink ?? "",
        });
      } catch (err) {
        console.error("Error fetching Zoho invoice", prop.zohoInvoiceId, err);
        results.push({ ...prop, customerName: "", balance: prop.total, totalAmt: prop.total, status: "unknown", invoiceUrl: "" });
      }
    }

    return NextResponse.json({ invoices: results });
  } catch (err) {
    console.error("Invoices API error:", err);
    return NextResponse.json({ error: String(err), invoices: [] }, { status: 500 });
  }
}
