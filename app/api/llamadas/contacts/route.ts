export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { buildContext, generatePitch, type Ctx } from "@/lib/llamadas/context";

const ALLOWED = ["admin", "sales_manager", "caller"];
type Row = Record<string, unknown>;

async function getList(listId: string) {
  const r = await db.execute(sql`SELECT id, name, script FROM call_lists WHERE id = ${listId}`);
  return (r as unknown as Row[])[0];
}

async function withContext(c: Row, listScript: string | null, force = false) {
  let ctx = (c.context as Ctx | null) || null;
  if (!ctx || force) {
    ctx = await buildContext({ phoneE164: String(c.phone_e164), email: c.email ? String(c.email) : null });
    const prev = (c.context as Ctx | null)?.pitch;
    if (prev && !force) ctx.pitch = prev;
  }
  if (!ctx.pitch || force) {
    const pitch = await generatePitch({ name: c.name as string | null, company: c.company as string | null, country: c.country as string | null, industry: c.industry as string | null, notes: c.notes as string | null }, listScript, ctx);
    if (pitch) ctx.pitch = pitch;
  }
  await db.execute(sql`UPDATE call_contacts SET context = ${JSON.stringify(ctx)}::jsonb WHERE id = ${String(c.id)}`);
  return { ...c, context: ctx };
}

/** GET ?list=ID  → cola (próximo + pendientes) · GET ?id=ID → contacto con contexto · &refresh=1 regenera */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || !ALLOWED.includes(s.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  const id = sp.get("id"); const listId = sp.get("list"); const refresh = sp.get("refresh") === "1";

  if (id) {
    const r = await db.execute(sql`SELECT * FROM call_contacts WHERE id = ${id}`);
    const c = (r as unknown as Row[])[0];
    if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
    const list = await getList(String(c.list_id));
    return NextResponse.json({ contact: await withContext(c, (list?.script as string | null) ?? null, refresh), list });
  }
  if (listId) {
    const list = await getList(listId);
    if (!list) return NextResponse.json({ error: "lista no encontrada" }, { status: 404 });
    // Prioridad: callbacks vencidos → pendientes en orden de carga
    const q = await db.execute(sql`
      SELECT id, name, company, phone, phone_e164, email, country, industry, status, attempts, callback_at, last_outcome, last_called_at
      FROM call_contacts WHERE list_id = ${listId}
        AND (status = 'pending' OR (status = 'callback' AND callback_at <= now() + interval '15 minutes'))
      ORDER BY (status = 'callback') DESC, callback_at ASC NULLS LAST, created_at ASC LIMIT 50`);
    const later = await db.execute(sql`SELECT id, name, company, callback_at FROM call_contacts WHERE list_id = ${listId} AND status = 'callback' AND callback_at > now() + interval '15 minutes' ORDER BY callback_at ASC LIMIT 20`);
    const stats = await db.execute(sql`
      SELECT count(*)::int AS total, count(*) FILTER (WHERE status = 'pending')::int AS pending, count(*) FILTER (WHERE status = 'callback')::int AS callback,
             count(*) FILTER (WHERE status = 'done')::int AS done, count(*) FILTER (WHERE appointment_id IS NOT NULL)::int AS scheduled,
             count(*) FILTER (WHERE last_called_at::date = (now() at time zone 'America/New_York')::date)::int AS called_today
      FROM call_contacts WHERE list_id = ${listId}`);
    return NextResponse.json({ list, queue: q, later, stats: (stats as unknown as Row[])[0] });
  }
  return NextResponse.json({ error: "list o id" }, { status: 400 });
}

/** POST { id, action: "started" } marca intento. PATCH { id, outcome, note?, callbackAt?, appointmentId? } registra resultado. */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || !ALLOWED.includes(s.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id, action } = await req.json();
  if (action === "started" && id) {
    await db.execute(sql`UPDATE call_contacts SET attempts = attempts + 1, last_called_at = now(), called_by = ${s.id} WHERE id = ${id}`);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "acción inválida" }, { status: 400 });
}

const OUTCOMES: Record<string, { status: string; label: string }> = {
  no_answer: { status: "pending", label: "No contesta" },
  callback: { status: "callback", label: "Volver a llamar" },
  scheduled: { status: "done", label: "Interesado · cita agendada" },
  interested_no_slot: { status: "callback", label: "Interesado · sin horario todavía" },
  not_interested: { status: "done", label: "No interesado" },
  invalid: { status: "invalid", label: "Número inválido" },
  skip: { status: "skipped", label: "Omitido" },
};

export async function PATCH(req: NextRequest) {
  const s = await getSession();
  if (!s || !ALLOWED.includes(s.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id, outcome, note, callbackAt, appointmentId } = await req.json();
  const o = OUTCOMES[outcome];
  if (!id || !o) return NextResponse.json({ error: "resultado inválido" }, { status: 400 });
  // No contesta: después de 3 intentos pasa a done para no girar eternamente
  const r = await db.execute(sql`SELECT attempts FROM call_contacts WHERE id = ${id}`);
  const attempts = Number((r as unknown as Row[])[0]?.attempts ?? 0);
  const status = outcome === "no_answer" && attempts >= 3 ? "done" : o.status;
  const cb = callbackAt ? new Date(callbackAt) : outcome === "no_answer" && status === "pending" ? new Date(Date.now() + 24 * 3600000) : null;
  await db.execute(sql`UPDATE call_contacts SET status = ${status}, last_outcome = ${outcome}, outcome_note = ${note || null},
    callback_at = ${cb}, appointment_id = ${appointmentId || null}, called_by = ${s.id} WHERE id = ${id}`);
  await db.execute(sql`UPDATE call_logs SET outcome = ${outcome}, outcome_note = ${note || null}, follow_up_at = ${cb}
    WHERE id = (SELECT id FROM call_logs WHERE source_type = 'call_contact' AND source_id = ${id} ORDER BY created_at DESC LIMIT 1)`);
  return NextResponse.json({ ok: true, status, label: o.label });
}
