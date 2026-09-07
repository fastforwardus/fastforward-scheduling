export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdmin = session.role === "admin";

  // activity_logs: acciones con usuario identificado (facturacion).
  // proposal_events: historial del ciclo de la propuesta, sin usuario propio,
  // por eso el actor se toma del dueño de la propuesta.
  const rows = await db.execute(sql`
    SELECT * FROM (
      SELECT al.created_at, u.full_name AS actor, al.action AS tipo,
             al.details AS detalle, p.proposal_num, p.client_name
      FROM activity_logs al
      LEFT JOIN users u ON u.id = al.user_id
      LEFT JOIN proposals p ON p.id = al.entity_id
      WHERE ${isAdmin ? sql`1=1` : sql`al.user_id::text = ${session.id}`}

      UNION ALL

      SELECT e.created_at,
             COALESCE(us.full_name, u.full_name, 'sistema') AS actor,
             e.kind AS tipo, e.detail AS detalle, p.proposal_num, p.client_name
      FROM proposal_events e
      JOIN proposals p ON p.id = e.proposal_id
      LEFT JOIN appointments a ON a.id::text = p.appointment_id::text
      LEFT JOIN users u ON u.id::text = a.assigned_to::text
      LEFT JOIN users us ON us.id::text = p.sent_by_id::text
      WHERE ${isAdmin ? sql`1=1` : sql`(p.sent_by_id::text = ${session.id} OR a.assigned_to::text = ${session.id})`}
    ) t
    ORDER BY created_at DESC
    LIMIT 200
  `);

  return NextResponse.json({
    esAdmin: isAdmin,
    eventos: (Array.isArray(rows) ? rows : []) as Record<string, unknown>[],
  });
}
