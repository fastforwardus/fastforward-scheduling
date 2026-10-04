export const runtime = "nodejs";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { getQBToken } from "@/lib/quickbooks";
import { normalizeWhatsAppPhone, isPlausiblePhone } from "@/lib/phone";

const QB_BASE = `https://quickbooks.api.intuit.com/v3/company/${process.env.QB_REALM_ID}`;
const FDA = /fda|food facility|registro|renovaci|renewal|mocra|cosm/i;
const NOT = /etiqueta|label|marca|trademark|llc|ttb|usda|fsvp/i;

/** GET ?apply=1 → crea la lista "Renovación FDA (QuickBooks 2023-2025)". Sin apply, simula. */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const apply = new URL(req.url).searchParams.get("apply") === "1";
  const token = await getQBToken();
  const h = { Authorization: `Bearer ${token}`, Accept: "application/json" };

  // Facturas desde 2023, paginadas
  const invoices: Record<string, unknown>[] = [];
  for (let start = 1; start < 20000; start += 1000) {
    const q = encodeURIComponent(`SELECT * FROM Invoice WHERE TxnDate >= '2023-01-01' STARTPOSITION ${start} MAXRESULTS 1000`);
    const r = await fetch(`${QB_BASE}/query?query=${q}&minorversion=65`, { headers: h });
    const j = await r.json();
    const batch = (j.QueryResponse?.Invoice || []) as Record<string, unknown>[];
    invoices.push(...batch);
    if (batch.length < 1000) break;
  }

  // Clientes con alguna línea FDA
  type Cust = { id: string; name: string; services: Set<string>; last: string; total: number };
  const custs = new Map<string, Cust>();
  for (const inv of invoices) {
    const ref = inv.CustomerRef as { value?: string; name?: string } | undefined;
    if (!ref?.value) continue;
    const lines = ((inv.Line as Record<string, unknown>[]) || []).filter((l) => l.DetailType === "SalesItemLineDetail");
    const svcs = lines.map((l) => String(l.Description || (l.SalesItemLineDetail as { ItemRef?: { name?: string } })?.ItemRef?.name || "")).filter((x) => FDA.test(x) && !NOT.test(x));
    if (!svcs.length) continue;
    const c = custs.get(ref.value) || { id: ref.value, name: ref.name || "", services: new Set<string>(), last: "", total: 0 };
    svcs.forEach((x) => c.services.add(x.slice(0, 60)));
    const d = String(inv.TxnDate || ""); if (d > c.last) c.last = d;
    c.total += Number(inv.TotalAmt || 0);
    custs.set(ref.value, c);
  }

  // Datos de contacto de cada cliente (teléfono, email, país)
  const out: { name: string | null; company: string; phone: string; e164: string; email: string | null; country: string | null; notes: string }[] = [];
  let sinTel = 0;
  for (const c of custs.values()) {
    const r = await fetch(`${QB_BASE}/customer/${c.id}?minorversion=65`, { headers: h });
    const cu = ((await r.json()).Customer || {}) as Record<string, unknown>;
    const phone = String((cu.Mobile as { FreeFormNumber?: string })?.FreeFormNumber || (cu.PrimaryPhone as { FreeFormNumber?: string })?.FreeFormNumber || (cu.AlternatePhone as { FreeFormNumber?: string })?.FreeFormNumber || "");
    const email = String((cu.PrimaryEmailAddr as { Address?: string })?.Address || "") || null;
    const country = String((cu.BillAddr as { Country?: string })?.Country || "") || null;
    const e164 = normalizeWhatsAppPhone(phone);
    if (!isPlausiblePhone(e164)) { sinTel++; continue; }
    const person = [cu.GivenName, cu.FamilyName].filter(Boolean).join(" ") || null;
    out.push({ name: person, company: String(cu.CompanyName || c.name), phone, e164, email, country, notes: `QuickBooks · última factura FDA ${c.last} · ${[...c.services].join(" | ")} · total USD ${Math.round(c.total)}` });
  }

  let created: { listId: string; inserted: number } | null = null;
  if (apply && out.length) {
    const [l] = (await db.execute(sql`INSERT INTO call_lists (name, script, created_by) VALUES ('Renovación FDA (QuickBooks 2023-2025)',
      ${"Es cliente que pagó registro o renovación FDA en 2023-2025 (ver notas). La renovación bienal de alimentos es obligatoria entre el 1 de octubre y el 31 de diciembre de 2026; cosméticos (MoCRA) también renueva. Objetivo: confirmar si ya renovó; si no, cobrar en la llamada con tarjeta o enviar factura cargando los datos en ffus.link/FDARenew. Si duda, agendar con un consultor."}, ${s.id}) RETURNING id`) as unknown as { id: string }[]);
    let inserted = 0;
    for (const c of out) {
      const r = await db.execute(sql`INSERT INTO call_contacts (list_id, name, company, phone, phone_e164, email, country, industry, notes)
        VALUES (${l.id}, ${c.name}, ${c.company}, ${c.phone}, ${c.e164}, ${c.email ? c.email.toLowerCase() : null}, ${c.country}, 'FDA', ${c.notes})
        ON CONFLICT (list_id, phone_e164) DO NOTHING RETURNING id`);
      if ((r as unknown as unknown[]).length) inserted++;
    }
    created = { listId: String(l.id), inserted };
  }
  return NextResponse.json({ invoices: invoices.length, clientesFDA: custs.size, conTelefono: out.length, sinTelefono: sinTel, muestra: out.slice(0, 5).map((c) => ({ company: c.company, phone: c.phone, country: c.country, notes: c.notes })), created });
}
