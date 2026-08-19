export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { proposals, proposalEvents } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { registerZohoBooksPayment, getZohoBooksInvoice } from "@/lib/zohobooks";

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-manual-token") || new URL(req.url).searchParams.get("t");
  const okToken = !!process.env.MANUAL_RUN_TOKEN && token === process.env.MANUAL_RUN_TOKEN;
  const session = await getSession();
  const okSession = !!session && session.role !== "sales_rep";
  if (!okToken && !okSession)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { proposalNum, amount, date, ordenante, reference, dryRun } = body as {
    proposalNum: string; amount: number; date: string;
    ordenante?: string; reference?: string; dryRun?: boolean;
  };

  if (!proposalNum || !amount || !date)
    return NextResponse.json({ error: "Faltan proposalNum, amount o date" }, { status: 400 });

  const [p] = await db.select().from(proposals)
    .where(eq(proposals.proposalNum, proposalNum)).limit(1);
  if (!p) return NextResponse.json({ error: "Propuesta no encontrada" }, { status: 404 });
  if (!p.zohoInvoiceId) return NextResponse.json({ error: "Sin factura en Zoho Books" }, { status: 400 });
  if (p.paymentConfirmedAt) return NextResponse.json({ error: "Ya tiene pago registrado" }, { status: 409 });

  const inv = await getZohoBooksInvoice(p.zohoInvoiceId);
  if (!inv) return NextResponse.json({ error: "Factura inexistente en Zoho" }, { status: 404 });

  const previo = {
    proposalNum, cliente: p.clientName, totalPropuesta: p.total,
    facturaStatus: inv.status, facturaBalance: Number(inv.balance ?? 0),
    aAplicar: amount, fecha: date, contactId: inv.customer_id,
  };
  if (dryRun !== false) return NextResponse.json({ dryRun: true, previo });

  const { payment_id } = await registerZohoBooksPayment({
    contactId: inv.customer_id,
    invoiceId: p.zohoInvoiceId,
    amount, date,
    reference: reference ?? "",
    description: ordenante ? `Transferencia de ${ordenante}` : "Transferencia bancaria",
  });

  const pagadoEn = new Date(date + "T12:00:00Z");
  await db.update(proposals).set({ paymentConfirmedAt: pagadoEn }).where(eq(proposals.id, p.id));
  await db.insert(proposalEvents).values({
    proposalId: p.id, kind: "paid", channel: "wire",
    detail: `Pago manual - USD ${amount}${ordenante ? " de " + ordenante : ""}`,
    createdAt: pagadoEn,
  });

  if (ordenante) {
    await db.execute(sql`
      insert into payment_aliases (ordenante, zoho_contact_id, cliente_nombre, creado_por)
      values (${ordenante}, ${inv.customer_id}, ${p.clientName ?? ""}, ${session?.id ?? null})
      on conflict (ordenante) do update set veces_usado = payment_aliases.veces_usado + 1, last_used_at = now()`);
  }

  return NextResponse.json({ ok: true, payment_id, previo });
}
