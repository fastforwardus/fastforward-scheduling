export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getSession } from "@/lib/session";

function toRows(res: unknown): Record<string, unknown>[] {
  return (Array.isArray(res) ? res : ((res as { rows?: unknown[] })?.rows ?? [])) as Record<string, unknown>[];
}

// Recordatorios vencidos del usuario logueado. Alimenta la campanita.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ items: [], count: 0 });

  try {
    const rows = toRows(await db.execute(sql`
      select c.id::text, c.to_phone, c.follow_up_at, c.outcome,
             coalesce(p.client_name, a.client_name) as client_name,
             p.proposal_num
      from call_logs c
      left join proposals p on c.source_type = 'proposal' and p.id::text = c.source_id
      left join appointments a on c.source_type = 'appointment' and a.id::text = c.source_id
      where c.user_id = ${session.id}::uuid
        and c.follow_up_done = false
        and c.follow_up_at is not null
        and c.follow_up_at <= now()
      order by c.follow_up_at asc
      limit 50`));

    return NextResponse.json({
      count: rows.length,
      items: rows.map((r) => ({
        id: String(r.id),
        clientName: (r.client_name as string) ?? "Sin nombre",
        proposalNum: (r.proposal_num as string) ?? null,
        toPhone: (r.to_phone as string) ?? null,
        followUpAt: new Date(r.follow_up_at as string).toISOString(),
      })),
    });
  } catch (err) {
    console.error("recovery/reminders error:", err);
    return NextResponse.json({ items: [], count: 0 });
  }
}
