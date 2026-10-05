import postgres from "postgres";
import { readFileSync } from "fs";
import { normalizeWhatsAppPhone, isPlausiblePhone } from "../lib/phone";
import { csv, GUION_FDA } from "./importar-listas";
const apply = process.argv[2] === "apply";
const s = postgres(process.env.SCHED_URL!, { max: 1 }); const pt = postgres(process.env.PORTAL_URL!, { max: 1 });
(async () => {
  const rows = csv(readFileSync("scripts/listas/fda-quickbooks-sin-telefono.csv", "utf8")).filter((r) => r.email.includes("@"));
  const emails = rows.map((r) => r.email.toLowerCase());
  const [a, p, w, c] = await Promise.all([
    s`SELECT lower(client_email) e, client_whatsapp ph, client_name n FROM appointments WHERE lower(client_email) = ANY(${emails}) AND client_whatsapp IS NOT NULL ORDER BY scheduled_at DESC`,
    s`SELECT lower(pr.client_email) e, a.client_whatsapp ph, pr.client_name n FROM proposals pr JOIN appointments a ON a.id::text = pr.appointment_id WHERE lower(pr.client_email) = ANY(${emails})`,
    s`SELECT lower(email) e, telefono ph, nombre n FROM web_leads WHERE lower(email) = ANY(${emails}) AND telefono IS NOT NULL`,
    pt`SELECT lower(email) e, coalesce(whatsapp, responsible_phone) ph, responsible_name n FROM clients WHERE lower(email) = ANY(${emails})`,
  ]);
  const found = new Map<string, { ph: string; n: string | null; src: string }>();
  for (const [src, list] of [["portal", c], ["cita", a], ["propuesta", p], ["web", w]] as const) for (const r of list as unknown as { e: string; ph: string; n: string | null }[]) if (r.ph && !found.has(r.e)) found.set(r.e, { ph: r.ph, n: r.n, src });
  const out = rows.map((r) => ({ r, f: found.get(r.email.toLowerCase()) })).filter((x) => x.f && isPlausiblePhone(normalizeWhatsAppPhone(x.f.ph)));
  const por: Record<string, number> = {}; out.forEach((x) => { por[x.f!.src] = (por[x.f!.src] || 0) + 1; });
  console.log(`${rows.length} sin teléfono → ${out.length} recuperados ${JSON.stringify(por)}${apply ? "" : " (simulación)"}`);
  if (apply && out.length) {
    const [l] = await s`INSERT INTO call_lists (name, script, created_by) VALUES ('Renovación FDA (QuickBooks, teléfono recuperado)', ${GUION_FDA}, (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1)) RETURNING id`;
    let n = 0;
    for (const { r, f } of out) { const e = normalizeWhatsAppPhone(f!.ph); const ins = await s`INSERT INTO call_contacts (list_id, name, company, phone, phone_e164, email, country, industry, notes) VALUES (${l.id}, ${r.nombre || f!.n}, ${r.empresa}, ${f!.ph}, ${e}, ${r.email.toLowerCase()}, null, ${r.rubro}, ${r.notas + ` · teléfono tomado de ${f!.src}`}) ON CONFLICT (list_id, phone_e164) DO NOTHING RETURNING id`; if (ins.length) n++; }
    console.log(`  → lista creada con ${n} contactos`);
  }
  await s.end(); await pt.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
