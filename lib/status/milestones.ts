import { portal } from "./portal-db";

/** Regla de hito siguiente según el tipo de trámite completado. Devuelve null si no aplica. */
export function nextMilestoneFor(filingName: string, serviceType: string | null, completedAt: Date): { label: string; due: Date; kind: string } | null {
  const n = `${filingName} ${serviceType ?? ""}`.toLowerCase();
  const y = completedAt.getFullYear();
  const dec31 = (year: number) => new Date(Date.UTC(year, 11, 31));
  if (/renovaci|renewal/.test(n) && /fda/.test(n)) {
    // Renovación hecha: la próxima según categoría
    if (/medicament|drug|dispositiv|device/.test(n)) return { label: "Renovación anual FDA", due: dec31(y + 1), kind: "fda_annual" };
    return { label: "Renovación bienal FDA", due: dec31(y % 2 === 0 ? y + 2 : y + 1), kind: "fda_biennial" };
  }
  if (/fda/.test(n) && /registro|registration|establecimiento|establishment|mocra|cosm/.test(n)) {
    if (/medicament|drug|dispositiv|device/.test(n)) return { label: "Renovación anual FDA (1 oct – 31 dic)", due: dec31(y), kind: "fda_annual" };
    // Alimentos / cosméticos: bienal en años pares, ventana 1 oct – 31 dic
    const target = y % 2 === 0 ? (completedAt.getUTCMonth() >= 9 ? y + 2 : y) : y + 1;
    return { label: "Renovación bienal FDA (1 oct – 31 dic)", due: dec31(target), kind: "fda_biennial" };
  }
  if (/\bllc\b|operating agreement|sociedad|company formation/.test(n)) return { label: "Annual Report Florida (vence 1 de mayo)", due: new Date(Date.UTC(y + 1, 4, 1)), kind: "llc_annual_report" };
  if (/marca|trademark|uspto/.test(n)) return { label: "Declaración de uso USPTO (Sección 8, entre año 5 y 6)", due: new Date(Date.UTC(y + 5, completedAt.getUTCMonth(), completedAt.getUTCDate())), kind: "uspto_section8" };
  if (/ttb|cola|importer|importador/.test(n)) return null;
  return null;
}

export async function createNextMilestone(filingId: string, actor: string) {
  const [f] = await portal`SELECT f.id, f.client_id, f.name_es, st.service_type FROM filings f LEFT JOIN service_templates st ON st.id = f.template_id WHERE f.id = ${filingId}`;
  if (!f) return null;
  const m = nextMilestoneFor(f.name_es, f.service_type, new Date());
  if (!m) return null;
  const due = m.due.toISOString().slice(0, 10);
  const [exists] = await portal`SELECT id FROM case_milestones WHERE filing_id = ${filingId} AND kind = ${m.kind} AND status = 'pending'`;
  if (exists) return null;
  const [row] = await portal`INSERT INTO case_milestones (client_id, filing_id, label, due_date, kind, created_by) VALUES (${f.client_id}, ${filingId}, ${m.label}, ${due}, ${m.kind}, ${actor}) RETURNING id, label, due_date`;
  await portal`INSERT INTO case_meta (filing_id, key_date, key_date_label) VALUES (${filingId}, ${due}, ${m.label})
               ON CONFLICT (filing_id) DO UPDATE SET key_date = ${due}, key_date_label = ${m.label}, updated_at = now()`;
  await portal`INSERT INTO case_comments (filing_id, author_email, author_name, kind, body) VALUES (${filingId}, 'system', 'Sistema', 'system', ${`Hito siguiente creado: ${m.label} — ${due}`})`;
  return row;
}
