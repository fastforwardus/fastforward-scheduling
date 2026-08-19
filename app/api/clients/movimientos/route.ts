export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const email = (searchParams.get("email") || "").trim().toLowerCase();
  const phoneRaw = (searchParams.get("phone") || "").replace(/\D/g, "");
  const phone = phoneRaw ? phoneRaw.slice(-10) : null;

  if (!email && !phone)
    return NextResponse.json({ error: "Falta email o phone" }, { status: 400 });

  const rows = await db.execute(sql`
    select occurred_at, source, kind, actor, description, detail,
           lead_email, lead_phone, lead_company, src_type, src_id
    from v_movimientos
    where (${email}::text <> '' and lead_email = ${email})
       or (${phone}::text is not null and lead_phone = ${phone})
    order by occurred_at desc
    limit 500
  `);

  const r = rows as unknown as Record<string, unknown>;
  const items = (Array.isArray(rows) ? rows : (r.rows as unknown[]) ?? []) as Record<string, unknown>[];
  return NextResponse.json({
    total: items.length,
    debug: { esArray: Array.isArray(rows), llaves: Object.keys(r || {}).slice(0, 5) },
    items,
  });
}
