import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { portal } from "@/lib/status/portal-db";
import { getCase, ensureMeta, touch, logEvent } from "@/lib/status/queries";
import { completeActiveStage } from "@/lib/status/stages";

export const dynamic = "force-dynamic";

const WAITING = ["client", "authority", "us"];
const KINDS = ["comment", "call", "whatsapp", "email", "meeting"];
const CLOSE_REASONS = ["completed", "cancelled", "no_response"];

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const data = await getCase(params.id);
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(data);
}

/** Edición de campos del caso: waiting_on, next_step, key_date, key_date_label */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const id = params.id;
  await ensureMeta(id);
  const [before] = await portal`SELECT waiting_on, next_step, key_date, key_date_label FROM case_meta WHERE filing_id = ${id}`;
  const waitingOn = body.waitingOn === null || WAITING.includes(body.waitingOn) ? body.waitingOn : before.waiting_on;
  const nextStep = typeof body.nextStep === "string" ? body.nextStep.trim() || null : before.next_step;
  const keyDate = body.keyDate === null ? null : typeof body.keyDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.keyDate) ? body.keyDate : before.key_date;
  const keyDateLabel = typeof body.keyDateLabel === "string" ? body.keyDateLabel.trim() || null : before.key_date_label;
  await portal`UPDATE case_meta SET waiting_on = ${waitingOn ?? null}, next_step = ${nextStep}, key_date = ${keyDate},
               key_date_label = ${keyDateLabel}, last_activity_at = now(), updated_at = now() WHERE filing_id = ${id}`;
  await logEvent(id, { email: session.email, name: session.fullName }, "meta_update", before, { waiting_on: waitingOn, next_step: nextStep, key_date: keyDate, key_date_label: keyDateLabel });
  return NextResponse.json({ ok: true });
}

/** Acciones: { action: "comment", kind, body } | { action: "close", reason } | { action: "reopen" } */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = params.id;
  const b = await req.json();
  const actor = { email: session.email, name: session.fullName };
  await ensureMeta(id);

  if (b.action === "comment") {
    const kind = KINDS.includes(b.kind) ? b.kind : "comment";
    const text = String(b.body ?? "").trim();
    if (!text) return NextResponse.json({ error: "Texto vacío" }, { status: 400 });
    const [c] = await portal`INSERT INTO case_comments (filing_id, author_email, author_name, kind, body)
                             VALUES (${id}, ${session.email}, ${session.fullName}, ${kind}, ${text}) RETURNING id, created_at`;
    await touch(id);
    await logEvent(id, actor, `comment_${kind}`, null, { comment_id: c.id });
    return NextResponse.json({ ok: true, id: c.id });
  }

  if (b.action === "close") {
    const reason = CLOSE_REASONS.includes(b.reason) ? b.reason : "completed";
    const [before] = await portal`SELECT closed_reason, closed_at FROM case_meta WHERE filing_id = ${id}`;
    await portal`UPDATE case_meta SET closed_reason = ${reason}, closed_at = now(), closed_by = ${session.fullName},
                 reopened_at = NULL, last_activity_at = now(), updated_at = now() WHERE filing_id = ${id}`;
    await portal`INSERT INTO case_comments (filing_id, author_email, author_name, kind, body)
                 VALUES (${id}, ${session.email}, ${session.fullName}, 'system', ${`Caso cerrado: ${reason === "completed" ? "completado" : reason === "cancelled" ? "cancelado" : "sin respuesta"}${b.note ? ` — ${String(b.note).trim()}` : ""}`})`;
    await logEvent(id, actor, "close", before, { closed_reason: reason });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "reopen") {
    if (session.role !== "admin") return NextResponse.json({ error: "Solo admin puede reabrir" }, { status: 403 });
    const [before] = await portal`SELECT closed_reason, closed_at FROM case_meta WHERE filing_id = ${id}`;
    await portal`UPDATE case_meta SET closed_reason = NULL, closed_at = NULL, closed_by = NULL, reopened_at = now(),
                 last_activity_at = now(), updated_at = now() WHERE filing_id = ${id}`;
    await portal`UPDATE filings SET status = 'active' WHERE id = ${id} AND status IN ('completed','cancelled')`;
    await portal`INSERT INTO case_comments (filing_id, author_email, author_name, kind, body)
                 VALUES (${id}, ${session.email}, ${session.fullName}, 'system', 'Caso reabierto')`;
    await logEvent(id, actor, "reopen", before, null);
    return NextResponse.json({ ok: true });
  }

  if (b.action === "complete_stage") {
    const r = await completeActiveStage(id, { email: session.email, name: session.fullName });
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }

  return NextResponse.json({ error: "acción inválida" }, { status: 400 });
}
