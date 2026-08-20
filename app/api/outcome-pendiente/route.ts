export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { autorizarOps } from "@/lib/ops-auth";

// Solo citas posteriores a esta fecha: no generamos recordatorios retroactivos
// para el historico, que tiene cientos de citas sin outcome.
const DESDE = "2026-08-19";

export async function GET(req: NextRequest) {
  if (!(await autorizarOps(req)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dryRun = new URL(req.url).searchParams.get("apply") !== "1";

  // Citas terminadas hace mas de 30 min, sin outcome, sin recordatorio previo
  const pendientes = await db.execute(sql`
    select a.id, a.client_name, a.client_company, a.client_email,
           a.scheduled_at, a.assigned_to,
           (now()::date - a.scheduled_at::date) dias
    from appointments a
    where a.outcome is null
      and a.assigned_to is not null
      and a.status not in ('cancelled','no_show','pending_assignment')
      and a.scheduled_at < now() - interval '30 minutes'
      and a.scheduled_at >= ${DESDE}::date
      and not exists (
        select 1 from reminders r
        where r.source_type = 'appointment_outcome' and r.source_id = a.id::text
      )
    order by a.scheduled_at
    limit 50
  `);

  const filas = (Array.isArray(pendientes) ? pendientes : []) as Record<string, unknown>[];
  const creados: string[] = [];

  for (const a of filas) {
    const titulo = `Cargar resultado de la cita — ${a.client_company || a.client_name}`;
    if (!dryRun) {
      await db.execute(sql`
        insert into reminders (title, notes, due_at, original_due_at,
                               created_by_user_id, assigned_to_user_id,
                               lead_email, source_type, source_id, notify_channels)
        values (${titulo},
                ${"Cita del " + new Date(String(a.scheduled_at).replace(" ", "T")).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" })},
                now(), now(),
                ${a.assigned_to}, ${a.assigned_to},
                ${String(a.client_email || "").toLowerCase() || null},
                'appointment_outcome', ${String(a.id)},
                ARRAY['app','email']::text[])
      `);
    }
    creados.push(String(a.client_company || a.client_name));
  }

  // Escalar al manager lo que lleva mas de 3 dias sin cargarse
  let escalados = 0;
  if (!dryRun) {
    const esc = await db.execute(sql`
      with managers as (
        select id from users where role in ('sales_manager','admin') and is_active limit 1
      )
      insert into reminders (title, notes, due_at, original_due_at,
                             created_by_user_id, assigned_to_user_id,
                             lead_email, source_type, source_id, notify_channels)
      select 'Sin resultado hace 3 dias — ' || coalesce(a.client_company, a.client_name),
             'Responsable: ' || coalesce(u.full_name, 'sin asignar'),
             now(), now(), m.id, m.id,
             lower(a.client_email),
             'outcome_escalado', a.id::text,
             ARRAY['app']::text[]
      from appointments a
      join users u on u.id = a.assigned_to
      cross join managers m
      where a.outcome is null
        and a.status not in ('cancelled','no_show','pending_assignment')
        and a.scheduled_at < now() - interval '3 days'
        and a.scheduled_at >= ${DESDE}::date
        and not exists (
          select 1 from reminders r
          where r.source_type = 'outcome_escalado' and r.source_id = a.id::text
        )
      returning id
    `);
    escalados = (Array.isArray(esc) ? esc.length : 0);
  }

  // Liberar conversaciones sin actividad: si pasaron 2 dias sin que nadie
  // hable, vuelve a manos de Adriana para que atienda una consulta nueva.
  let liberadas = 0;
  if (!dryRun) {
    const libres = await db.execute(sql`
      update adriana_conversations
      set owner_user_id = null, asignada_at = null, asignada_por = null
      where owner_user_id is not null
        and greatest(
              coalesce(last_user_msg_at, asignada_at),
              coalesce(last_assistant_msg_at, asignada_at)
            ) < now() - interval '2 days'
      returning id
    `);
    liberadas = Array.isArray(libres) ? libres.length : 0;

    // Cerrar los pendientes de esas conversaciones: ya no son de nadie
    if (liberadas > 0) {
      await db.execute(sql`
        update reminders r set done_at = now()
        where r.source_type in ('conversacion','conversacion_respuesta')
          and r.done_at is null
          and not exists (
            select 1 from adriana_conversations c
            where c.id::text = r.source_id and c.owner_user_id is not null
          )
      `);
    }
  }

  return NextResponse.json({ dryRun, encontradas: filas.length, creados, escalados, liberadas });
}
