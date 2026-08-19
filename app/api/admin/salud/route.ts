export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getSession } from "@/lib/session";

// Cada proceso declara donde deja rastro y cada cuanto deberia dejarlo.
// Si el ultimo rastro es mas viejo que el umbral, algo se rompio.
const PROCESOS = [
  { nombre: "Citas nuevas",           consulta: sql`select max(created_at) t from appointments`,                                    horas: 72,  ruta: "/api/book" },
  { nombre: "Adriana (WhatsApp)",     consulta: sql`select max(created_at) t from adriana_messages`,                                horas: 12,  ruta: "webhook meta" },
  { nombre: "Handoffs",               consulta: sql`select max(created_at) t from adriana_handoffs`,                                horas: 168, ruta: "adriana" },
  { nombre: "Propuestas enviadas",    consulta: sql`select max(created_at) t from proposals`,                                       horas: 72,  ruta: "/api/proposals" },
  { nombre: "Recordatorios propuesta",consulta: sql`select max(created_at) t from proposal_events where kind = 'reminder'`,         horas: 48,  ruta: "/api/proposal-reminder" },
  { nombre: "Pagos conciliados",      consulta: sql`select max(payment_confirmed_at) t from proposals`,                             horas: 336, ruta: "/api/payment-check" },
  { nombre: "Llamadas",               consulta: sql`select max(created_at) t from call_logs`,                                       horas: 336, ruta: "/api/voice" },
  { nombre: "Leads del formulario",   consulta: sql`select max(created_at) t from web_leads`,                                       horas: 168, ruta: "/api/webhooks/resend-inbound" },
  { nombre: "Recordatorios propios",  consulta: sql`select max(created_at) t from reminders`,                                       horas: 336, ruta: "/api/reminders-personales" },
  { nombre: "Encuestas",              consulta: sql`select max(submitted_at) t from surveys`,                                       horas: 336, ruta: "/api/survey" },
];

function parseFecha(v: unknown): Date {
  if (v instanceof Date) return v;
  let t = String(v).trim().replace(" ", "T");
  // Postgres devuelve el offset como "+00"; sin los minutos, Date lo rechaza
  if (/([+-])(\d{2})$/.test(t)) t += ":00";
  const d = new Date(t);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ahora = Date.now();
  const items = [];

  for (const p of PROCESOS) {
    let ultimo: string | null = null;
    try {
      const r = await db.execute(p.consulta);
      const filas = (Array.isArray(r) ? r : []) as { t: string | null }[];
      ultimo = filas[0]?.t ?? null;
    } catch { /* si la tabla no existe, queda null */ }

    const ms = ultimo ? ahora - parseFecha(ultimo).getTime() : null;
    const horas = ms === null || !isFinite(ms) ? null : ms / 3600000;
    const estado = horas === null ? "nunca"
      : horas > p.horas ? "frenado"
      : horas > p.horas * 0.6 ? "lento"
      : "ok";

    items.push({ nombre: p.nombre, ruta: p.ruta, ultimo, horas, umbral: p.horas, estado });
  }

  // Cosas que deberian estar en cero y no lo estan
  const alertas = await db.execute(sql`
    select
      (select count(*) from adriana_handoffs where resolved_at is null) handoffs_abiertos,
      (select count(*) from appointments
         where outcome is null and assigned_to is not null
           and status not in ('cancelled','no_show','pending_assignment')
           and scheduled_at < now()) sin_outcome,
      (select count(*) from proposals
         where zoho_invoice_id is not null and payment_confirmed_at is null
           and zoho_invoice_missing_at is null) facturas_impagas,
      (select count(*) from reminders where done_at is null and due_at < now()) recordatorios_vencidos
  `);

  return NextResponse.json({
    items,
    alertas: (Array.isArray(alertas) ? alertas[0] : {}),
  });
}
