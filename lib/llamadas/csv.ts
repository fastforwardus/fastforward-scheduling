import { normalizeWhatsAppPhone, isPlausiblePhone } from "@/lib/phone";

export type ContactIn = { name: string | null; company: string | null; phone: string; phoneE164: string; email: string | null; country: string | null; industry: string | null; notes: string | null };

const HEAD: Record<string, keyof ContactIn> = {
  nombre: "name", name: "name", contacto: "name", contact: "name", persona: "name",
  empresa: "company", company: "company", razon: "company", "razon social": "company", organizacion: "company", negocio: "company",
  telefono: "phone", tel: "phone", phone: "phone", whatsapp: "phone", celular: "phone", movil: "phone", mobile: "phone", numero: "phone",
  email: "email", correo: "email", mail: "email", "e-mail": "email",
  pais: "country", country: "country",
  rubro: "industry", industria: "industry", industry: "industry", sector: "industry", categoria: "industry", producto: "industry", productos: "industry",
  notas: "notes", notes: "notes", observaciones: "notes", comentarios: "notes", nota: "notes",
};

function parseRows(text: string): string[][] {
  const t = text.replace(/^\uFEFF/, "");
  const firstLine = t.split(/\r?\n/)[0] || "";
  const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : (firstLine.includes("\t") ? "\t" : ",");
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

export function parseContactsCsv(text: string): { contacts: ContactIn[]; invalid: number; columns: string[] } {
  const rows = parseRows(text);
  if (!rows.length) return { contacts: [], invalid: 0, columns: [] };
  const header = rows[0].map((h) => h.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  const map = header.map((h) => HEAD[h] ?? (Object.keys(HEAD).find((k) => h.includes(k)) ? HEAD[Object.keys(HEAD).find((k) => h.includes(k))!] : null));
  const contacts: ContactIn[] = []; let invalid = 0;
  for (const r of rows.slice(1)) {
    const c: Record<string, string | null> = { name: null, company: null, phone: null, email: null, country: null, industry: null, notes: null };
    r.forEach((v, i) => { const k = map[i]; if (k && v.trim() && !c[k]) c[k] = v.trim(); });
    if (!c.phone) { invalid++; continue; }
    const e164 = normalizeWhatsAppPhone(c.phone);
    if (!isPlausiblePhone(e164)) { invalid++; continue; }
    contacts.push({ name: c.name, company: c.company, phone: c.phone!, phoneE164: e164, email: c.email ? c.email.toLowerCase() : null, country: c.country, industry: c.industry, notes: c.notes });
  }
  return { contacts, invalid, columns: header };
}
