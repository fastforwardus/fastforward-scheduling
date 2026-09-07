export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { sql, eq } from "drizzle-orm";
import { proposals, proposalEvents, activityLogs } from "@/db/schema";
import { findOrCreateZohoBooksContact, createZohoBooksInvoice, markZohoBooksInvoiceSent } from "@/lib/zohobooks";
import { randomBytes } from "crypto";

// Factura para un cliente que nunca tuvo propuesta. Se registra igual como
// fila en proposals para que caiga en "Ya emitidas", en el log y en los
// reportes, con el mismo candado de duplicados que el resto.
async function siguienteNumero(): Promise<string> {
  const year = new Date().getFullYear();
  const prefijo = `FF-${year}-`;
  const filas = await db.execute(sql`
    select max((substring(proposal_num from ${"^" + prefijo.replace("-", "\\-") + "([0-9]+)$"}))::bigint) as maximo
    from proposals where proposal_num ~ ${"^" + prefijo + "[0-9]+$"}`);
  const fila = (Array.isArray(filas) ? filas[0] : undefined) as { maximo?: string | number } | undefined;
  const maximo = Number(fila?.maximo ?? 0);
  return prefijo + String(maximo >= 10000 ? maximo + 1 : 10000);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientName, clientEmail, clientAddress, clientTaxId, servicios, discount, confirmado, lang } =
    await req.json() as {
      clientName?: string; clientEmail?: string; clientAddress?: string; clientTaxId?: string;
      servicios?: { name: string; price: number }[]; discount?: number; confirmado?: boolean; lang?: string;
    };

  if (!confirmado) return NextResponse.json({ error: "Falta la confirmacion" }, { status: 400 });
  if (!clientName?.trim()) return NextResponse.json({ error: "Falta el nombre del cliente" }, { status: 400 });
  if (!clientEmail?.trim()) return NextResponse.json({ error: "Falta el email del cliente" }, { status: 400 });

  const lineas = (servicios ?? [])
    .filter((x) => x && String(x.name).trim() !== "")
    .map((x) => ({ name: String(x.name).trim(), price: Number(x.price) || 0 }));
  if (!lineas.length) return NextResponse.json({ error: "La factura no tiene servicios" }, { status: 400 });

  const desc = Number(discount) || 0;
  const total = lineas.reduce((a, x) => a + x.price, 0) - desc;
  if (total <= 0) return NextResponse.json({ error: "El total debe ser mayor a cero" }, { status: 400 });

  const proposalNum = await siguienteNumero();

  const [fila] = await db.insert(proposals).values({
    appointmentId: "direct-manual-" + randomBytes(8).toString("hex"),
    proposalNum,
    services: JSON.stringify(lineas),
    total: total.toFixed(2),
    discount: desc.toFixed(2),
    status: "accepted",
    acceptedAt: new Date(),
    lang: lang || "es",
    clientName: clientName.trim(),
    clientEmail: clientEmail.trim(),
    clientAddress: clientAddress?.trim() || null,
    clientTaxId: clientTaxId?.trim() || null,
    sentById: session.id,
    confirmToken: randomBytes(32).toString("hex"),
  }).returning({ id: proposals.id });

  await db.insert(activityLogs).values({
    userId: session.id, action: "factura_directa_intento", entityType: "proposal", entityId: fila.id,
    details: `${proposalNum} — ${clientName.trim()} — USD ${total.toFixed(2)}`,
  }).catch(() => {});

  try {
    const contact = await findOrCreateZohoBooksContact({
      name: clientName.trim(),
      email: clientEmail.trim(),
      address: clientAddress?.trim() || undefined,
      taxId: clientTaxId?.trim() || undefined,
    });
    const invoice = await createZohoBooksInvoice({
      contactId: contact.contact_id,
      invoiceNumber: proposalNum,
      lineItems: lineas.map((x) => ({ name: x.name, rate: x.price, quantity: 1 })),
      discount: desc,
      notes: `Factura ${proposalNum} — FastForward`,
      clientAddress: clientAddress?.trim() || undefined,
      clientTaxId: clientTaxId?.trim() || undefined,
    });
    await markZohoBooksInvoiceSent(invoice.invoice_id);

    await db.update(proposals).set({
      zohoInvoiceId: invoice.invoice_id,
      zohoContactId: contact.contact_id,
      zohoPaymentLink: invoice.invoice_url || null,
      invoiceSentAt: new Date(),
    }).where(eq(proposals.id, fila.id));

    let enviada = true;
    let errorEnvio = "";
    try {
      const base = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";
      const r = await fetch(`${base}/api/admin/invoices/send-auto`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-key": process.env.INTERNAL_API_KEY || "ff-internal-2024" },
        body: JSON.stringify({ proposalId: fila.id }),
      });
      if (!r.ok) { enviada = false; errorEnvio = (await r.text()).slice(0, 200); }
    } catch (e) { enviada = false; errorEnvio = String(e).slice(0, 200); }

    await db.insert(proposalEvents).values({
      proposalId: fila.id, kind: "invoice_directa", channel: "dashboard",
      detail: `Factura ${invoice.invoice_number} emitida sin propuesta previa por ${session.fullName}`,
    }).catch(() => {});

    await db.insert(activityLogs).values({
      userId: session.id, action: "factura_directa", entityType: "proposal", entityId: fila.id,
      details: `invoice ${invoice.invoice_id} (${invoice.invoice_number}) — USD ${invoice.total} — ${clientName.trim()}`,
    }).catch(() => {});

    return NextResponse.json({ ok: true, invoice, proposalNum, enviada, errorEnvio });
  } catch (err) {
    await db.insert(activityLogs).values({
      userId: session.id, action: "factura_directa_error", entityType: "proposal", entityId: fila.id,
      details: String(err).slice(0, 400),
    }).catch(() => {});
    return NextResponse.json({ error: String(err), proposalNum }, { status: 500 });
  }
}
