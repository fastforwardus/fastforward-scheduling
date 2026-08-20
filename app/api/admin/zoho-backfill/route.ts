export const runtime = "nodejs";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { autorizarOps } from "@/lib/ops-auth";
import { findZohoLead } from "@/lib/zoho";

export async function GET(req: NextRequest) {
  if (!(await autorizarOps(req)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const dryRun = params.get("apply") !== "1";
  const cap = Math.min(Number(params.get("cap")) || 40, 150);

  // Un email por vez, aunque tenga varias citas
  const filas = await db.execute(sql`
    select lower(trim(client_email)) email, count(*) citas
    from appointments
    where zoho_lead_id is null and client_email is not null and client_email <> ''
    group by 1 order by count(*) desc
    limit ${cap}
  `);
  const emails = (Array.isArray(filas) ? filas : []) as { email: string; citas: number }[];

  const vinculados: Record<string, unknown>[] = [];
  const sinLead: string[] = [];
  let citasActualizadas = 0;

  for (const e of emails) {
    const lead = await findZohoLead(e.email);
    if (!lead) { sinLead.push(e.email); await pausa(120); continue; }

    if (!dryRun) {
      const upd = await db.execute(sql`
        update appointments set zoho_lead_id = ${lead.id}
        where lower(trim(client_email)) = ${e.email} and zoho_lead_id is null
        returning id
      `);
      citasActualizadas += Array.isArray(upd) ? upd.length : 0;

      // De paso, vincular la conversacion de WhatsApp si existe y no tiene id
      await db.execute(sql`
        update adriana_conversations set zoho_lead_id = ${lead.id}
        where lower(trim(lead_email)) = ${e.email} and zoho_lead_id is null
      `);
    }
    vinculados.push({ email: e.email, citas: e.citas, leadId: lead.id, owner: lead.ownerEmail });
    await pausa(120);
  }

  return NextResponse.json({
    dryRun,
    revisados: emails.length,
    vinculados: vinculados.length,
    sinLeadEnZoho: sinLead.length,
    citasActualizadas,
    detalle: { vinculados: vinculados.slice(0, 20), sinLead: sinLead.slice(0, 20) },
  });
}

function pausa(ms: number) { return new Promise(r => setTimeout(r, ms)); }
