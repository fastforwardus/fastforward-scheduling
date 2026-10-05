export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { autorizarOps } from "@/lib/ops-auth";
import { portal } from "@/lib/status/portal-db";
import { listCases } from "@/lib/status/queries";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";
const LOGO_WHITE = "https://scheduling.fastfwdus.com/brand/FF_Logo_06.png";

type Hito = { id: string; label: string; due_date: string; client_id: string; filing_id: string | null; company: string; legal_name: string | null; contact: string | null; whatsapp: string | null; phone: string | null; agent_email: string | null; agent_name: string | null; filing_name: string | null };

const waLink = (phone: string | null, msg: string) => { const d = (phone || "").replace(/\D/g, ""); return d.length >= 8 ? `https://wa.me/${d}?text=${encodeURIComponent(msg)}` : null; };
const fmt = (d: string | Date) => new Date(d).toLocaleDateString("es-US", { timeZone: "America/New_York", day: "2-digit", month: "2-digit", year: "numeric" });

export async function GET(req: NextRequest) {
  if (!(await autorizarOps(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(req.url).searchParams;
  const apply = params.get("apply") === "1";
  const forzarA = params.get("to");

  const open = await listCases("open");
  const inactivos = open.filter((c) => c.daysInactive >= 14);
  const esperando = open.filter((c) => (c.waitingOn === "client" || c.waitingOn === "authority") && c.daysInactive >= 10);
  // No repetir el aviso de inactividad más de una vez por semana
  const yaAvisados = new Set((await portal`SELECT filing_id FROM case_meta WHERE inactivity_alerted_at > now() - interval '7 days'`).map((r) => r.filing_id as string));

  const hitos = (await portal`
    SELECT m.id, m.label, m.due_date, m.client_id, m.filing_id, c.name AS company, c.company_legal_name AS legal_name, c.responsible_name AS contact,
           c.whatsapp, c.responsible_phone AS phone, u.email AS agent_email, u.name AS agent_name, f.name_es AS filing_name
    FROM case_milestones m JOIN clients c ON c.id = m.client_id
    LEFT JOIN filings f ON f.id = m.filing_id LEFT JOIN users u ON u.id = f.assigned_agent_id
    WHERE m.status = 'pending' AND m.due_date <= current_date + 60 AND (m.alerted_at IS NULL OR m.alerted_at < now() - interval '14 days')
    ORDER BY m.due_date`) as unknown as Hito[];

  // Agrupar por agente (email). Sin agente → info@
  type Grupo = { name: string; inactivos: typeof open; esperando: typeof open; hitos: Hito[] };
  const grupos = new Map<string, Grupo>();
  const g = (email: string | null, name: string | null) => { const k = (email || "info@fastfwdus.com").toLowerCase(); if (!grupos.has(k)) grupos.set(k, { name: name || "equipo", inactivos: [], esperando: [], hitos: [] }); return grupos.get(k)!; };
  inactivos.filter((c) => !yaAvisados.has(c.id)).forEach((c) => g(c.agentEmail, c.agentName).inactivos.push(c));
  esperando.filter((c) => !yaAvisados.has(c.id)).forEach((c) => g(c.agentEmail, c.agentName).esperando.push(c));
  hitos.forEach((h) => g(h.agent_email, h.agent_name).hitos.push(h));

  const resumen: Record<string, { inactivos: number; esperando: number; hitos: number; enviado?: string }> = {};
  for (const [email, grp] of grupos) {
    if (!grp.inactivos.length && !grp.esperando.length && !grp.hitos.length) continue;
    resumen[email] = { inactivos: grp.inactivos.length, esperando: grp.esperando.length, hitos: grp.hitos.length };
    const card = (titulo: string, sub: string, detalle: string, botones: string) => `
      <div style="border:1px solid #E5E7EB;border-left:4px solid #0183FF;border-radius:10px;padding:14px 16px;margin:10px 0;">
        <div style="font-size:15px;font-weight:700;color:#000;">${titulo}</div>
        <div style="font-size:13px;color:#4B5563;margin:2px 0 8px;">${sub}</div>
        <div style="font-size:13px;color:#111;background:#F8F9FB;border-radius:8px;padding:8px 10px;">${detalle}</div>
        <div style="margin-top:10px;">${botones}</div>
      </div>`;
    const btn = (href: string, label: string, color = "#0183FF") => `<a href="${href}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:600;margin-right:8px;">${label}</a>`;
    const secc = (titulo: string, items: string[]) => items.length ? `<h3 style="font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#6B7280;margin:28px 0 6px;">${titulo} <span style="background:#0183FF;color:#fff;border-radius:999px;padding:1px 8px;font-size:11px;">${items.length}</span></h3>${items.join("")}` : "";
    const verCaso = (id: string) => btn(`${APP_URL}/dashboard/status?case=${id}`, "Ver caso");
    const html = `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#F8F9FB;">
  <div style="background:#0183FF;border-radius:16px 16px 0 0;padding:22px;text-align:center;"><img src="${LOGO_WHITE}" height="30" alt="FastForward"></div>
  <div style="background:#fff;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 16px 16px;padding:28px;">
    <p style="font-size:18px;font-weight:700;color:#000;margin:0 0 4px;">Hola ${grp.name.split(" ")[0]}, estos casos necesitan acción</p>
    <p style="font-size:12px;color:#6B7280;margin:0;">Resumen diario · ${fmt(new Date())}</p>
    ${secc("Sin movimiento hace más de 14 días", grp.inactivos.map((c) => card(c.company, c.filingName, `<strong>${c.daysInactive} días</strong> sin actividad · etapa ${c.stagePos ?? "-"} de ${c.stageTotal}${c.stageName ? ` · ${c.stageName}` : ""}`, verCaso(c.id))))}
    ${secc("Esperando respuesta hace más de 10 días", grp.esperando.map((c) => { const msg = `Hola ${c.contactName || ""}, le escribo de FastForward sobre su trámite "${c.filingName}". Para continuar necesitamos: ${c.nextStep || "su respuesta"}. ¿Me confirma cuándo podría enviarlo?`; const wa = c.waitingOn === "client" ? waLink(c.whatsapp || c.phone, msg) : null; return card(c.company, c.filingName, `Esperando a <strong>${c.waitingOn === "client" ? "cliente" : "autoridad"}</strong> hace ${c.daysInactive} días${c.nextStep ? ` · ${c.nextStep}` : ""}`, verCaso(c.id) + (wa ? btn(wa, "Reclamar por WhatsApp", "#059669") : "")); }))}
    ${secc("Vencimientos en los próximos 60 días", grp.hitos.map((h) => { const emp = h.legal_name || h.company; const wa = waLink(h.whatsapp || h.phone, `Hola ${h.contact || ""}, le escribo de FastForward. Le recordamos que el ${fmt(h.due_date)} vence: ${h.label} (${emp}). Podemos gestionarlo por usted; ¿quiere que le enviemos la propuesta?`); return card(emp, h.filing_name || "", `${h.label} · <strong>vence ${fmt(h.due_date)}</strong>`, (h.filing_id ? verCaso(h.filing_id) : "") + (wa ? btn(wa, "Avisar por WhatsApp", "#059669") : "")); }))}
    <p style="font-size:12px;color:#9CA3AF;margin:28px 0 0;line-height:1.5;">Este aviso se repite cada semana mientras el caso siga igual. Registra el contacto en Status y deja de aparecer.</p>
  </div>
</div>`;
    if (apply) {
      const to = forzarA || email;
      const r = await resend.emails.send({ from: "FastForward Status <noreply@fastfwdus.com>", to, cc: forzarA ? undefined : "info@fastfwdus.com", subject: `Status: ${grp.inactivos.length + grp.esperando.length} casos para mover · ${grp.hitos.length} vencimientos`, html });
      const err = (r as { error?: { message?: string } }).error;
      resumen[email].enviado = err ? `error: ${err.message}` : to;
      if (!err && !forzarA) {
        const ids = [...grp.inactivos, ...grp.esperando].map((c) => c.id);
        if (ids.length) await portal`UPDATE case_meta SET inactivity_alerted_at = now() WHERE filing_id = ANY(${ids}::uuid[])`;
        const hids = grp.hitos.map((h) => h.id);
        if (hids.length) await portal`UPDATE case_milestones SET alerted_at = now() WHERE id = ANY(${hids}::uuid[])`;
      }
    }
  }
  return NextResponse.json({ dryRun: !apply, agentes: resumen, totales: { inactivos: inactivos.length, esperando: esperando.length, hitos: hitos.length } });
}
