export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const vista = searchParams.get("vista") || "abiertos";

  const filtro = vista === "hoy"
    ? sql`and r.due_at < now() + interval '1 day' and r.done_at is null`
    : vista === "todos" ? sql``
    : sql`and r.done_at is null`;

  const rows = await db.execute(sql`
    select r.id, r.title, r.notes, r.due_at, r.original_due_at, r.snooze_count,
           r.lead_email, r.lead_phone, r.done_at, r.notify_channels,
           r.source_type, r.source_id,
           u.full_name as asignado
    from reminders r
    left join users u on u.id = r.assigned_to_user_id
    where r.assigned_to_user_id = ${session.id} ${filtro}
    order by r.due_at asc
    limit 200
  `);

  const items = (Array.isArray(rows) ? rows : []) as Record<string, unknown>[];
  const ahora = Date.now();
  const vencidos = items.filter(r => !r.done_at && new Date(r.due_at as string).getTime() < ahora).length;
  return NextResponse.json({ total: items.length, vencidos, items });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, notes, dueAt, leadEmail, leadPhone, asignadoA, canales } = await req.json();
  if (!title?.trim() || !dueAt)
    return NextResponse.json({ error: "Faltan title o dueAt" }, { status: 400 });

  const destino = asignadoA || session.id;
  const chs: string[] = Array.isArray(canales) && canales.length ? canales : ["app"];
  if (chs.some(c => c !== "app" && c !== "email"))
    return NextResponse.json({ error: "Canal invalido" }, { status: 400 });

  const rows = await db.execute(sql`
    insert into reminders (title, notes, due_at, original_due_at,
                           created_by_user_id, assigned_to_user_id,
                           lead_email, lead_phone, notify_channels)
    values (${title.trim()}, ${notes ?? null}, ${dueAt}, ${dueAt},
            ${session.id}, ${destino},
            ${leadEmail?.trim().toLowerCase() || null}, ${leadPhone || null},
            ${sql.raw("ARRAY[" + chs.map(c => `'${c}'`).join(",") + "]::text[]")})
    returning id, title, due_at
  `);

  const items = (Array.isArray(rows) ? rows : []) as Record<string, unknown>[];
  return NextResponse.json({ ok: true, reminder: items[0] });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, accion, nuevaFecha } = await req.json();
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  if (accion === "completar") {
    await db.execute(sql`
      update reminders set done_at = now(), done_by_user_id = ${session.id}
      where id = ${id} and assigned_to_user_id = ${session.id}`);
  } else if (accion === "deshacer") {
    await db.execute(sql`
      update reminders set done_at = null, done_by_user_id = null
      where id = ${id} and assigned_to_user_id = ${session.id}`);
  } else if (accion === "reprogramar") {
    if (!nuevaFecha) return NextResponse.json({ error: "Falta nuevaFecha" }, { status: 400 });
    await db.execute(sql`
      update reminders
      set due_at = ${nuevaFecha}, snooze_count = snooze_count + 1, last_notified_at = null
      where id = ${id} and assigned_to_user_id = ${session.id}`);
  } else {
    return NextResponse.json({ error: "Accion invalida" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
