export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { callLogs, recoveryNotes } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/session";

const OUTCOMES = ["recuperado", "interesado", "pidio_tiempo", "no_interesa", "no_contesta", "numero_equivocado"];

function toRows(res: unknown): Record<string, unknown>[] {
  return (Array.isArray(res) ? res : ((res as { rows?: unknown[] })?.rows ?? [])) as Record<string, unknown>[];
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Admin y el rol recovery ven todas las llamadas; el resto solo las suyas
  const todas = session.role === "admin" || session.role === "recovery";
  const filtro = todas ? sql`true` : sql`c.user_id = ${session.id}::uuid`;

  try {
    const rows = toRows(await db.execute(sql`
      select c.id::text, c.call_sid, c.source_type, c.source_id,
             c.user_name, c.to_phone, c.status, c.duration_sec,
             c.outcome, c.outcome_note, c.follow_up_at, c.follow_up_done,
             c.created_at,
             coalesce(p.client_name, a.client_name) as client_name,
             coalesce(a.client_company, '') as client_company,
             p.proposal_num, p.total
      from call_logs c
      left join proposals p on c.source_type = 'proposal' and p.id::text = c.source_id
      left join appointments a on (
        (c.source_type = 'appointment' and a.id::text = c.source_id)
        or (c.source_type = 'proposal' and a.id::text = p.appointment_id)
      )
      where ${filtro}
      order by c.created_at desc
      limit 500`));

    return NextResponse.json({
      items: rows.map((r) => ({
        id: String(r.id),
        sourceType: (r.source_type as string) ?? null,
        sourceId: (r.source_id as string) ?? null,
        userName: (r.user_name as string) ?? null,
        toPhone: (r.to_phone as string) ?? null,
        status: (r.status as string) ?? null,
        durationSec: Number(r.duration_sec ?? 0),
        outcome: (r.outcome as string) ?? null,
        outcomeNote: (r.outcome_note as string) ?? null,
        followUpAt: r.follow_up_at ? new Date(r.follow_up_at as string).toISOString() : null,
        followUpDone: !!r.follow_up_done,
        createdAt: new Date(r.created_at as string).toISOString(),
        clientName: (r.client_name as string) ?? null,
        clientCompany: (r.client_company as string) ?? null,
        proposalNum: (r.proposal_num as string) ?? null,
        total: r.total != null ? Number(r.total) : null,
      })),
      puedeVerTodas: todas,
    });
  } catch (err) {
    console.error("recovery/calls error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { callId, outcome, outcomeNote, followUpAt, followUpDone } = await req.json();
  if (!callId) return NextResponse.json({ error: "callId requerido" }, { status: 400 });
  if (outcome && !OUTCOMES.includes(outcome)) {
    return NextResponse.json({ error: "outcome invalido" }, { status: 400 });
  }

  try {
    const [log] = await db.select().from(callLogs).where(eq(callLogs.id, callId)).limit(1);
    if (!log) return NextResponse.json({ error: "Llamada no encontrada" }, { status: 404 });

    const patch: Record<string, unknown> = {};
    if (outcome !== undefined) patch.outcome = outcome || null;
    if (outcomeNote !== undefined) patch.outcomeNote = outcomeNote || null;
    if (followUpAt !== undefined) {
      patch.followUpAt = followUpAt ? new Date(followUpAt) : null;
      // Reagendar reactiva el recordatorio
      if (followUpAt) patch.followUpDone = false;
    }
    if (followUpDone !== undefined) patch.followUpDone = !!followUpDone;

    await db.update(callLogs).set(patch).where(eq(callLogs.id, callId));

    // El comentario tambien va al historial del lead, para que quede
    // junto al resto de la gestion y no solo dentro de la llamada.
    if (outcomeNote?.trim() && log.sourceType && log.sourceId) {
      await db.insert(recoveryNotes).values({
        sourceType: log.sourceType,
        sourceId: log.sourceId,
        userId: session.id,
        authorName: session.fullName,
        content: outcomeNote.trim(),
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("recovery/calls POST error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
