import postgres from "postgres";
import { readFileSync, existsSync } from "fs";
import { normalizeWhatsAppPhone, isPlausiblePhone } from "../lib/phone";
const apply = process.argv[2] === "apply";
const s = postgres(process.env.SCHED_URL!, { max: 1 });
export function csv(t: string) { const lines = t.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean); const h = lines[0].split(","); return lines.slice(1).map((l) => { const c: string[] = []; let cur = "", q = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (q) { if (ch === '"') { if (l[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; } else if (ch === '"') q = true; else if (ch === ",") { c.push(cur); cur = ""; } else cur += ch; } c.push(cur); return Object.fromEntries(h.map((k, i) => [k, c[i] || ""])); }); }
export const GUION_FDA = "Es cliente que pagó registro o renovación FDA en 2023-2025 (ver notas). La renovación bienal de alimentos es obligatoria entre el 1 de octubre y el 31 de diciembre de 2026; cosméticos (MoCRA) también renueva. Objetivo: confirmar si ya renovó; si no, cobrar en la llamada con tarjeta o enviar factura cargando los datos en ffus.link/FDARenew. Si duda, agendar con un consultor.";
const FILES = [{ file: "lista-renovacion-fda-quickbooks-2023-2025.csv", name: "Renovación FDA (QuickBooks 2023-2025)", script: GUION_FDA }];
if (process.argv[1]?.endsWith("importar-listas.ts")) (async () => {
  for (const f of FILES) {
    const path = `scripts/listas/${f.file}`;
    if (!existsSync(path)) { console.log(`FALTA ${path}`); continue; }
    const rows = csv(readFileSync(path, "utf8"));
    const ok = rows.map((r) => ({ ...r, e164: normalizeWhatsAppPhone(r.telefono) })).filter((r) => isPlausiblePhone(r.e164));
    console.log(`${f.name}: ${rows.length} filas → ${ok.length} válidas${apply ? "" : " (simulación)"}`);
    if (!apply || !ok.length) continue;
    const [l] = await s`INSERT INTO call_lists (name, script, created_by) VALUES (${f.name}, ${f.script}, (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1)) RETURNING id`;
    let n = 0;
    for (const r of ok) { const ins = await s`INSERT INTO call_contacts (list_id, name, company, phone, phone_e164, email, country, industry, notes) VALUES (${l.id}, ${r.nombre || null}, ${r.empresa || null}, ${r.telefono}, ${r.e164}, ${r.email ? r.email.toLowerCase() : null}, ${r.pais || null}, ${r.rubro || null}, ${r.notas || null}) ON CONFLICT (list_id, phone_e164) DO NOTHING RETURNING id`; if (ins.length) n++; }
    console.log(`  → lista creada con ${n} contactos`);
  }
  await s.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
