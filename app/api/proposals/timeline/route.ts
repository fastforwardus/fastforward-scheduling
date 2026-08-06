export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getSession } from "@/lib/session";

const STAGE_DAYS: Record<number, number> = { 1: 5, 2: 9, 3: 15, 4: 17 };

function toRows(res: unknown): Record<string, unknown>[] {
  return (Array.isArray(res) ? res : ((res as { rows?: unknown[] })?.rows ?? [])) as Record<string, unknown>[];
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  try {
    const p = toRows(await db.execute(sql`
      select p.*, u.full_name as rep_name,
             a.id::text as appt_id, a.client_whatsapp
      from proposals p
      left join users u on u.id = p.sent_by_id
      left join appointments a on a.id::text = p.appointment_id
      where p.id::text = ${id} limit 1`))[0];
    if (!p) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const eventos = toRows(await db.execute(sql`
      select kind, channel, detail, created_at from proposal_events
      where proposal_id::text = ${id} order by created_at asc`));

    const notas = toRows(await db.execute(sql`
      select author_name, content, created_at from recovery_notes
      where source_type = 'proposal' and source_id = ${id} order by created_at asc`));

    type Item = { at: string; kind: string; channel?: string | null; label: string; detail?: string | null; exact: boolean };
    const items: Item[] = [];
    const creada = new Date(p.created_at as string);

    items.push({ at: creada.toISOString(), kind: "created", channel: "email",
      label: "Propuesta enviada", detail: `${p.proposal_num} — USD ${Number(p.total).toLocaleString("en-US")}`, exact: true });

    // Sin eventos registrados (propuestas previas a proposal_events) el historial
    // se aproxima desde los contadores y el calendario de etapas.
    const hayEventos = eventos.length > 0;
    if (!hayEventos) {
      for (const [campo, canal] of [["reminder_stage", "email"], ["whatsapp_stage", "whatsapp"]] as const) {
        const n = Number(p[campo] ?? 0);
        for (let i = 1; i <= n; i++) {
          const d = new Date(creada);
          d.setDate(d.getDate() + (STAGE_DAYS[i] ?? 0));
          items.push({ at: d.toISOString(), kind: "reminder", channel: canal,
            label: `Recordatorio etapa ${i}`, detail: "fecha aproximada", exact: false });
        }
      }
    } else {
      for (const e of eventos) {
        const kind = String(e.kind);
        items.push({
          at: new Date(e.created_at as string).toISOString(),
          kind, channel: (e.channel as string) ?? null,
          label: kind === "reminder" ? "Recordatorio enviado"
               : kind === "reminder_failed" ? "Fallo al enviar"
               : kind === "delivery_failed" ? "No entregado"
               : kind === "accepted" ? "Propuesta aceptada" : kind,
          detail: (e.detail as string) ?? null, exact: true,
        });
      }
    }

    if (p.accepted_at && !eventos.some(e => String(e.kind) === "accepted"))
      items.push({ at: new Date(p.accepted_at as string).toISOString(), kind: "accepted", channel: "web", label: "Propuesta aceptada", exact: true });
    if (p.invoice_sent_at)
      items.push({ at: new Date(p.invoice_sent_at as string).toISOString(), kind: "invoice", channel: "email", label: "Factura enviada", detail: (p.zoho_invoice_id as string) ?? null, exact: true });
    if (p.payment_confirmed_at)
      items.push({ at: new Date(p.payment_confirmed_at as string).toISOString(), kind: "paid", channel: "web", label: "Pago confirmado", exact: true });

    for (const n of notas)
      items.push({ at: new Date(n.created_at as string).toISOString(), kind: "note", channel: "recupero",
        label: `Nota de ${n.author_name}`, detail: (n.content as string) ?? null, exact: true });

    items.sort((a, b) => a.at.localeCompare(b.at));

    return NextResponse.json({
      proposal: {
        id: String(p.id), proposalNum: String(p.proposal_num),
        clientName: (p.client_name as string) ?? null, clientEmail: (p.client_email as string) ?? null,
        clientPhone: (p.client_whatsapp as string) ?? null,
        total: Number(p.total), status: String(p.status), lang: (p.lang as string) ?? "es",
        repName: (p.rep_name as string) ?? null,
        reminderStage: Number(p.reminder_stage ?? 0), whatsappStage: Number(p.whatsapp_stage ?? 0),
        whatsappFailCount: Number(p.whatsapp_fail_count ?? 0),
        isDirect: String(p.appointment_id).startsWith("direct-"),
      },
      items, aproximado: !hayEventos,
    });
  } catch (err) {
    console.error("timeline error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
