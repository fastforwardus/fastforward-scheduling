export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === "sales_rep")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const actor = (searchParams.get("actor") || "").trim();
  const fuente = (searchParams.get("source") || "").trim();
  const limite = Math.min(Number(searchParams.get("limit")) || 80, 200);

  const rows = await db.execute(sql`
    select occurred_at, source, kind, actor, description, detail,
           lead_email, lead_company, src_type, src_id
    from v_movimientos
    where occurred_at <= now()
      and (${actor}::text = '' or actor = ${actor})
      and (${fuente}::text = '' or source = ${fuente})
    order by occurred_at desc
    limit ${limite}
  `);

  const items = (Array.isArray(rows) ? rows : []) as Record<string, unknown>[];

  const actores = await db.execute(sql`
    select actor, count(*) n from v_movimientos
    where occurred_at > now() - interval '30 days' and actor is not null
    group by actor order by n desc limit 20
  `);

  return NextResponse.json({
    total: items.length,
    items,
    actores: (Array.isArray(actores) ? actores : []),
  });
}
