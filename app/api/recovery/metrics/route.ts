export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getSession } from "@/lib/session";

function toRows(res: unknown): Record<string, unknown>[] {
  return (Array.isArray(res) ? res : ((res as { rows?: unknown[] })?.rows ?? [])) as Record<string, unknown>[];
}
const n = (v: unknown) => Number(v ?? 0);

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Admin y rol recovery ven al equipo entero; el resto solo lo suyo
  const todas = session.role === "admin" || session.role === "recovery";
  const filtro = todas ? sql`true` : sql`c.user_id = ${session.id}::uuid`;

  try {
    // Los cortes de dia/semana/mes van en hora Miami, no UTC
    const [tot] = toRows(await db.execute(sql`
      select
        count(*) filter (where (c.created_at at time zone 'America/New_York')::date
                             = (now() at time zone 'America/New_York')::date)::int hoy,
        count(*) filter (where c.created_at >= date_trunc('week', now() at time zone 'America/New_York'))::int semana,
        count(*) filter (where c.created_at >= date_trunc('month', now() at time zone 'America/New_York'))::int mes,
        count(*)::int total,
        count(*) filter (where c.status = 'completed')::int atendidas,
        coalesce(sum(c.duration_sec), 0)::int segundos,
        count(*) filter (where c.outcome is null)::int sin_resultado
      from call_logs c where ${filtro}`));

    const porUsuario = toRows(await db.execute(sql`
      select coalesce(c.user_name, 'Sin identificar') usuario,
             count(*)::int llamadas,
             count(*) filter (where c.status = 'completed')::int atendidas,
             coalesce(sum(c.duration_sec), 0)::int segundos,
             count(*) filter (where c.outcome = 'recuperado')::int recuperados
      from call_logs c where ${filtro}
      group by 1 order by 2 desc limit 20`));

    const porOutcome = toRows(await db.execute(sql`
      select c.outcome, count(*)::int cantidad
      from call_logs c where ${filtro} and c.outcome is not null
      group by 1 order by 2 desc`));

    // Monto de las propuestas efectivamente recuperadas
    const [plata] = toRows(await db.execute(sql`
      select coalesce(sum(p.total), 0)::int usd, count(*)::int propuestas
      from call_logs c
      join proposals p on c.source_type = 'proposal' and p.id::text = c.source_id
      where ${filtro} and c.outcome = 'recuperado'`));

    const porDia = toRows(await db.execute(sql`
      select (c.created_at at time zone 'America/New_York')::date fecha, count(*)::int llamadas
      from call_logs c
      where ${filtro} and c.created_at >= now() - interval '14 days'
      group by 1 order by 1`));

    // Propuestas pendientes segun el seguimiento automatico de WhatsApp.
    // La etapa 4 ya no recibe recordatorios: ese dinero depende del equipo.
    const [prop] = toRows(await db.execute(sql`
      select
        count(*) filter (where coalesce(whatsapp_stage,0) >= 4)::int agotadas_n,
        coalesce(sum(total) filter (where coalesce(whatsapp_stage,0) >= 4), 0)::numeric agotadas_monto,
        count(*) filter (where coalesce(whatsapp_stage,0) between 1 and 3)::int encurso_n,
        coalesce(sum(total) filter (where coalesce(whatsapp_stage,0) between 1 and 3), 0)::numeric encurso_monto,
        count(*) filter (where coalesce(whatsapp_stage,0) = 0)::int sinarrancar_n,
        coalesce(sum(total) filter (where coalesce(whatsapp_stage,0) = 0), 0)::numeric sinarrancar_monto
      from proposals where status = 'pending'`));

    return NextResponse.json({
      propuestas: {
        agotadas:    { n: n(prop?.agotadas_n),    monto: n(prop?.agotadas_monto) },
        enCurso:     { n: n(prop?.encurso_n),     monto: n(prop?.encurso_monto) },
        sinArrancar: { n: n(prop?.sinarrancar_n), monto: n(prop?.sinarrancar_monto) },
      },
      resumen: {
        hoy: n(tot?.hoy), semana: n(tot?.semana), mes: n(tot?.mes), total: n(tot?.total),
        atendidas: n(tot?.atendidas), minutos: Math.round(n(tot?.segundos) / 60),
        sinResultado: n(tot?.sin_resultado),
        tasaContacto: n(tot?.total) > 0 ? Math.round((n(tot?.atendidas) / n(tot?.total)) * 100) : 0,
        recuperados: n(plata?.propuestas), usdRecuperado: n(plata?.usd),
      },
      porUsuario: porUsuario.map(r => ({
        usuario: String(r.usuario), llamadas: n(r.llamadas), atendidas: n(r.atendidas),
        minutos: Math.round(n(r.segundos) / 60), recuperados: n(r.recuperados),
      })),
      porOutcome: porOutcome.map(r => ({ outcome: String(r.outcome), cantidad: n(r.cantidad) })),
      porDia: porDia.map(r => ({ fecha: String(r.fecha).slice(0, 10), llamadas: n(r.llamadas) })),
      esEquipo: todas,
    });
  } catch (err) {
    console.error("recovery/metrics error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
