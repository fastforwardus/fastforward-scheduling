export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { getZohoTokenPublico } from "@/lib/zoho";

const BASE = "https://www.zohoapis.com/crm/v2";

interface TareaZoho {
  id: string; Subject: string; Status: string; Due_Date: string | null;
  Priority: string | null; Description: string | null;
  Owner?: { email: string; name: string };
  What_Id?: { id: string; name: string };
  Who_Id?: { id: string; name: string };
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const todos = params.get("todos") === "1" && session.role !== "sales_rep";

  try {
    const token = await getZohoTokenPublico();

    // Tareas abiertas, las mas proximas primero
    const res = await fetch(
      `${BASE}/Tasks?fields=Subject,Status,Due_Date,Priority,Description,Owner,What_Id,Who_Id&sort_by=Due_Date&sort_order=asc&per_page=200`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    );
    if (res.status === 204) return NextResponse.json({ total: 0, items: [] });
    const data = await res.json();
    const crudas = (data?.data ?? []) as TareaZoho[];

    const abiertas = crudas.filter(t =>
      t.Status !== "Completed" && t.Status !== "Deferred");

    const mias = todos ? abiertas
      : abiertas.filter(t => t.Owner?.email?.toLowerCase() === session.email.toLowerCase());

    // Cruzar con nuestros leads para saber de que cliente es cada tarea
    const ids = [...new Set(mias.map(t => t.Who_Id?.id).filter(Boolean))] as string[];
    const mapa = new Map<string, string>();
    if (ids.length) {
      const filas = await db.execute(sql`
        select distinct zoho_lead_id, coalesce(nullif(client_company,''), client_name) nombre,
               lower(trim(client_email)) email
        from appointments
        where zoho_lead_id in ${sql.raw("('" + ids.join("','") + "')")}
      `);
      for (const f of (Array.isArray(filas) ? filas : []) as Record<string, string>[]) {
        mapa.set(f.zoho_lead_id, f.email);
      }
    }

    const items = mias.map(t => ({
      id: t.id,
      titulo: t.Subject,
      estado: t.Status,
      vence: t.Due_Date,
      prioridad: t.Priority,
      notas: t.Description,
      owner: t.Owner?.name ?? null,
      cliente: t.Who_Id?.name ?? t.What_Id?.name ?? null,
      leadEmail: t.Who_Id?.id ? mapa.get(t.Who_Id.id) ?? null : null,
      url: t.id ? `https://crm.zoho.com/crm/tab/Tasks/${t.id}` : null,
    }));

    return NextResponse.json({ total: items.length, items });
  } catch (err) {
    console.error("zoho-tareas error:", err);
    return NextResponse.json({ total: 0, items: [], error: "No se pudo consultar Zoho" });
  }
}
