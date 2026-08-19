export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { proposals, proposalEvents } from "@/db/schema";
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { getZohoBooksInvoice } from "@/lib/zohobooks";
import { getSession } from "@/lib/session";

const CAP = 40;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const auth = req.headers.get("authorization");
  const okCron = !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
  const session = await getSession();
  const okAdmin = session?.role === "admin";
  if (!okCron && !okAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dryRun = searchParams.get("apply") !== "1";

  const pendientes = await db.select({
    id: proposals.id,
    proposalNum: proposals.proposalNum,
    total: proposals.total,
    clientName: proposals.clientName,
    zohoInvoiceId: proposals.zohoInvoiceId,
  }).from(proposals).where(and(
    isNotNull(proposals.zohoInvoiceId),
    isNull(proposals.paymentConfirmedAt),
  )).limit(CAP);

  const pagadas: Record<string, unknown>[] = [];
  const impagas: Record<string, unknown>[] = [];
  const errores: Record<string, unknown>[] = [];

  for (const p of pendientes) {
    try {
      const inv = await getZohoBooksInvoice(p.zohoInvoiceId!);
      if (!inv) { errores.push({ num: p.proposalNum, error: "factura inexistente" }); continue; }

      const balance = Number(inv.balance ?? 0);
      const estaPaga = inv.status === "paid" || (balance === 0 && Number(inv.total ?? 0) > 0);

      if (!estaPaga) {
        impagas.push({ num: p.proposalNum, cliente: p.clientName, status: inv.status, balance, total: inv.total });
        continue;
      }

      const fecha = inv.last_payment_date || inv.payments?.[0]?.date;
      const pagadoEn = fecha ? new Date(fecha + "T12:00:00Z") : new Date();

      pagadas.push({ num: p.proposalNum, cliente: p.clientName, total: inv.total, fecha: pagadoEn.toISOString().slice(0, 10) });

      if (!dryRun) {
        await db.update(proposals)
          .set({ paymentConfirmedAt: pagadoEn })
          .where(eq(proposals.id, p.id));

        await db.insert(proposalEvents).values({
          proposalId: p.id,
          kind: "paid",
          channel: "zoho_books",
          detail: `Pago conciliado - USD ${inv.total}`,
          createdAt: pagadoEn,
        });
      }
    } catch (err) {
      errores.push({ num: p.proposalNum, error: String(err).slice(0, 200) });
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  return NextResponse.json({
    dryRun,
    revisadas: pendientes.length,
    pagadas: pagadas.length,
    impagas: impagas.length,
    errores: errores.length,
    detalle: { pagadas, impagas: impagas.slice(0, 15), errores },
  });
}
