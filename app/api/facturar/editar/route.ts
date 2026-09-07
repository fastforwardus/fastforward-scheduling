export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { sql, eq } from "drizzle-orm";
import { proposals, proposalEvents, activityLogs } from "@/db/schema";
import {
  puedeEditarZohoBooksInvoice,
  updateZohoBooksInvoice,
  emailZohoBooksInvoice,
} from "@/lib/zohobooks";

// Facturas ya emitidas: las del usuario, o todas si es admin.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdmin = session.role === "admin";
  const rows = await db.execute(sql`
    SELECT p.id, p.proposal_num, p.total, p.discount, p.services,
           p.zoho_invoice_id, p.invoice_sent_at, p.payment_confirmed_at,
           COALESCE(a.client_name, p.client_name) as client_name,
           COALESCE(a.client_email, p.client_email) as client_email,
           p.client_address, p.client_tax_id,
           COALESCE(us.full_name, u.full_name) as rep_name
    FROM proposals p
    LEFT JOIN appointments a ON a.id::text = p.appointment_id::text
    LEFT JOIN users u ON u.id::text = a.assigned_to::text
    LEFT JOIN users us ON us.id::text = p.sent_by_id::text
    WHERE p.zoho_invoice_id IS NOT NULL
      AND ${isAdmin ? sql`1=1` : sql`(p.sent_by_id::text = ${session.id} OR a.assigned_to::text = ${session.id})`}
    ORDER BY p.created_at DESC
    LIMIT 50
  `);
  return NextResponse.json({ facturas: (Array.isArray(rows) ? rows : []) as Record<string, unknown>[] });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { proposalId, confirmado, edits, motivo } = await req.json() as {
    proposalId?: string; confirmado?: boolean;
    edits?: {
      clientAddress?: string; clientTaxId?: string;
      discount?: number; servicios?: { name: string; price: number }[];
    };
    motivo?: string;
  };
  if (!proposalId) return NextResponse.json({ error: "Falta proposalId" }, { status: 400 });
  if (!confirmado) return NextResponse.json({ error: "Falta la confirmacion" }, { status: 400 });
  const razon = (motivo ?? "").trim();
  if (razon.length < 5)
    return NextResponse.json({ error: "Zoho exige un motivo para modificar una factura ya enviada." }, { status: 400 });

  const [p] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
  if (!p) return NextResponse.json({ error: "Propuesta inexistente" }, { status: 404 });
  if (!p.zohoInvoiceId) return NextResponse.json({ error: "Esta propuesta no tiene factura emitida" }, { status: 400 });

  if (session.role !== "admin") {
    const duenio = await db.execute(sql`
      SELECT 1 FROM proposals p
      LEFT JOIN appointments a ON a.id::text = p.appointment_id::text
      WHERE p.id = ${proposalId}
        AND (p.sent_by_id::text = ${session.id} OR a.assigned_to::text = ${session.id})
      LIMIT 1`);
    if (!(Array.isArray(duenio) ? duenio : []).length)
      return NextResponse.json({ error: "Esa factura no es tuya" }, { status: 403 });
  }

  // Guarda: el estado real manda, no lo que diga la base local.
  const estado = await puedeEditarZohoBooksInvoice(p.zohoInvoiceId);
  if (!estado.ok) {
    return NextResponse.json(
      { error: `La factura esta en estado "${estado.status}" y no se puede modificar. Para una factura pagada corresponde nota de credito.` },
      { status: 409 }
    );
  }

  const raw = p.services as unknown;
  let servicios: { name: string; price: number }[] = [];
  if (Array.isArray(raw)) servicios = raw as { name: string; price: number }[];
  else if (typeof raw === "string") { try { servicios = JSON.parse(raw); } catch { servicios = []; } }

  if (edits?.servicios?.length) {
    servicios = edits.servicios
      .filter((x) => x && String(x.name).trim() !== "")
      .map((x) => ({ name: String(x.name).trim(), price: Number(x.price) || 0 }));
  }
  if (!servicios.length) return NextResponse.json({ error: "La factura no tiene servicios" }, { status: 400 });

  const descuento = Number(edits?.discount ?? p.discount ?? 0) || 0;
  const totalFinal = servicios.reduce((a, x) => a + x.price, 0) - descuento;
  if (totalFinal <= 0) return NextResponse.json({ error: "El total debe ser mayor a cero" }, { status: 400 });

  try {
    const inv = await updateZohoBooksInvoice({
      invoiceId: p.zohoInvoiceId,
      lineItems: servicios.map((x) => ({ name: x.name, rate: x.price, quantity: 1 })),
      discount: descuento,
      notes: `Propuesta ${p.proposalNum} — FastForward`,
      clientTaxId: edits?.clientTaxId?.trim() || p.clientTaxId || undefined,
      reason: razon,
    });

    // Zoho no reenvia solo tras un update: el cliente tiene la version vieja.
    let reenviada = true;
    let errorEnvio = "";
    try { await emailZohoBooksInvoice(p.zohoInvoiceId); }
    catch (e) { reenviada = false; errorEnvio = String(e).slice(0, 200); }

    await db.update(proposals).set({
      total: totalFinal,
      discount: descuento,
      clientAddress: edits?.clientAddress?.trim() || p.clientAddress,
      clientTaxId: edits?.clientTaxId?.trim() || p.clientTaxId,
    }).where(eq(proposals.id, p.id));

    await db.insert(proposalEvents).values({
      proposalId: p.id, kind: "invoice_editada", channel: "dashboard",
      detail: `Factura ${inv.invoice_number} editada por ${session.fullName} — motivo: ${razon} — nuevo total USD ${inv.total}${reenviada ? " — reenviada al cliente" : ` — NO SE REENVIO: ${errorEnvio}`}`,
    }).catch(() => {});

    await db.insert(activityLogs).values({
      userId: session.id, action: "factura_editada", entityType: "proposal", entityId: p.id,
      details: `invoice ${inv.invoice_id} (${inv.invoice_number}) — total USD ${inv.total} — motivo: ${razon} — reenviada: ${reenviada}`,
    }).catch(() => {});

    return NextResponse.json({ ok: true, invoice: inv, reenviada, errorEnvio });
  } catch (err) {
    await db.insert(activityLogs).values({
      userId: session.id, action: "factura_editada_error", entityType: "proposal", entityId: p.id,
      details: String(err).slice(0, 400),
    }).catch(() => {});
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
