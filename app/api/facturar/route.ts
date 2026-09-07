export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { proposals, proposalEvents, activityLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { findOrCreateZohoBooksContact, createZohoBooksInvoice, markZohoBooksInvoiceSent } from "@/lib/zohobooks";

// Lista las propuestas facturables del usuario: aceptadas y todavia sin
// factura en Zoho. El admin ve las de todos.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdmin = session.role === "admin";
  const rows = await db.execute(sql`
    SELECT p.id, p.proposal_num, p.total, p.discount, p.services, p.status,
           p.zoho_invoice_id, p.zoho_invoice_missing_at,
           COALESCE(a.client_name, p.client_name) as client_name,
           COALESCE(a.client_email, p.client_email) as client_email,
           p.client_address, p.client_tax_id,
           COALESCE(us.full_name, u.full_name) as rep_name
    FROM proposals p
    LEFT JOIN appointments a ON a.id::text = p.appointment_id::text
    LEFT JOIN users u ON u.id::text = a.assigned_to::text
    LEFT JOIN users us ON us.id::text = p.sent_by_id::text
    WHERE p.zoho_invoice_id IS NULL
      AND ${isAdmin ? sql`1=1` : sql`(p.sent_by_id::text = ${session.id} OR a.assigned_to::text = ${session.id})`}
    ORDER BY p.created_at DESC
    LIMIT 100
  `);
  const items = (Array.isArray(rows) ? rows : []) as Record<string, unknown>[];
  return NextResponse.json({ propuestas: items });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { proposalId, confirmado } = body as { proposalId?: string; confirmado?: boolean };
  if (!proposalId) return NextResponse.json({ error: "Falta proposalId" }, { status: 400 });
  if (!confirmado) return NextResponse.json({ error: "Falta la confirmacion" }, { status: 400 });

  const [p] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
  if (!p) return NextResponse.json({ error: "Propuesta inexistente" }, { status: 404 });

  // Candado de duplicados: una factura por propuesta, sin excepciones.
  if (p.zohoInvoiceId) {
    return NextResponse.json(
      { error: `Esta propuesta ya tiene la factura ${p.zohoInvoiceId}. No se emite otra.` },
      { status: 409 }
    );
  }

  // Alcance: un sales_rep solo factura lo suyo.
  if (session.role !== "admin") {
    const dueno = await db.execute(sql`
      SELECT 1 FROM proposals p
      LEFT JOIN appointments a ON a.id::text = p.appointment_id::text
      WHERE p.id = ${proposalId}
        AND (p.sent_by_id::text = ${session.id} OR a.assigned_to::text = ${session.id})
      LIMIT 1`);
    const ok = (Array.isArray(dueno) ? dueno : []).length > 0;
    if (!ok) return NextResponse.json({ error: "Esa propuesta no es tuya" }, { status: 403 });
  }

  let servicios: { name: string; price: number }[] = [];
  try { servicios = JSON.parse(p.services); } catch { servicios = []; }
  if (!servicios.length) return NextResponse.json({ error: "La propuesta no tiene servicios" }, { status: 400 });

  if (!p.clientEmail) {
    return NextResponse.json(
      { error: "La propuesta no tiene email del cliente. Cargalo antes de facturar." },
      { status: 400 }
    );
  }

  try {
    const contact = await findOrCreateZohoBooksContact({
      name: p.clientName || "Cliente",
      email: p.clientEmail,
      address: p.clientAddress || undefined,
      taxId: p.clientTaxId || undefined,
    });
    const invoice = await createZohoBooksInvoice({
      contactId: contact.contact_id,
      invoiceNumber: p.proposalNum,
      lineItems: servicios.map((s) => ({ name: s.name, rate: s.price, quantity: 1 })),
      discount: p.discount || 0,
      notes: `Propuesta ${p.proposalNum} — FastForward`,
      clientAddress: p.clientAddress || undefined,
      clientTaxId: p.clientTaxId || undefined,
    });
    await markZohoBooksInvoiceSent(invoice.invoice_id);

    await db.update(proposals).set({
      zohoInvoiceId: invoice.invoice_id,
      zohoContactId: contact.contact_id,
      zohoPaymentLink: invoice.invoice_url || null,
      invoiceSentAt: new Date(),
      zohoInvoiceMissingAt: null,
    }).where(eq(proposals.id, p.id));

    await db.insert(proposalEvents).values({
      proposalId: p.id, kind: "invoice_manual", channel: "dashboard",
      detail: `Factura ${invoice.invoice_number} emitida manualmente por ${session.fullName}`,
    }).catch(() => {});

    await db.insert(activityLogs).values({
      userId: session.id, action: "factura_manual", entityType: "proposal", entityId: p.id,
      details: `invoice ${invoice.invoice_id} (${invoice.invoice_number}) — USD ${invoice.total} — cliente ${p.clientName ?? ""}`,
    }).catch(() => {});

    return NextResponse.json({ ok: true, invoice });
  } catch (err) {
    await db.insert(activityLogs).values({
      userId: session.id, action: "factura_manual_error", entityType: "proposal", entityId: p.id,
      details: String(err).slice(0, 400),
    }).catch(() => {});
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
