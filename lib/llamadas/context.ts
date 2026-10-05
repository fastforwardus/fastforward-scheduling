import { db } from "@/db";
import { sql } from "drizzle-orm";
import { portal } from "@/lib/status/portal-db";

export type Ctx = {
  isClient: boolean;
  client?: { name: string; company: string | null; services: string[]; filings: number; agent: string | null };
  proposal?: { num: string; status: string; total: string; createdAt: string };
  appointment?: { at: string; status: string; outcome: string | null; rep: string | null };
  webLead?: { at: string; servicio: string | null; mensaje: string | null };
  pitch?: { apertura: string; oferta: string; preguntas: string[]; cierre: string; generatedAt: string };
};

const tail = (p: string) => p.replace(/\D/g, "").slice(-9);

export async function buildContext(c: { phoneE164: string; email: string | null }): Promise<Ctx> {
  const ctx: Ctx = { isClient: false };
  const t = tail(c.phoneE164);
  const email = c.email?.toLowerCase() || null;

  // Portal: cliente existente
  try {
    const rows = await portal`
      SELECT c.name, c.company_legal_name, c.purchased_services, u.name AS agent,
             (SELECT count(*) FROM filings f WHERE f.client_id = c.id) AS filings
      FROM clients c LEFT JOIN users u ON u.id = c.owner_agent_id
      WHERE (${email}::text IS NOT NULL AND lower(c.email) = ${email}) OR right(regexp_replace(coalesce(c.whatsapp, ''), '\\D', '', 'g'), 9) = ${t}
      LIMIT 1`;
    if (rows[0]) {
      const ps = Array.isArray(rows[0].purchased_services) ? (rows[0].purchased_services as Record<string, unknown>[]) : [];
      ctx.isClient = true;
      ctx.client = { name: rows[0].name, company: rows[0].company_legal_name, services: ps.map((s) => String(s.name || s.item_name || s.description || "")).filter(Boolean), filings: Number(rows[0].filings), agent: rows[0].agent };
    }
  } catch {}

  // Scheduling: propuesta, cita, lead web
  try {
    const p = await db.execute(sql`SELECT proposal_num, status, total, created_at FROM proposals WHERE ${email}::text IS NOT NULL AND lower(client_email) = ${email} ORDER BY created_at DESC LIMIT 1`);
    const pr = (p as unknown as Record<string, unknown>[])[0];
    if (pr) ctx.proposal = { num: String(pr.proposal_num), status: String(pr.status), total: String(pr.total), createdAt: new Date(String(pr.created_at)).toISOString() };
    const a = await db.execute(sql`SELECT a.scheduled_at, a.status, a.outcome, u.full_name AS rep FROM appointments a LEFT JOIN users u ON u.id = a.assigned_to
      WHERE (${email}::text IS NOT NULL AND lower(a.client_email) = ${email}) OR right(regexp_replace(coalesce(a.client_whatsapp, ''), '\\D', '', 'g'), 9) = ${t}
      ORDER BY a.scheduled_at DESC LIMIT 1`);
    const ar = (a as unknown as Record<string, unknown>[])[0];
    if (ar) ctx.appointment = { at: new Date(String(ar.scheduled_at)).toISOString(), status: String(ar.status), outcome: ar.outcome ? String(ar.outcome) : null, rep: ar.rep ? String(ar.rep) : null };
    const w = await db.execute(sql`SELECT created_at, servicio, mensaje FROM web_leads WHERE (${email}::text IS NOT NULL AND lower(email) = ${email}) OR right(regexp_replace(coalesce(telefono, ''), '\\D', '', 'g'), 9) = ${t} ORDER BY created_at DESC LIMIT 1`);
    const wr = (w as unknown as Record<string, unknown>[])[0];
    if (wr) ctx.webLead = { at: new Date(String(wr.created_at)).toISOString(), servicio: wr.servicio ? String(wr.servicio) : null, mensaje: wr.mensaje ? String(wr.mensaje) : null };
  } catch {}
  return ctx;
}

/** "Qué decirle": guion personalizado por contacto, generado con Claude a partir del guion de la lista. */
export async function generatePitch(contact: { name: string | null; company: string | null; country: string | null; industry: string | null; notes: string | null }, listScript: string | null, ctx: Ctx): Promise<Ctx["pitch"] | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const facts = [
    ctx.isClient ? `YA ES CLIENTE de FastForward (${ctx.client?.company || ctx.client?.name}); servicios comprados: ${ctx.client?.services.join(", ") || "sin detalle"}; trámites: ${ctx.client?.filings}; agente: ${ctx.client?.agent || "—"}.` : "No es cliente todavía.",
    ctx.proposal ? `Tiene una propuesta ${ctx.proposal.num} en estado ${ctx.proposal.status} por USD ${ctx.proposal.total} (${ctx.proposal.createdAt.slice(0, 10)}).` : "",
    ctx.appointment ? `Tuvo una cita el ${ctx.appointment.at.slice(0, 10)} (${ctx.appointment.status}${ctx.appointment.outcome ? `, resultado ${ctx.appointment.outcome}` : ""}) con ${ctx.appointment.rep || "el equipo"}.` : "",
    ctx.webLead ? `Consultó por la web el ${ctx.webLead.at.slice(0, 10)}${ctx.webLead.servicio ? ` sobre ${ctx.webLead.servicio}` : ""}.` : "",
  ].filter(Boolean).join("\n");
  const prompt = `Eres el asistente de una SDR de FastForward (consultora de Miami: registro FDA, MoCRA, etiquetas, marcas USPTO, LLC, TTB, USDA, Amazon). Ella llama por teléfono para ofrecer una reunión gratuita de 15 minutos con un consultor. Escribe en español neutro, breve, natural para decir en voz alta.

Guion base de la lista:
${listScript || "(sin guion; usa el estándar: presentarse, preguntar si exportan o quieren exportar a EE. UU., ofrecer reunión gratuita)"}

Contacto: ${contact.name || "—"} · Empresa: ${contact.company || "—"} · País: ${contact.country || "—"} · Rubro/producto: ${contact.industry || "—"} · Notas: ${contact.notes || "—"}
Lo que sabemos:
${facts}

Responde SOLO con JSON: {"apertura": "2 frases para abrir la llamada", "oferta": "qué servicio concreto ofrecerle y por qué le sirve (2-3 frases)", "preguntas": ["pregunta 1", "pregunta 2"], "cierre": "cómo proponer la reunión (1-2 frases)"}`;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 600, messages: [{ role: "user", content: prompt }] }),
    });
    const j = (await r.json()) as { content?: { type: string; text?: string }[] };
    const text = (j.content || []).map((x) => x.text || "").join("").replace(/```json|```/g, "").trim();
    const p = JSON.parse(text);
    return { apertura: String(p.apertura || ""), oferta: String(p.oferta || ""), preguntas: Array.isArray(p.preguntas) ? p.preguntas.map(String) : [], cierre: String(p.cierre || ""), generatedAt: new Date().toISOString() };
  } catch (e) {
    console.error("[llamadas] pitch falló:", e);
    return null;
  }
}
