export const runtime = "nodejs";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getZohoBooksInvoice } from "@/lib/zohobooks";

/**
 * Sincroniza los cobros contra Zoho Books.
 *
 * El webhook de pagos no captura todo: cuando alguien marca una factura como
 * pagada a mano en Zoho, o el cliente transfiere y se concilia despues, el
 * sistema nunca se entera. Quedaban 64 propuestas aceptadas por USD 56.197 sin
 * pago registrado, y el revenue del informe salia subestimado.
 *
 * Esto pregunta el estado real de cada factura y actualiza lo que falte.
 * Solo marca pagos: nunca borra uno ya registrado.
 */
export async function GET(req: NextRequest) {
  const esCron = req.headers.get("x-vercel-cron") !== null;
  if (!esCron && req.nextUrl.searchParams.get("run") !== process.env.MANUAL_RUN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const simular = req.nextUrl.searchParams.get("dry") === "1";

  const res = await db.execute(sql`
    select id, proposal_num, zoho_invoice_id, total, status
    from proposals
    where zoho_invoice_id is not null
      and payment_confirmed_at is null
      and status <> 'cancelled'
    order by created_at desc
    limit 200`);
  const pendientes = (Array.isArray(res) ? res : ((res as { rows?: unknown[] })?.rows ?? [])) as Record<string, unknown>[];

  let cobradas = 0, sinCobrar = 0, errores = 0;
  const detalle: Record<string, unknown>[] = [];

  for (const p of pendientes) {
    try {
      const inv = await getZohoBooksInvoice(String(p.zoho_invoice_id)) as Record<string, unknown>;
      const estado = String(inv?.status ?? "");
      const saldo = Number(inv?.balance ?? -1);
      // Zoho marca "paid" cuando esta saldada; balance 0 cubre los casos en que
      // el estado quedo en otra cosa pero no debe nada.
      const pagada = estado === "paid" || (saldo === 0 && estado !== "draft" && estado !== "void");

      if (pagada) {
        if (!simular) {
          await db.execute(sql`
            update proposals
            set payment_confirmed_at = coalesce(payment_confirmed_at, now()),
                status = case when status = 'pending' then 'accepted' else status end,
                accepted_at = coalesce(accepted_at, now())
            where id = ${String(p.id)}`);
          await db.execute(sql`
            insert into proposal_events (proposal_id, kind, channel, detail)
            values (${String(p.id)}, 'paid', 'zoho',
                    ${"Cobro detectado en Zoho Books (" + estado + ")"})`);
        }
        cobradas++;
        detalle.push({ num: p.proposal_num, total: p.total, estado });
      } else {
        sinCobrar++;
      }
    } catch (e) {
      errores++;
      console.error("[sync-cobros]", p.proposal_num, String(e).slice(0, 90));
    }
    await new Promise((s) => setTimeout(s, 220));
  }

  console.log("[sync-cobros]", simular ? "SIMULACION" : "real",
    "| revisadas:", pendientes.length, "| cobradas:", cobradas, "| errores:", errores);

  return NextResponse.json({
    ok: true, simulacion: simular,
    revisadas: pendientes.length, cobradas, sinCobrar, errores, detalle,
  });
}
