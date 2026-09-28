import { db } from "@/db";
import { systemConfig, users, timeEntries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ymdNY } from "@/lib/asistencia";

// NGTeco Office no tiene API publica: usamos la API interna de office.ngteco.com.
// Flujo: POST token (login) -> PUT switch_company_v2 (token con empresa) -> GET transactions.
const BASE = "https://office-api.ngteco.com";
const HEADERS: Record<string, string> = {
  accept: "application/json, text/plain, */*",
  "content-type": "application/json",
  accessor: "Web",
  origin: "https://office.ngteco.com",
  referer: "https://office.ngteco.com/att/timecard/transaction",
  timezone: "America/New_York",
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
};

export async function ngtecoCfg(key: string): Promise<string | null> {
  const [r] = await db.select().from(systemConfig).where(eq(systemConfig.key, key)).limit(1);
  return r?.value ?? null;
}
export async function ngtecoSetCfg(key: string, value: string) {
  await db.insert(systemConfig).values({ key, value })
    .onConflictDoUpdate({ target: systemConfig.key, set: { value, updatedAt: new Date() } });
}

async function call(method: string, path: string, body?: unknown, token?: string) {
  const h = { ...HEADERS };
  if (token) h.authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  const txt = await res.text();
  if (!res.ok) throw new Error(`NGTeco ${method} ${path} -> ${res.status}: ${txt.slice(0, 300)}`);
  return JSON.parse(txt);
}

export async function getNgtecoToken(force = false): Promise<string> {
  if (!force) {
    const cached = await ngtecoCfg("NGTECO_ACCESS_TOKEN");
    const exp = Number((await ngtecoCfg("NGTECO_TOKEN_EXP")) || 0);
    if (cached && exp && Date.now() < exp - 30 * 60 * 1000) return cached;
  }
  const [user, pass, company] = await Promise.all([ngtecoCfg("NGTECO_USER"), ngtecoCfg("NGTECO_PASSWORD"), ngtecoCfg("NGTECO_COMPANY_ID")]);
  if (!user || !pass || !company) throw new Error("NGTeco: faltan NGTECO_USER / NGTECO_PASSWORD / NGTECO_COMPANY_ID en system_config");
  const t1 = (await call("POST", "/oauth2/api/v1.0/token", { username: user, password: pass, verify_code: "", verify: false })).data.access as string;
  const t2 = (await call("PUT", "/auth/api/v1.0/companies/switch_company_v2/", { company_id: company }, t1)).data.access as string;
  let expMs = Date.now() + 23 * 3600 * 1000;
  try { const payload = JSON.parse(Buffer.from(t2.split(".")[1], "base64").toString()); if (payload.exp) expMs = payload.exp * 1000; } catch {}
  await ngtecoSetCfg("NGTECO_ACCESS_TOKEN", t2);
  await ngtecoSetCfg("NGTECO_TOKEN_EXP", String(expMs));
  return t2;
}

export interface NgtecoPunch {
  id: string; employee_code: string; employee_name: string; att_date: string;
  attendance_status: string; timezone: string; punch_from: string; verify_type: string; punch_format_time: string;
}

export async function fetchNgtecoPunches(from: string, to: string): Promise<NgtecoPunch[]> {
  let token = await getNgtecoToken();
  const all: NgtecoPunch[] = [];
  let page = 1;
  for (;;) {
    const path = `/att/api/v1.0/transactions/transaction/?current=${page}&pageSize=100&keyword=&date_range=${from}&date_range=${to}`;
    let res;
    try { res = await call("GET", path, undefined, token); }
    catch (e) {
      if (page === 1 && /-> (401|403|500)/.test(String(e))) { token = await getNgtecoToken(true); res = await call("GET", path, undefined, token); }
      else throw e;
    }
    const d = res.data;
    all.push(...(d.data || []));
    if (page >= (d.num_pages || 1)) break;
    page++;
    if (page > 50) break;
  }
  return all;
}

export function punchToDate(p: NgtecoPunch): Date {
  const [mm, dd, yyyy] = p.att_date.split("/");
  return new Date(`${yyyy}-${mm}-${dd}T${p.attendance_status}${p.timezone || "-04:00"}`);
}

export async function syncNgteco(days = 3) {
  const to = ymdNY(new Date());
  const from = ymdNY(new Date(Date.now() - days * 86400000));
  const punches = await fetchNgtecoPunches(from, to);
  const reps = await db.select({ id: users.id, ngtecoId: users.ngtecoId }).from(users);
  const byCode = new Map(reps.filter((r) => r.ngtecoId).map((r) => [r.ngtecoId!.toUpperCase(), r.id]));
  let inserted = 0;
  const sinUsuario = new Set<string>();
  for (const p of punches) {
    const uid = byCode.get((p.employee_code || "").toUpperCase());
    if (!uid) { sinUsuario.add(`${p.employee_code} ${p.employee_name}`); continue; }
    const r = await db.insert(timeEntries).values({
      userId: uid, punchedAt: punchToDate(p), source: "ngteco", kind: "punch",
      externalId: `ngteco:${p.id}`, userAgent: `${p.verify_type} ${p.punch_from}`,
    }).onConflictDoNothing({ target: timeEntries.externalId }).returning({ id: timeEntries.id });
    inserted += r.length;
  }
  const resumen = { at: new Date().toISOString(), from, to, punches: punches.length, inserted, sinUsuario: Array.from(sinUsuario) };
  await ngtecoSetCfg("NGTECO_LAST_SYNC", JSON.stringify(resumen));
  return resumen;
}
