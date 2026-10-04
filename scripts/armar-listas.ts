// Arma las listas de llamadas desde los datos propios y las carga en call_lists / call_contacts (producción).
// Uso: SCHED_URL=... PORTAL_URL=... RENEW_URL=... node --import tsx scripts/armar-listas.ts [apply]
import postgres from "postgres";
import { normalizeWhatsAppPhone, isPlausiblePhone } from "../lib/phone";

const apply = process.argv[2] === "apply";
const s = postgres(process.env.SCHED_URL!, { max: 1 });
const pt = postgres(process.env.PORTAL_URL!, { max: 1 });
const rn = postgres(process.env.RENEW_URL!, { max: 1 });
type C = { name: string | null; company: string | null; phone: string; email: string | null; country: string | null; industry: string | null; notes: string | null };

const GUION = {
  propuestas: `Le enviamos una propuesta comercial que quedó pendiente. Objetivo: saber si sigue interesado, qué lo frenó (precio, tiempos, dudas) y ayudarlo a decidir. Si quiere avanzar, puede pagar la propuesta (el link está en su email) o agendar una reunión con el consultor que la envió. Si ya no le interesa, registrar el motivo.`,
  leads: `Nos consultó por la web hace más de un mes y no llegó a agendar reunión. Objetivo: retomar la consulta ("nos escribió sobre X"), entender en qué etapa está su proyecto de exportar a EE. UU. y agendar la reunión gratuita de 15 minutos con un consultor.`,
  citas: `Tuvo una reunión agendada con nosotros que no se concretó o quedó sin seguimiento. Objetivo: disculparnos si fue nuestro error, preguntar si el proyecto sigue en pie y reagendar la reunión con un consultor. Si ya avanzó con otro proveedor, registrarlo.`,
  renovacion: `Es cliente con registro FDA de alimentos. La renovación bienal es obligatoria entre el 1 de octubre y el 31 de diciembre de 2026; sin renovar, el registro queda cancelado y la mercadería puede ser retenida en aduana. Objetivo: confirmar si ya renovó; si no, cobrar la renovación en la llamada con tarjeta o enviarle la factura cargando sus datos en ffus.link/FDARenew. Si tiene dudas, agendar con su agente.`,
};

async function upsertList(name: string, script: string, contacts: C[]) {
  const seen = new Set<string>(); const rows = [];
  for (const c of contacts) {
    const e = normalizeWhatsAppPhone(c.phone || "");
    if (!isPlausiblePhone(e) || seen.has(e)) continue;
    seen.add(e); rows.push({ ...c, e164: e });
  }
  console.log(`${name}: ${contacts.length} candidatos → ${rows.length} con teléfono válido y único${apply ? "" : " (simulación)"}`);
  if (!apply || !rows.length) return;
  const [l] = await s`INSERT INTO call_lists (name, script, created_by) VALUES (${name}, ${script}, (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1)) RETURNING id`;
  let n = 0;
  for (const r of rows) {
    const ins = await s`INSERT INTO call_contacts (list_id, name, company, phone, phone_e164, email, country, industry, notes)
      VALUES (${l.id}, ${r.name}, ${r.company}, ${r.phone}, ${r.e164}, ${r.email ? r.email.toLowerCase() : null}, ${r.country}, ${r.industry}, ${r.notes})
      ON CONFLICT (list_id, phone_e164) DO NOTHING RETURNING id`;
    if (ins.length) n++;
  }
  console.log(`  → lista ${l.id} creada con ${n} contactos`);
}

(async () => {
  // 1. Propuestas pendientes (teléfono vía la cita de origen)
  const prop = await s`SELECT p.proposal_num, p.total, p.created_at, p.client_name, p.client_email, a.client_company, a.client_whatsapp, a.service_interest, u.full_name AS rep
    FROM proposals p LEFT JOIN appointments a ON a.id::text = p.appointment_id LEFT JOIN users u ON u.id = p.sent_by_id
    WHERE p.status = 'pending' AND p.accepted_at IS NULL AND p.payment_confirmed_at IS NULL AND p.created_at >= '2026-01-01' AND a.client_whatsapp IS NOT NULL ORDER BY p.created_at DESC`;
  await upsertList("Propuestas pendientes 2026", GUION.propuestas, prop.map((r) => ({ name: r.client_name, company: r.client_company, phone: r.client_whatsapp, email: r.client_email, country: null, industry: r.service_interest, notes: `Propuesta ${r.proposal_num} · USD ${r.total} · enviada ${new Date(r.created_at).toISOString().slice(0, 10)} por ${r.rep || "—"}` })));

  // 2. Leads web > 30 días sin cita
  const leads = await s`SELECT nombre, empresa, telefono, email, servicio, mensaje, created_at FROM web_leads w
    WHERE created_at < now() - interval '30 days' AND telefono IS NOT NULL AND NOT EXISTS (SELECT 1 FROM appointments a WHERE lower(a.client_email) = lower(w.email)) ORDER BY created_at DESC`;
  await upsertList("Leads web sin reunión", GUION.leads, leads.map((r) => ({ name: r.nombre, company: r.empresa, phone: r.telefono, email: r.email, country: null, industry: r.servicio, notes: `Consultó el ${new Date(r.created_at).toISOString().slice(0, 10)}${r.mensaje ? `: ${String(r.mensaje).slice(0, 160)}` : ""}` })));

  // 3. Citas pasadas sin resultado (agendadas o no-show)
  const citas = await s`SELECT a.client_name, a.client_company, a.client_whatsapp, a.client_email, a.service_interest, a.scheduled_at, a.status, u.full_name AS rep FROM appointments a LEFT JOIN users u ON u.id = a.assigned_to
    WHERE a.scheduled_at < now() AND a.outcome IS NULL AND a.status <> 'cancelled' AND a.client_whatsapp IS NOT NULL ORDER BY a.scheduled_at DESC`;
  await upsertList("Reuniones sin cerrar", GUION.citas, citas.map((r) => ({ name: r.client_name, company: r.client_company, phone: r.client_whatsapp, email: r.client_email, country: null, industry: r.service_interest, notes: `Cita ${new Date(r.scheduled_at).toISOString().slice(0, 10)} con ${r.rep || "—"} · ${r.status === "no_show" ? "no se presentó" : "sin resultado cargado"}` })));

  // 4. Renovación FDA: clientes del portal con FDA alimentos completado y sin renovación 2026 + facturas de renovación enviadas sin pagar
  const portalFda = await pt`SELECT DISTINCT ON (c.id) c.name, c.company_legal_name, c.whatsapp, c.responsible_phone, c.email, c.country, c.industry, u.name AS agent
    FROM clients c JOIN filings f ON f.client_id = c.id LEFT JOIN service_templates st ON st.id = f.template_id LEFT JOIN users u ON u.id = c.owner_agent_id
    WHERE f.status = 'completed' AND (st.service_type ILIKE '%fda food%' OR f.name_es ILIKE '%registro establecimiento fda%alimentos%')
      AND NOT EXISTS (SELECT 1 FROM filings r WHERE r.client_id = c.id AND r.name_es ILIKE '%renov%' AND r.created_at >= '2026-01-01')`;
  const renewInv = await rn`SELECT facility_name, contact_name, email, phone, country, amount, created_at FROM renewals WHERE status = 'invoice_sent'`;
  await upsertList("Renovación FDA 2026", GUION.renovacion, [
    ...portalFda.map((r) => ({ name: r.name, company: r.company_legal_name, phone: r.whatsapp || r.responsible_phone, email: r.email, country: r.country, industry: r.industry || "alimentos", notes: `Cliente del portal con registro FDA alimentos · agente ${r.agent || "—"} · sin renovación 2026 registrada` })),
    ...renewInv.map((r) => ({ name: r.contact_name, company: r.facility_name, phone: r.phone, email: r.email, country: r.country, industry: "alimentos", notes: `Factura de renovación enviada el ${new Date(r.created_at).toISOString().slice(0, 10)} por USD ${r.amount} y NO pagada · cobrar` })),
  ]);
  await s.end(); await pt.end(); await rn.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
