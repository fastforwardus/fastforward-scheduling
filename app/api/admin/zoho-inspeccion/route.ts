export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { autorizarOps } from "@/lib/ops-auth";
import { getZohoTokenPublico } from "@/lib/zoho";

const BASE = "https://www.zohoapis.com/crm/v2";

export async function GET(req: NextRequest) {
  if (!(await autorizarOps(req)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await getZohoTokenPublico();
  const h = { Authorization: `Zoho-oauthtoken ${token}` };

  // Tomamos 5 leads que ya tenemos vinculados y miramos que cuelga de ellos
  const filas = await db.execute(sql`
    select distinct zoho_lead_id, client_company, client_name
    from appointments where zoho_lead_id is not null limit 5
  `);
  const leads = (Array.isArray(filas) ? filas : []) as Record<string, string>[];

  const muestra = [];
  for (const l of leads) {
    const id = l.zoho_lead_id;
    const [notas, tareas, adjuntos] = await Promise.all([
      fetch(`${BASE}/Leads/${id}/Notes?per_page=3`, { headers: h }).then(r => r.status === 204 ? null : r.json()).catch(() => null),
      fetch(`${BASE}/Leads/${id}/Tasks?per_page=3`, { headers: h }).then(r => r.status === 204 ? null : r.json()).catch(() => null),
      fetch(`${BASE}/Leads/${id}/Attachments?per_page=3`, { headers: h }).then(r => r.status === 204 ? null : r.json()).catch(() => null),
    ]);
    muestra.push({
      cliente: l.client_company || l.client_name,
      notas: notas?.data?.length ?? 0,
      tareas: tareas?.data?.length ?? 0,
      adjuntos: adjuntos?.data?.length ?? 0,
      ejemploNota: notas?.data?.[0]?.Note_Content?.slice(0, 120) ?? null,
      ejemploTarea: tareas?.data?.[0] ? {
        asunto: tareas.data[0].Subject,
        estado: tareas.data[0].Status,
        vence: tareas.data[0].Due_Date,
        owner: tareas.data[0].Owner?.email,
      } : null,
      ejemploAdjunto: adjuntos?.data?.[0]?.File_Name ?? null,
    });
  }

  return NextResponse.json({ muestra });
}
