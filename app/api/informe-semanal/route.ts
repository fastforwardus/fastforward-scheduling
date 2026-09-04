export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Informe semanal de los viernes.
 *
 * Cinco metricas por rep: citas tomadas, como resultaron, propuestas enviadas,
 * aceptadas y revenue cobrado. La semana va de lunes a hoy, en hora Miami.
 */
const OUTCOMES: Record<string, string> = {
  interested: "Interesado",
  needs_time: "Necesita pensar",
  not_qualified: "No califica",
  proposal_sent: "Propuesta enviada",
  closed: "Cerrado",
};

const usd = (n: number) => "USD " + Math.round(n).toLocaleString("en-US");
const filas = (r: unknown) =>
  (Array.isArray(r) ? r : ((r as { rows?: unknown[] })?.rows ?? [])) as Record<string, unknown>[];
const n = (v: unknown) => Number(v ?? 0);

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("run");
  // Vercel autentica los crons con Authorization: Bearer CRON_SECRET,
  // no con x-vercel-cron: por eso estos dos nunca se ejecutaron.
  const esCron = req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  if (!esCron && token !== process.env.MANUAL_RUN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const soloVer = req.nextUrl.searchParams.get("ver") === "1";

  // Cada periodo define su ventana. El cron corre el dia 1 y el endpoint mira
  // el periodo ya cerrado: el mes/trimestre/año anterior al actual.
  const periodo = (req.nextUrl.searchParams.get("periodo") || "semana") as
    "semana" | "mes" | "trimestre" | "anio";

  const PERIODOS = {
    semana:    { unidad: "week",    titulo: "Informe de la semana",     pie: "Semana desde el lunes" },
    mes:       { unidad: "month",   titulo: "Informe del mes",          pie: "Mes cerrado" },
    trimestre: { unidad: "quarter", titulo: "Informe del trimestre",    pie: "Trimestre cerrado" },
    anio:      { unidad: "year",    titulo: "Informe del año",          pie: "Año cerrado" },
  } as const;
  const cfg = PERIODOS[periodo] ?? PERIODOS.semana;
  const u = cfg.unidad;

  // La semana corre en curso; los demas informan el periodo ya terminado
  const enCurso = periodo === "semana";

  const ahora = sql`now() at time zone 'America/New_York'`;
  const desde = enCurso
    ? sql`date_trunc(${u}, ${ahora})`
    : sql`date_trunc(${u}, ${ahora}) - interval '1 ' || ${u}`;
  const hasta = enCurso ? ahora : sql`date_trunc(${u}, ${ahora})`;

  const porRep = filas(await db.execute(sql`
    with citas as (
      select a.assigned_to rep_id,
        count(*)::int total,
        count(*) filter (where a.status = 'completed')::int completadas,
        count(*) filter (where a.status = 'no_show')::int no_show,
        count(*) filter (where a.status = 'cancelled')::int canceladas
      from appointments a
      where (a.scheduled_at at time zone 'America/New_York') >= ${desde}
        and (a.scheduled_at at time zone 'America/New_York') < ${hasta}
        and a.assigned_to is not null
      group by 1
    ),
    props as (
      select p.sent_by_id rep_id,
        count(*)::int enviadas,
        coalesce(sum(p.total), 0)::int monto_enviado,
        count(*) filter (where p.status = 'accepted')::int aceptadas,
        coalesce(sum(p.total) filter (where p.status = 'accepted'), 0)::int monto_aceptado
      from proposals p
      where (p.created_at at time zone 'America/New_York') >= ${desde}
        and (p.created_at at time zone 'America/New_York') < ${hasta}
        and p.sent_by_id is not null
      group by 1
    ),
    cobrado as (
      select p.sent_by_id rep_id,
        count(*)::int pagadas,
        coalesce(sum(p.total), 0)::int revenue
      from proposals p
      where p.payment_confirmed_at is not null
        and (p.payment_confirmed_at at time zone 'America/New_York') >= ${desde}
        and (p.payment_confirmed_at at time zone 'America/New_York') < ${hasta}
        and p.sent_by_id is not null
      group by 1
    )
    select u.full_name rep,
      coalesce(c.total,0) citas, coalesce(c.completadas,0) completadas,
      coalesce(c.no_show,0) no_show, coalesce(c.canceladas,0) canceladas,
      coalesce(p.enviadas,0) enviadas, coalesce(p.monto_enviado,0) monto_enviado,
      coalesce(p.aceptadas,0) aceptadas, coalesce(p.monto_aceptado,0) monto_aceptado,
      coalesce(k.pagadas,0) pagadas, coalesce(k.revenue,0) revenue
    from users u
    left join citas c on c.rep_id = u.id
    left join props p on p.rep_id = u.id
    left join cobrado k on k.rep_id = u.id
    where u.is_active = true
      and (coalesce(c.total,0) > 0 or coalesce(p.enviadas,0) > 0 or coalesce(k.revenue,0) > 0)
    order by coalesce(k.revenue,0) desc, coalesce(p.monto_aceptado,0) desc
  `));

  const resultados = filas(await db.execute(sql`
    -- outcome es enum: hay que castear antes del coalesce
    select coalesce(a.outcome::text, 'sin_cargar') outcome, count(*)::int n
    from appointments a
    where (a.scheduled_at at time zone 'America/New_York') >= ${desde}
      and (a.scheduled_at at time zone 'America/New_York') < ${hasta}
      and a.status = 'completed'
    group by 1 order by 2 desc
  `));

  const [tot] = filas(await db.execute(sql`
    select
      (select count(*)::int from appointments a
        where (a.scheduled_at at time zone 'America/New_York') >= ${desde}
          and (a.scheduled_at at time zone 'America/New_York') < ${hasta}) citas,
      (select count(*)::int from proposals p
        where (p.created_at at time zone 'America/New_York') >= ${desde}) enviadas,
      (select coalesce(sum(total),0)::int from proposals p
        where (p.created_at at time zone 'America/New_York') >= ${desde}) monto_enviado,
      (select count(*)::int from proposals p
        where p.status = 'accepted' and (p.accepted_at at time zone 'America/New_York') >= ${desde}) aceptadas,
      (select coalesce(sum(total),0)::int from proposals p
        where p.status = 'accepted' and (p.accepted_at at time zone 'America/New_York') >= ${desde}) monto_aceptado,
      (select coalesce(sum(total),0)::int from proposals p
        where p.payment_confirmed_at is not null
          and (p.payment_confirmed_at at time zone 'America/New_York') >= ${desde}) revenue
  `));

  const fila = (r: Record<string, unknown>) => `
    <tr>
      <td style="padding:9px 8px;border-bottom:1px solid #F0F2F5;font-weight:600;color:#27295C;">${r.rep}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #F0F2F5;text-align:center;">${n(r.citas)}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #F0F2F5;text-align:center;color:#16A34A;">${n(r.completadas)}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #F0F2F5;text-align:center;color:${n(r.no_show) ? "#DC2626" : "#9CA3AF"};">${n(r.no_show)}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #F0F2F5;text-align:center;">${n(r.enviadas)}<br><span style="font-size:11px;color:#9CA3AF;">${usd(n(r.monto_enviado))}</span></td>
      <td style="padding:9px 8px;border-bottom:1px solid #F0F2F5;text-align:center;">${n(r.aceptadas)}<br><span style="font-size:11px;color:#9CA3AF;">${usd(n(r.monto_aceptado))}</span></td>
      <td style="padding:9px 8px;border-bottom:1px solid #F0F2F5;text-align:right;font-weight:700;color:#166534;">${usd(n(r.revenue))}</td>
    </tr>`;

  const th = (t: string, al = "center") =>
    `<th style="padding:8px;text-align:${al};font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:rgba(255,255,255,.85);font-weight:600;">${t}</th>`;

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:720px;color:#1a1a1a;">
<div style="background:#27295C;border-radius:12px 12px 0 0;padding:22px 26px;">
  <p style="margin:0;font-size:11px;letter-spacing:2px;color:rgba(255,255,255,.6);text-transform:uppercase;">FastForward</p>
  <h1 style="margin:5px 0 0;font-size:20px;color:#fff;">${cfg.titulo}</h1>
</div>

<div style="background:#fff;border:1px solid #E5E7EB;border-top:none;padding:22px 26px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
    <tr>
      <td style="padding:12px;background:#F8F9FB;border-radius:9px;">
        <p style="margin:0;font-size:22px;font-weight:700;color:#27295C;">${n(tot?.citas)}</p>
        <p style="margin:2px 0 0;font-size:11px;color:#9CA3AF;">citas</p>
      </td>
      <td style="width:9px;"></td>
      <td style="padding:12px;background:#F8F9FB;border-radius:9px;">
        <p style="margin:0;font-size:22px;font-weight:700;color:#27295C;">${n(tot?.enviadas)}</p>
        <p style="margin:2px 0 0;font-size:11px;color:#9CA3AF;">propuestas · ${usd(n(tot?.monto_enviado))}</p>
      </td>
      <td style="width:9px;"></td>
      <td style="padding:12px;background:rgba(201,168,76,.1);border-radius:9px;">
        <p style="margin:0;font-size:22px;font-weight:700;color:#92400E;">${n(tot?.aceptadas)}</p>
        <p style="margin:2px 0 0;font-size:11px;color:#92400E;">aceptadas · ${usd(n(tot?.monto_aceptado))}</p>
      </td>
      <td style="width:9px;"></td>
      <td style="padding:12px;background:rgba(34,197,94,.1);border-radius:9px;">
        <p style="margin:0;font-size:22px;font-weight:700;color:#166534;">${usd(n(tot?.revenue))}</p>
        <p style="margin:2px 0 0;font-size:11px;color:#166534;">cobrado</p>
      </td>
    </tr>
  </table>

  <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;">Por consultor</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
    <thead><tr style="background:#27295C;">
      ${th("Consultor", "left")}${th("Citas")}${th("OK")}${th("No-show")}${th("Enviadas")}${th("Aceptadas")}${th("Cobrado", "right")}
    </tr></thead>
    <tbody>${porRep.length ? porRep.map(fila).join("") :
      `<tr><td colspan="7" style="padding:16px;text-align:center;color:#9CA3AF;">Sin actividad esta semana</td></tr>`}</tbody>
  </table>

  <p style="margin:22px 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;">Resultado de las citas completadas</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
    ${resultados.map(r => `<tr>
      <td style="padding:7px 8px;border-bottom:1px solid #F0F2F5;">${OUTCOMES[String(r.outcome)] || "Sin cargar"}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #F0F2F5;text-align:right;font-weight:600;color:${String(r.outcome) === "sin_cargar" ? "#DC2626" : "#27295C"};">${n(r.n)}</td>
    </tr>`).join("") || `<tr><td style="padding:14px;color:#9CA3AF;">Sin citas completadas</td></tr>`}
  </table>
  ${resultados.some(r => String(r.outcome) === "sin_cargar")
    ? `<p style="margin:10px 0 0;padding:9px 13px;background:#FEF9C3;border-radius:8px;font-size:12px;color:#854D0E;">Hay citas completadas sin resultado cargado. Sin eso no se puede medir qué funciona.</p>` : ""}

  <p style="margin:20px 0 0;font-size:11px;color:#9CA3AF;">
    ${cfg.pie}, hora de Miami. Cobrado es lo que tiene pago confirmado.
  </p>
</div></div>`;

  if (soloVer) {
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  await resend.emails.send({
    from: "FastForward <info@fastfwdus.com>",
    to: (process.env.INFORME_EMAIL || "info@fastfwdus.com").split(","),
    subject: `${cfg.titulo} — ${usd(n(tot?.revenue))} cobrado`,
    html,
  });

  console.log("[informe] enviado | revenue:", n(tot?.revenue), "| citas:", n(tot?.citas));
  return NextResponse.json({ ok: true, revenue: n(tot?.revenue), reps: porRep.length });
}
