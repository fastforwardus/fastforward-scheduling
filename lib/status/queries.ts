import { portal } from "./portal-db";

export type WaitingOn = "client" | "authority" | "us" | null;
export type Light = "green" | "yellow" | "red";
export type SlaState = "ok" | "late" | "none";

export type CaseRow = {
  id: string;
  filingName: string;
  filingStatus: string;
  priority: string;
  serviceType: string | null;
  startDate: string | null;
  estimatedEndDate: string | null;
  clientId: string;
  company: string;
  legalName: string | null;
  contactName: string | null;
  email: string | null;
  whatsapp: string | null;
  phone: string | null;
  country: string | null;
  language: string;
  agentName: string | null;
  agentEmail: string | null;
  stageName: string | null;
  stagePos: number | null;
  stageTotal: number;
  stageDone: number;
  stageStartedAt: string | null;
  stageDurationDays: number | null;
  waitingOn: WaitingOn;
  nextStep: string | null;
  keyDate: string | null;
  keyDateLabel: string | null;
  lastActivityAt: string;
  closedReason: string | null;
  closedAt: string | null;
  closedBy: string | null;
  surveyScore: number | null;
  lastComment: string | null;
  lastCommentBy: string | null;
  lastCommentAt: string | null;
  commentCount: number;
  // derivados
  daysInactive: number;
  light: Light;
  sla: SlaState;
  slaDueAt: string | null;
  slaPlannedDays: number | null;
  slaElapsedDays: number | null;
  slaOverDays: number | null;
  summary: string;
};

const DAY = 86400000;

export function waitingLabel(w: WaitingOn): string {
  return w === "client" ? "Cliente" : w === "authority" ? "Autoridad" : w === "us" ? "Nosotros" : "Sin definir";
}

function fmt(d: string | Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-US", { timeZone: "America/New_York", day: "2-digit", month: "2-digit" }).format(new Date(d));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function derive(r: any): CaseRow {
  const now = Date.now();
  for (const suf of [r.legal_name, r.company]) {
    if (suf && typeof r.filing_name === "string" && r.filing_name.toLowerCase().endsWith(` — ${String(suf).toLowerCase()}`)) {
      r.filing_name = r.filing_name.slice(0, r.filing_name.length - String(suf).length - 3).trim();
      break;
    }
  }
  const last = new Date(r.last_activity_at ?? r.created_at);
  const daysInactive = Math.floor((now - last.getTime()) / DAY);
  const light: Light = daysInactive < 7 ? "green" : daysInactive < 14 ? "yellow" : "red";
  let sla: SlaState = "none";
  let slaDueAt: string | null = null;
  let slaPlannedDays: number | null = null;
  let slaElapsedDays: number | null = null;
  let slaOverDays: number | null = null;
  if (r.stage_started_at && r.stage_duration_days != null) {
    slaPlannedDays = Number(r.stage_duration_days);
    slaElapsedDays = Math.floor((now - new Date(r.stage_started_at).getTime()) / DAY);
    slaOverDays = Math.max(0, slaElapsedDays - slaPlannedDays);
    const due = new Date(new Date(r.stage_started_at).getTime() + slaPlannedDays * DAY);
    slaDueAt = due.toISOString();
    sla = due.getTime() >= now ? "ok" : "late";
  }
  const stageTotal = Number(r.stage_total ?? 0);
  const stagePos = r.stage_pos != null ? Number(r.stage_pos) : null;
  const who = r.last_comment_by ?? r.agent_name ?? "el equipo";
  const closed = !!r.closed_at;
  const summary = closed
    ? `${r.filing_name}: cerrado el ${fmt(r.closed_at)} (${r.closed_reason === "completed" ? "completado" : r.closed_reason === "cancelled" ? "cancelado" : "sin respuesta"}).`
    : `${r.filing_name}: ${r.stage_name ? `etapa ${stagePos} de ${stageTotal} (${r.stage_name})` : "sin etapa activa"}${r.waiting_on ? `, esperando a ${waitingLabel(r.waiting_on).toLowerCase()}` : ""}${r.next_step ? ` — próximo paso: ${r.next_step}` : ""}. Última acción ${fmt(r.last_activity_at)} por ${who}.`;
  return {
    id: r.id,
    filingName: r.filing_name,
    filingStatus: r.filing_status,
    priority: r.priority,
    serviceType: r.service_type ?? null,
    startDate: r.start_date ? new Date(r.start_date).toISOString() : null,
    estimatedEndDate: r.estimated_end_date ? new Date(r.estimated_end_date).toISOString() : null,
    clientId: r.client_id,
    company: r.legal_name || r.company,
    legalName: r.legal_name ?? null,
    contactName: r.contact_name || r.company || null,
    email: r.email ?? null,
    whatsapp: r.whatsapp ?? null,
    phone: r.phone ?? null,
    country: r.country ?? null,
    language: r.language ?? "es",
    agentName: r.agent_name ?? null,
    agentEmail: r.agent_email ?? null,
    stageName: r.stage_name ?? null,
    stagePos,
    stageTotal,
    stageDone: Number(r.stage_done ?? 0),
    stageStartedAt: r.stage_started_at ? new Date(r.stage_started_at).toISOString() : null,
    stageDurationDays: r.stage_duration_days != null ? Number(r.stage_duration_days) : null,
    waitingOn: r.waiting_on ?? null,
    nextStep: r.next_step ?? null,
    keyDate: r.key_date ? String(r.key_date) : null,
    keyDateLabel: r.key_date_label ?? null,
    lastActivityAt: last.toISOString(),
    closedReason: r.closed_reason ?? null,
    closedAt: r.closed_at ? new Date(r.closed_at).toISOString() : null,
    closedBy: r.closed_by ?? null,
    surveyScore: r.survey_score != null ? Number(r.survey_score) : null,
    lastComment: r.last_comment ?? null,
    lastCommentBy: r.last_comment_by ?? null,
    lastCommentAt: r.last_comment_at ? new Date(r.last_comment_at).toISOString() : null,
    commentCount: Number(r.comment_count ?? 0),
    daysInactive,
    light,
    sla,
    slaDueAt,
    slaPlannedDays,
    slaElapsedDays,
    slaOverDays,
    summary,
  };
}

const BASE_SELECT = `
  SELECT f.id, f.name_es AS filing_name, f.status AS filing_status, f.priority, f.start_date, f.estimated_end_date, f.created_at,
         c.id AS client_id, c.name AS company, c.company_legal_name AS legal_name, c.responsible_name AS contact_name,
         c.email, c.whatsapp, c.responsible_phone AS phone, c.country, c.preferred_language AS language,
         u.name AS agent_name, u.email AS agent_email,
         st.service_type,
         m.waiting_on, m.next_step, m.key_date, m.key_date_label, m.last_activity_at, m.closed_reason, m.closed_at, m.closed_by, m.survey_score,
         cs.name_es AS stage_name, cs.position AS stage_pos, cs.started_at AS stage_started_at, cs.duration_days AS stage_duration_days,
         (SELECT count(*) FROM filing_stages s WHERE s.filing_id = f.id AND s.status <> 'skipped') AS stage_total,
         (SELECT count(*) FROM filing_stages s WHERE s.filing_id = f.id AND s.status = 'completed') AS stage_done,
         lc.body AS last_comment, lc.author_name AS last_comment_by, lc.created_at AS last_comment_at,
         (SELECT count(*) FROM case_comments cc WHERE cc.filing_id = f.id) AS comment_count
  FROM filings f
  JOIN clients c ON c.id = f.client_id
  LEFT JOIN case_meta m ON m.filing_id = f.id
  LEFT JOIN users u ON u.id = f.assigned_agent_id
  LEFT JOIN service_templates st ON st.id = f.template_id
  LEFT JOIN LATERAL (
    SELECT s.name_es, s.position, s.started_at, s.duration_days
    FROM filing_stages s WHERE s.filing_id = f.id AND s.status IN ('active','pending')
    ORDER BY (s.status = 'active') DESC, s.position ASC LIMIT 1
  ) cs ON true
  LEFT JOIN LATERAL (
    SELECT cc.body, cc.author_name, cc.created_at FROM case_comments cc
    WHERE cc.filing_id = f.id AND cc.kind <> 'system' ORDER BY cc.created_at DESC LIMIT 1
  ) lc ON true
`;

export async function listCases(scope: "open" | "closed"): Promise<CaseRow[]> {
  const where = scope === "open"
    ? `WHERE m.closed_at IS NULL AND f.status NOT IN ('completed','cancelled')`
    : `WHERE m.closed_at IS NOT NULL OR f.status IN ('completed','cancelled')`;
  const order = scope === "open"
    ? `ORDER BY COALESCE(m.last_activity_at, f.created_at) ASC`
    : `ORDER BY COALESCE(m.closed_at, f.actual_end_date, f.created_at) DESC`;
  const rows = await portal.unsafe(`${BASE_SELECT} ${where} ${order}`);
  const out = rows.map(derive);
  if (scope === "open") {
    const rank = { red: 0, yellow: 1, green: 2 };
    out.sort((a, b) => rank[a.light] - rank[b.light] || a.lastActivityAt.localeCompare(b.lastActivityAt));
  }
  return out;
}

export async function getCase(filingId: string) {
  const rows = await portal.unsafe(`${BASE_SELECT} WHERE f.id = $1`, [filingId]);
  if (!rows.length) return null;
  const row = derive(rows[0]);
  const [stages, comments, events, notifications, deliverables, siblings] = await Promise.all([
    portal`SELECT id, position, name_es AS name, description_es AS description, status, started_at, completed_at, duration_days
           FROM filing_stages WHERE filing_id = ${filingId} ORDER BY position`,
    portal`SELECT id, author_email, author_name, kind, body, created_at FROM case_comments WHERE filing_id = ${filingId} ORDER BY created_at DESC`,
    portal`SELECT id, actor_name, action, before, after, created_at FROM case_events WHERE filing_id = ${filingId} ORDER BY created_at DESC LIMIT 100`,
    portal`SELECT id, channel, kind, recipient, status, sent_by, created_at FROM case_notifications WHERE filing_id = ${filingId} ORDER BY created_at DESC LIMIT 50`,
    portal`SELECT id, name_es AS name, filename, blob_url, created_at FROM filing_deliverables WHERE filing_id = ${filingId} ORDER BY created_at DESC`,
    portal`SELECT f.id, f.name_es AS name, f.status, m.closed_at, m.key_date, m.key_date_label
           FROM filings f LEFT JOIN case_meta m ON m.filing_id = f.id
           WHERE f.client_id = ${row.clientId} AND f.id <> ${filingId} ORDER BY f.created_at DESC`,
  ]);
  return { case: row, stages, comments, events, notifications, deliverables, siblings };
}

/** Perfil de cuenta: todos los filings de la empresa + servicios comprados + huecos de upsell. */
export async function getAccount(clientId: string) {
  const [client] = await portal`SELECT id, name, company_legal_name, email, whatsapp, responsible_name, responsible_phone, country, industry,
                                        preferred_language, purchased_services, paid_at, created_at FROM clients WHERE id = ${clientId}`;
  if (!client) return null;
  const rows = await portal.unsafe(`${BASE_SELECT} WHERE c.id = $1 ORDER BY f.created_at DESC`, [clientId]);
  const filings = rows.map(derive);
  const owned = new Set(filings.map((f) => (f.serviceType ?? "").toLowerCase()).filter(Boolean));
  const catalog: { key: string; label: string }[] = [
    { key: "fda", label: "Registro FDA" },
    { key: "trademark", label: "Marca USPTO" },
    { key: "llc", label: "LLC" },
    { key: "label", label: "Label review" },
    { key: "ttb", label: "TTB / COLA" },
    { key: "mocra", label: "MoCRA" },
    { key: "fsvp", label: "FSVP" },
  ];
  const gaps = catalog.filter((c) => ![...owned].some((o) => o.includes(c.key)));
  return { client, filings, gaps };
}

export async function ensureMeta(filingId: string) {
  await portal`INSERT INTO case_meta (filing_id) VALUES (${filingId}) ON CONFLICT (filing_id) DO NOTHING`;
}

export async function touch(filingId: string) {
  await ensureMeta(filingId);
  await portal`UPDATE case_meta SET last_activity_at = now(), updated_at = now() WHERE filing_id = ${filingId}`;
}

export async function logEvent(filingId: string, actor: { email?: string | null; name?: string | null }, action: string, before?: unknown, after?: unknown) {
  type J = Parameters<typeof portal.json>[0];
  const b = before == null ? null : portal.json(before as J);
  const a = after == null ? null : portal.json(after as J);
  await portal`INSERT INTO case_events (filing_id, actor_email, actor_name, action, before, after)
               VALUES (${filingId}, ${actor.email ?? null}, ${actor.name ?? null}, ${action}, ${b}, ${a})`;
}
