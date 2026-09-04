export const runtime = "nodejs";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { findZohoLead, getZohoTokenPublico } from "@/lib/zoho";

type Mov = Record<string, unknown>;

/**
 * Emails del lead desde Zoho CRM.
 *
 * Los correos no viven en nuestra base sino en Zoho, asi que el feed mostraba
 * WhatsApp, citas y propuestas pero ningun email. Se traen aparte y se mezclan.
 * Falla en silencio a proposito: si Zoho no responde, el resto del feed sigue.
 */
async function emailsDeZoho(email: string): Promise<Mov[]> {
  try {
    const lead = await findZohoLead(email);
    if (!lead) return [];

    const token = await getZohoTokenPublico();
    const region = process.env.ZOHO_REGION || "com";
    const r = await fetch(
      `https://www.zohoapis.${region}/crm/v6/Leads/${lead.id}/Emails`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } });

    if (!r.ok) return [];
    const d = await r.json() as { Emails?: Record<string, unknown>[] };

    return (d.Emails || []).map((e) => {
      const from = (e.from ?? {}) as { user_name?: string; email?: string };
      const saliente = String(e.sent_by_me ?? "") === "true" || e.sent_by_me === true;
      return {
        occurred_at: e.time ?? e.sent_time ?? null,
        source: "email",
        kind: "email",
        actor: saliente ? "Nosotros" : (from.user_name || from.email || "Cliente"),
        description: e.subject ?? "(sin asunto)",
        detail: e.summary ? String(e.summary).slice(0, 220) : null,
        lead_email: email,
        lead_phone: null,
        lead_company: null,
        src_type: "zoho_email",
        src_id: String(e.message_id ?? e.id ?? ""),
      };
    }).filter((x) => x.occurred_at);
  } catch (err) {
    console.error("[movimientos] no se pudieron traer los emails de Zoho:", err);
    return [];
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const email = (searchParams.get("email") || "").trim().toLowerCase();
  const phoneRaw = (searchParams.get("phone") || "").replace(/\D/g, "");
  const phone = phoneRaw ? phoneRaw.slice(-10) : null;
  if (!email && !phone)
    return NextResponse.json({ error: "Falta email o phone" }, { status: 400 });

  const [rows, correos] = await Promise.all([
    db.execute(sql`
      select occurred_at, source, kind, actor, description, detail,
             lead_email, lead_phone, lead_company, src_type, src_id
      from v_movimientos
      where (${email}::text <> '' and lead_email = ${email})
         or (${phone}::text is not null and lead_phone = ${phone})
      order by occurred_at desc
      limit 500`),
    email ? emailsDeZoho(email) : Promise.resolve([] as Mov[]),
  ]);

  const r = rows as unknown as Record<string, unknown>;
  const base = (Array.isArray(rows) ? rows : (r.rows as unknown[]) ?? []) as Mov[];

  const items = [...base, ...correos].sort((a, b) =>
    new Date(String(b.occurred_at)).getTime() - new Date(String(a.occurred_at)).getTime());

  return NextResponse.json({ total: items.length, emails: correos.length, items });
}
