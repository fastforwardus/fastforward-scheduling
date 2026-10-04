export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { parseContactsCsv } from "@/lib/llamadas/csv";

const ALLOWED = ["admin", "sales_manager", "caller"];

export async function GET() {
  const s = await getSession();
  if (!s || !ALLOWED.includes(s.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const rows = await db.execute(sql`
    SELECT l.id, l.name, l.script, l.active, l.created_at, u.full_name AS created_by,
      count(c.id)::int AS total,
      count(c.id) FILTER (WHERE c.status = 'pending')::int AS pending,
      count(c.id) FILTER (WHERE c.status = 'callback')::int AS callback,
      count(c.id) FILTER (WHERE c.status = 'done')::int AS done,
      count(c.id) FILTER (WHERE c.status = 'invalid')::int AS invalid,
      count(c.id) FILTER (WHERE c.appointment_id IS NOT NULL)::int AS scheduled
    FROM call_lists l LEFT JOIN users u ON u.id = l.created_by LEFT JOIN call_contacts c ON c.list_id = l.id
    GROUP BY l.id, u.full_name ORDER BY l.active DESC, l.created_at DESC`);
  return NextResponse.json({ lists: rows });
}

/** POST { name, script?, csv } — crea la lista e importa contactos del CSV (texto). */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || !["admin", "sales_manager"].includes(s.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { name, script, csv, listId } = await req.json();
  const parsed = parseContactsCsv(String(csv || ""));
  if (!listId && !String(name || "").trim()) return NextResponse.json({ error: "Falta el nombre de la lista" }, { status: 400 });
  if (!parsed.contacts.length) return NextResponse.json({ error: `No se encontraron teléfonos válidos. Columnas detectadas: ${parsed.columns.join(", ") || "ninguna"}` }, { status: 400 });
  let id = listId as string | undefined;
  if (!id) {
    const r = await db.execute(sql`INSERT INTO call_lists (name, script, created_by) VALUES (${String(name).trim()}, ${script || null}, ${s.id}) RETURNING id`);
    id = String((r as unknown as { id: string }[])[0].id);
  }
  let inserted = 0;
  for (const c of parsed.contacts) {
    const r = await db.execute(sql`INSERT INTO call_contacts (list_id, name, company, phone, phone_e164, email, country, industry, notes)
      VALUES (${id}, ${c.name}, ${c.company}, ${c.phone}, ${c.phoneE164}, ${c.email}, ${c.country}, ${c.industry}, ${c.notes})
      ON CONFLICT (list_id, phone_e164) DO NOTHING RETURNING id`);
    if ((r as unknown as unknown[]).length) inserted++;
  }
  return NextResponse.json({ ok: true, listId: id, inserted, duplicates: parsed.contacts.length - inserted, invalid: parsed.invalid, columns: parsed.columns });
}

/** PATCH { id, script?, active?, name? } */
export async function PATCH(req: NextRequest) {
  const s = await getSession();
  if (!s || !["admin", "sales_manager"].includes(s.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id, script, active, name } = await req.json();
  if (!id) return NextResponse.json({ error: "id" }, { status: 400 });
  if (script !== undefined) await db.execute(sql`UPDATE call_lists SET script = ${script || null} WHERE id = ${id}`);
  if (active !== undefined) await db.execute(sql`UPDATE call_lists SET active = ${!!active} WHERE id = ${id}`);
  if (name !== undefined && String(name).trim()) await db.execute(sql`UPDATE call_lists SET name = ${String(name).trim()} WHERE id = ${id}`);
  return NextResponse.json({ ok: true });
}
