"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageCircle, Phone, Mail, X, Copy, Building2, Send, ChevronDown, Search } from "lucide-react";
import type { CaseRow } from "@/lib/status/queries";
import { Sidebar } from "@/components/dashboard/Sidebar";

type User = { id?: string; fullName: string; email: string; role: string; slug?: string; canRecovery?: boolean };
type Scope = "open" | "closed";
type Detail = {
  case: CaseRow;
  stages: { id: string; position: number; name: string; status: string; started_at: string | null; completed_at: string | null; duration_days: number | null }[];
  comments: { id: string; author_name: string; kind: string; body: string; created_at: string }[];
  events: { id: string; actor_name: string | null; action: string; created_at: string }[];
  notifications: { id: string; channel: string; kind: string; recipient: string; status: string; sent_by: string | null; created_at: string }[];
  deliverables: { id: string; name: string; filename: string; blob_url: string; created_at: string }[];
  siblings: { id: string; name: string; status: string; closed_at: string | null; key_date: string | null; key_date_label: string | null }[];
};
type Account = {
  client: { id: string; name: string; company_legal_name: string | null; email: string | null; whatsapp: string | null; responsible_name: string | null; responsible_phone: string | null; country: string | null; industry: string | null; purchased_services: unknown; paid_at: string | null };
  filings: CaseRow[];
  gaps: { key: string; label: string }[];
};

const BLUE = "#0183FF";
const KIND: Record<string, string> = { whatsapp: "WhatsApp", call: "Llamada", email: "Email", meeting: "Reunión", comment: "Nota interna", system: "Sistema" };
const LIGHT = { green: "bg-emerald-500", yellow: "bg-amber-400", red: "bg-red-500" } as const;

const digits = (s: string | null | undefined) => (s || "").replace(/\D/g, "");
const fmtDT = (iso: string | null) => (iso ? new Date(iso).toLocaleString("es-US", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const fmtMiami = (iso: string | null) => (iso ? new Date(iso).toLocaleString("es-US", { timeZone: "America/New_York", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) + " Miami" : "");
const fmtD = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-US", { timeZone: "America/New_York", day: "2-digit", month: "2-digit", year: "2-digit" }) : "—");
const closedLabel = (r: string | null) => (r === "completed" ? "Completado" : r === "cancelled" ? "Cancelado" : r === "no_response" ? "Sin respuesta" : "—");

function ContactButtons({ c, compact }: { c: CaseRow; compact?: boolean }) {
  const wa = digits(c.whatsapp) || digits(c.phone);
  const tel = digits(c.phone) || digits(c.whatsapp);
  const msg = encodeURIComponent(`Hola ${c.contactName || ""}, le escribo de FastForward sobre su trámite "${c.filingName}".`);
  const cls = `inline-flex items-center justify-center rounded-lg border ${compact ? "h-8 w-8" : "h-9 px-3 gap-2 text-sm"}`;
  const off = "opacity-25 cursor-not-allowed";
  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <a className={`${cls} border-emerald-600 text-emerald-700 hover:bg-emerald-50 ${wa ? "" : off}`} title={wa ? "WhatsApp" : "Sin teléfono"} href={wa ? `https://wa.me/${wa}?text=${msg}` : undefined} target="_blank" rel="noreferrer" onClick={(e) => !wa && e.preventDefault()}><MessageCircle className="h-4 w-4" />{!compact && "WhatsApp"}</a>
      <a className={`${cls} border-gray-300 text-gray-800 hover:bg-gray-100 ${tel ? "" : off}`} title={tel ? "Llamar" : "Sin teléfono"} href={tel ? `tel:+${tel}` : undefined} onClick={(e) => !tel && e.preventDefault()}><Phone className="h-4 w-4" />{!compact && "Llamar"}</a>
      <a className={`${cls} border-gray-300 text-gray-800 hover:bg-gray-100 ${c.email ? "" : off}`} title={c.email || "Sin email"} href={c.email ? `mailto:${c.email}` : undefined} onClick={(e) => !c.email && e.preventDefault()}><Mail className="h-4 w-4" />{!compact && "Email"}</a>
    </div>
  );
}

function Section({ title, children, count, open }: { title: string; children: React.ReactNode; count?: number; open?: boolean }) {
  return (
    <details className="group rounded-md border" open={open}>
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50">
        <span>{title}{count != null ? <span className="ml-2 text-xs font-normal text-gray-400">{count}</span> : null}</span>
        <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t px-3 py-3">{children}</div>
    </details>
  );
}

export default function StatusClient({ user }: { user: User }) {
  const isAdmin = user.role === "admin";
  const [tab, setTab] = useState<"all" | "red" | "yellow" | "green" | "closed">("all");
  const [rowsOpen, setRowsOpen] = useState<CaseRow[]>([]);
  const [rowsClosed, setRowsClosed] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [fAgent, setFAgent] = useState("");
  const [fWait, setFWait] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [a, b] = await Promise.all([fetch("/api/status?scope=open", { cache: "no-store" }), fetch("/api/status?scope=closed", { cache: "no-store" })]);
    if (a.ok) setRowsOpen((await a.json()).cases);
    if (b.ok) setRowsClosed((await b.json()).cases);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openDetail = useCallback(async (id: string) => {
    setSel(id); setDetail(null);
    const r = await fetch(`/api/status/${id}`, { cache: "no-store" });
    if (r.ok) setDetail(await r.json());
  }, []);
  useEffect(() => { const id = new URLSearchParams(window.location.search).get("case"); if (id) openDetail(id); }, [openDetail]);

  const scope: Scope = tab === "closed" ? "closed" : "open";
  const rows = scope === "open" ? rowsOpen : rowsClosed;
  const agents = useMemo(() => Array.from(new Set(rowsOpen.map((r) => r.agentName).filter(Boolean) as string[])).sort(), [rowsOpen]);
  const tabs = [
    { key: "all", label: "Todos", count: rowsOpen.length, red: false },
    { key: "red", label: "Más de 14 días", count: rowsOpen.filter((r) => r.light === "red").length, red: true },
    { key: "yellow", label: "7 a 14 días", count: rowsOpen.filter((r) => r.light === "yellow").length, red: false },
    { key: "green", label: "Al día", count: rowsOpen.filter((r) => r.light === "green").length, red: false },
    { key: "closed", label: "Cerrados", count: rowsClosed.length, red: false },
  ] as const;
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) =>
      (tab === "all" || tab === "closed" || r.light === tab) &&
      (!t || [r.company, r.legalName, r.contactName, r.email, r.filingName, r.country, r.nextStep].some((v) => (v || "").toLowerCase().includes(t))) &&
      (!fAgent || r.agentName === fAgent) &&
      (!fWait || (fWait === "none" ? !r.waitingOn : r.waitingOn === fWait)));
  }, [rows, tab, q, fAgent, fWait]);
  const byAgent = useMemo(() => {
    const m = new Map<string, { total: number; red: number }>();
    rowsOpen.forEach((r) => { const k = r.agentName || "Sin asignar"; const v = m.get(k) || { total: 0, red: 0 }; v.total++; if (r.light === "red") v.red++; m.set(k, v); });
    return Array.from(m.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [rowsOpen]);

  const DOT = { red: "#EF4444", yellow: "#EAB308", green: "#22C55E" } as const;
  const pill = (r: CaseRow) => {
    if (r.closedAt) return r.closedReason === "completed" ? { bg: "#EDE9FE", text: "#4C1D95", label: "Completado" } : r.closedReason === "cancelled" ? { bg: "#F3F4F6", text: "#374151", label: "Cancelado" } : { bg: "#FEE2E2", text: "#991B1B", label: "Sin respuesta" };
    if (r.waitingOn === "client") return { bg: "#DBEAFE", text: "#1E40AF", label: "Esperando al cliente" };
    if (r.waitingOn === "authority") return { bg: "#EDE9FE", text: "#4C1D95", label: "Esperando a la autoridad" };
    if (r.waitingOn === "us") return { bg: "#FEE2E2", text: "#991B1B", label: "Nos toca a nosotros" };
    return { bg: "#F3F4F6", text: "#6B7280", label: r.stageName ? `Etapa ${r.stagePos} de ${r.stageTotal}` : "Sin etapa" };
  };

  return (
    <div className="flex min-h-screen" style={{ background: "#F8F9FB" }}>
      <Sidebar user={user} />
      <main className="flex-1 min-w-0 pt-14 lg:pt-0 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#9CA3AF" }}>Clientes · trámites</p>
              <h1 className="text-2xl font-bold" style={{ color: "#000000" }}>Status de casos</h1>
            </div>
            <details className="relative">
              <summary className="cursor-pointer list-none text-xs px-3 py-2 rounded-lg border bg-white" style={{ borderColor: "#E5E7EB", color: "#6B7280" }}>Carga por agente</summary>
              <div className="absolute right-0 z-10 mt-2 w-72 rounded-xl border bg-white p-3 text-sm shadow-lg" style={{ borderColor: "#E5E7EB" }}>
                {byAgent.map(([n, v]) => <div key={n} className="flex justify-between py-1"><span style={{ color: "#000" }}>{n}</span><span style={{ color: "#6B7280" }}>{v.total} · <span style={{ color: v.red ? "#EF4444" : "#6B7280" }}>{v.red} en rojo</span></span></div>)}
              </div>
            </details>
          </div>

          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar empresa, contacto o trámite" className="w-full text-sm pl-9 pr-3 py-2 rounded-lg border bg-white" style={{ borderColor: "#E5E7EB" }} />
            </div>
            <select value={fAgent} onChange={(e) => setFAgent(e.target.value)} className="text-xs px-3 py-2 rounded-lg border bg-white" style={{ borderColor: "#E5E7EB" }}><option value="">Todos los agentes</option>{agents.map((a) => <option key={a}>{a}</option>)}</select>
            <select value={fWait} onChange={(e) => setFWait(e.target.value)} className="text-xs px-3 py-2 rounded-lg border bg-white" style={{ borderColor: "#E5E7EB" }}><option value="">Esperando a: todos</option><option value="client">Cliente</option><option value="authority">Autoridad</option><option value="us">Nosotros</option><option value="none">Sin definir</option></select>
          </div>

          <div className="flex border-b mb-4 overflow-x-auto" style={{ borderColor: "#E5E7EB" }}>
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} className="relative flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all border-b-2 -mb-px whitespace-nowrap"
                style={{ borderBottomColor: tab === t.key ? "#000000" : "transparent", color: tab === t.key ? "#000000" : "#9CA3AF" }}>
                {t.label}
                {t.count > 0 && <span className="px-1.5 py-0.5 rounded-full text-xs font-bold" style={{ background: t.red ? "#EF4444" : tab === t.key ? "#000000" : "#E5E7EB", color: t.red || tab === t.key ? "white" : "#6B7280" }}>{t.count}</span>}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
            {loading && <div className="px-5 py-10 space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-5 rounded animate-pulse" style={{ background: "#F3F4F6" }} />)}</div>}
            {!loading && filtered.length === 0 && <div className="px-5 py-12 text-center text-sm" style={{ color: "#9CA3AF" }}>Sin casos para mostrar</div>}
            {!loading && filtered.map((r) => {
              const pl = pill(r);
              const wa = digits(r.whatsapp) || digits(r.phone);
              const tel = digits(r.phone) || digits(r.whatsapp);
              return (
                <div key={r.id} onClick={() => openDetail(r.id)} className="flex items-center gap-3 px-5 py-3.5 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 transition-colors" style={{ borderColor: "#F0F0F0" }}>
                  <div className="w-14 flex-shrink-0 text-right"><span className="text-sm font-bold" style={{ color: scope === "open" && r.light === "red" ? "#000000" : "#6B7280" }}>{scope === "open" ? `${r.daysInactive} d` : fmtD(r.closedAt).slice(0, 5)}</span></div>
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: scope === "open" ? DOT[r.light] : "#9CA3AF" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: "#111827" }}>{r.company}</span>
                      <span className="text-xs" style={{ color: "#9CA3AF" }}>{r.contactName && r.contactName !== r.company ? r.contactName : r.email}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs" style={{ color: "#6B7280" }}>{r.filingName}</span>
                      {r.stageName && <span className="text-xs" style={{ color: "#9CA3AF" }}>· {r.stagePos}/{r.stageTotal} {r.stageName}</span>}
                    </div>
                  </div>
                  {r.agentName && (
                    <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold" style={{ background: "#000000", fontSize: "9px" }}>{r.agentName[0]}</div>
                      <span className="text-xs" style={{ color: "#6B7280" }}>{r.agentName.split(" ")[0]}</span>
                    </div>
                  )}
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0" style={{ background: pl.bg, color: pl.text }}>{pl.label}</span>
                  <div className="hidden sm:flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <a href={wa ? `https://wa.me/${wa}` : undefined} target="_blank" rel="noreferrer" title="WhatsApp" onClick={(e) => !wa && e.preventDefault()}><MessageCircle className="w-4 h-4" style={{ color: wa ? "#25D366" : "#E5E7EB" }} /></a>
                    <a href={tel ? `tel:+${tel}` : undefined} title="Llamar" onClick={(e) => !tel && e.preventDefault()}><Phone className="w-4 h-4" style={{ color: tel ? "#6B7280" : "#E5E7EB" }} /></a>
                    <a href={r.email ? `mailto:${r.email}` : undefined} title={r.email || ""} onClick={(e) => !r.email && e.preventDefault()}><Mail className="w-4 h-4" style={{ color: r.email ? "#6B7280" : "#E5E7EB" }} /></a>
                  </div>
                  <ChevronDown className="w-4 h-4 -rotate-90" style={{ color: "#9CA3AF" }} />
                </div>
              );
            })}
          </div>
          <p className="text-xs mt-3" style={{ color: "#9CA3AF" }}>{filtered.length} casos</p>
        </div>

        {sel && <DetailPanel id={sel} detail={detail} isAdmin={isAdmin} onClose={() => { setSel(null); setDetail(null); }} onChanged={() => Promise.all([load(), openDetail(sel)])} onAccount={async (cid) => { const r = await fetch(`/api/status/account/${cid}`, { cache: "no-store" }); if (r.ok) setAccount(await r.json()); }} setMsg={setMsg} />}
        {account && <AccountPanel a={account} onClose={() => setAccount(null)} onOpen={(id) => { setAccount(null); openDetail(id); }} />}
        {msg && <div className="fixed bottom-4 right-4 z-50 rounded-xl bg-black px-4 py-2 text-sm text-white shadow-lg">{msg}</div>}
      </main>
    </div>
  );
}

function DetailPanel({ id, detail, isAdmin, onClose, onChanged, onAccount, setMsg }: { id: string; detail: Detail | null; isAdmin: boolean; onClose: () => void; onChanged: () => void; onAccount: (clientId: string) => void; setMsg: (s: string) => void }) {
  const c = detail?.case;
  const [waiting, setWaiting] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [keyDate, setKeyDate] = useState("");
  const [keyLabel, setKeyLabel] = useState("");
  const [kind, setKind] = useState("whatsapp");
  const [text, setText] = useState("");
  const [closeReason, setCloseReason] = useState("completed");
  const [closeNote, setCloseNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (c) { setWaiting(c.waitingOn || ""); setNextStep(c.nextStep || ""); setKeyDate(c.keyDate || ""); setKeyLabel(c.keyDateLabel || ""); } }, [c]);
  const flash = (s: string) => { setMsg(s); setTimeout(() => setMsg(""), 3000); };
  const post = async (body: unknown) => { setBusy(true); const r = await fetch(`/api/status/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); setBusy(false); return { ok: r.ok, j }; };

  async function saveMeta() {
    setBusy(true);
    const r = await fetch(`/api/status/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ waitingOn: waiting || null, nextStep, keyDate: keyDate || null, keyDateLabel: keyLabel }) });
    setBusy(false); flash(r.ok ? "Guardado" : "Error al guardar"); if (r.ok) onChanged();
  }
  async function addComment() { if (!text.trim()) return; const { ok, j } = await post({ action: "comment", kind, body: text }); if (ok) { setText(""); flash("Registrado"); onChanged(); } else flash(j.error || "Error"); }
  async function sendUpdate() { if (!confirm("¿Enviar al cliente la actualización de este trámite?")) return; const { ok, j } = await post({ action: "send_update" }); flash(ok ? `Email: ${j.email} · WhatsApp: ${j.whatsapp}` : j.error || "Error"); if (ok) onChanged(); }
  async function completeStage() { const cur = detail?.stages.find((s) => s.status === "active"); if (!cur) return flash("No hay etapa activa"); if (!confirm(`¿Marcar completada la etapa "${cur.name}"? Impacta en el portal del cliente.`)) return; const { ok, j } = await post({ action: "complete_stage" }); flash(ok ? (j.filingCompleted ? "Trámite completado" : `Ahora en: ${j.nextStage}`) : j.error || "Error"); if (ok) onChanged(); }
  async function closeCase() { if (!confirm("¿Cerrar este caso?")) return; const { ok, j } = await post({ action: "close", reason: closeReason, note: closeNote }); flash(ok ? "Caso cerrado" : j.error || "Error"); if (ok) onChanged(); }
  async function reopen() { const { ok, j } = await post({ action: "reopen" }); flash(ok ? "Caso reabierto" : j.error || "Error"); if (ok) onChanged(); }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <div className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl rounded-l-2xl" onClick={(e) => e.stopPropagation()}>
        {!c ? <div className="p-6 text-sm text-gray-400">Cargando…</div> : (
          <div className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2"><span className={`inline-block h-2.5 w-2.5 rounded-full ${c.closedAt ? "bg-gray-300" : LIGHT[c.light]}`} /><h2 className="text-lg font-semibold text-gray-900">{c.company}</h2></div>
                <div className="text-sm text-gray-700">{c.filingName}</div>
                <div className="text-xs text-gray-500">{c.contactName || "—"}{c.country ? ` · ${c.country}` : ""} · lleva {c.agentName || "sin asignar"}</div>
              </div>
              <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <ContactButtons c={c} />

            <div className="rounded-md p-3" style={{ background: "#F0F7FF", border: `1px solid ${BLUE}` }}>
              <div className="mb-1 flex items-center justify-between text-xs font-medium uppercase text-gray-500">Qué decirle al cliente
                <button onClick={() => { navigator.clipboard.writeText(c.summary); flash("Copiado"); }} className="inline-flex items-center gap-1 text-gray-600 hover:text-black"><Copy className="h-3.5 w-3.5" />Copiar</button></div>
              <p className="text-sm text-gray-900">{c.summary}</p>
              {!c.closedAt && c.sla === "late" && <p className="mt-1 text-xs text-amber-700">Esta etapa tenía {c.slaPlannedDays} días previstos y lleva {c.slaElapsedDays}.</p>}
            </div>

            {!c.closedAt && (
              <div className="rounded-md border p-3">
                <div className="mb-2 text-xs font-medium uppercase text-gray-500">Registrar contacto</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(KIND).filter(([k]) => k !== "system").map(([k, v]) => (
                    <button key={k} onClick={() => setKind(k)} className="rounded-full border px-3 py-1 text-xs" style={kind === k ? { background: BLUE, borderColor: BLUE, color: "#fff" } : {}}>{v}</button>
                  ))}
                </div>
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={kind === "call" ? "Quién llamó, qué preguntó, qué se respondió…" : "Qué se habló, qué quedó pendiente…"} className="mt-2 w-full rounded-md border px-3 py-2 text-sm" />
                <div className="mt-2 text-right"><button disabled={busy || !text.trim()} onClick={addComment} className="rounded-md px-4 py-1.5 text-sm text-white disabled:opacity-40" style={{ background: BLUE }}>Registrar</button></div>
              </div>
            )}

            <div>
              <div className="mb-2 text-xs font-medium uppercase text-gray-500">Historial</div>
              <ul className="space-y-2">
                {detail!.comments.length === 0 && <li className="text-sm text-gray-400">Sin registros todavía.</li>}
                {detail!.comments.map((m) => (
                  <li key={m.id} className={`rounded-md border p-2.5 text-sm ${m.kind === "system" ? "border-dashed bg-gray-50 text-gray-500" : ""}`}>
                    <div className="flex items-center justify-between text-xs text-gray-500"><span><span className="font-medium text-gray-800">{m.author_name}</span> · {KIND[m.kind] || m.kind}</span><span title={fmtMiami(m.created_at)}>{fmtDT(m.created_at)}</span></div>
                    <div className="mt-1 whitespace-pre-wrap text-gray-900">{m.body}</div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2 pt-2">
              {!c.closedAt && (
                <Section title="Datos del caso">
                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="text-xs text-gray-600">Esperando a<select value={waiting} onChange={(e) => setWaiting(e.target.value)} className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"><option value="">Sin definir</option><option value="client">Cliente</option><option value="authority">Autoridad (FDA/TTB/USPTO…)</option><option value="us">Nosotros</option></select></label>
                    <label className="text-xs text-gray-600">Próximo paso<input value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="Ej.: cliente envía certificado" className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm" /></label>
                    <label className="text-xs text-gray-600">Fecha clave<input type="date" value={keyDate} onChange={(e) => setKeyDate(e.target.value)} className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm" /></label>
                    <label className="text-xs text-gray-600">Qué vence<input value={keyLabel} onChange={(e) => setKeyLabel(e.target.value)} placeholder="Ej.: Renovación FDA" className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm" /></label>
                    <div className="md:col-span-2 text-right"><button disabled={busy} onClick={saveMeta} className="rounded-md px-4 py-1.5 text-sm text-white disabled:opacity-50" style={{ background: BLUE }}>Guardar</button></div>
                  </div>
                </Section>
              )}
              <Section title="Etapas" count={detail!.stages.length}>
                <ol className="space-y-1">
                  {detail!.stages.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 text-sm">
                      <span className={`h-2 w-2 rounded-full ${s.status === "completed" ? "bg-emerald-500" : s.status === "active" ? "bg-black" : "bg-gray-200"}`} />
                      <span className={s.status === "active" ? "font-medium text-gray-900" : "text-gray-600"}>{s.position}. {s.name}</span>
                      <span className="ml-auto text-xs text-gray-400">{s.status === "completed" ? `✓ ${fmtD(s.completed_at)}` : s.status === "active" ? `desde ${fmtD(s.started_at)}` : s.status === "skipped" ? "omitida" : "pendiente"}</span>
                    </li>
                  ))}
                </ol>
                {!c.closedAt && detail!.stages.some((s) => s.status === "active") && <div className="mt-3 text-right"><button disabled={busy} onClick={completeStage} className="rounded-md px-3 py-1.5 text-xs text-white disabled:opacity-50" style={{ background: BLUE }}>Completar etapa actual →</button></div>}
              </Section>
              <Section title="Avisar al cliente" count={detail!.notifications.length}>
                <button disabled={busy} onClick={sendUpdate} className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-white disabled:opacity-50" style={{ background: BLUE }}><Send className="h-4 w-4" />Enviar actualización ahora</button>
                <p className="mt-1 text-xs text-gray-500">Email con el estado actual del trámite (y WhatsApp cuando Meta apruebe la plantilla). También sale solo al completar una etapa.</p>
                {detail!.notifications.length > 0 && <ul className="mt-2 space-y-1 text-xs text-gray-600">{detail!.notifications.map((n) => <li key={n.id}>{fmtDT(n.created_at)} · {n.channel} · {n.recipient} · <span className={n.status === "sent" ? "text-emerald-700" : "text-red-600"}>{n.status === "sent" ? "enviado" : "error"}</span></li>)}</ul>}
              </Section>
              <Section title="Cuenta y otros trámites" count={detail!.siblings.length}>
                <button onClick={() => onAccount(c.clientId)} className="mb-2 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50"><Building2 className="h-4 w-4" />Ver perfil de cuenta</button>
                {detail!.siblings.length > 0 && <ul className="space-y-1 text-sm">{detail!.siblings.map((s) => <li key={s.id} className="text-gray-700">{s.name} <span className="text-xs text-gray-400">· {s.closed_at ? `cerrado ${fmtD(s.closed_at)}` : s.status}</span></li>)}</ul>}
              </Section>
              {detail!.deliverables.length > 0 && (
                <Section title="Entregables" count={detail!.deliverables.length}>
                  <ul className="space-y-1 text-sm">{detail!.deliverables.map((d) => <li key={d.id}><a className="text-gray-900 underline" href={d.blob_url} target="_blank" rel="noreferrer">{d.name || d.filename}</a> <span className="text-xs text-gray-400">{fmtD(d.created_at)}</span></li>)}</ul>
                </Section>
              )}
              <Section title={c.closedAt ? "Caso cerrado" : "Cerrar caso"}>
                {!c.closedAt ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="text-xs text-gray-600">Motivo<select value={closeReason} onChange={(e) => setCloseReason(e.target.value)} className="mt-1 block rounded-md border px-2 py-1.5 text-sm"><option value="completed">Completado</option><option value="cancelled">Cancelado</option><option value="no_response">Sin respuesta del cliente</option></select></label>
                    <input value={closeNote} onChange={(e) => setCloseNote(e.target.value)} placeholder="Nota (opcional)" className="flex-1 rounded-md border px-2 py-1.5 text-sm" />
                    <button disabled={busy} onClick={closeCase} className="rounded-md border border-gray-900 px-3 py-1.5 text-sm text-gray-900 hover:bg-gray-100">Cerrar</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{closedLabel(c.closedReason)} el {fmtD(c.closedAt)} por {c.closedBy || "—"}{c.surveyScore ? ` · encuesta ${["", "☹️", "😐", "😊"][c.surveyScore]}` : ""}</span>
                    {isAdmin && <button disabled={busy} onClick={reopen} className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-100">Reabrir</button>}
                  </div>
                )}
              </Section>
              {detail!.events.length > 0 && (
                <Section title="Auditoría" count={detail!.events.length}>
                  <ul className="space-y-0.5 text-xs text-gray-500">{detail!.events.map((e) => <li key={e.id}>{fmtDT(e.created_at)} · {e.actor_name || "sistema"} · {e.action}</li>)}</ul>
                </Section>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AccountPanel({ a, onClose, onOpen }: { a: Account; onClose: () => void; onOpen: (id: string) => void }) {
  const ps = (Array.isArray(a.client.purchased_services) ? a.client.purchased_services : []) as Record<string, unknown>[];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{a.client.company_legal_name || a.client.name}</h2>
            <div className="text-xs text-gray-500">{a.client.responsible_name || a.client.name} · {a.client.email || "—"} · {a.client.whatsapp || a.client.responsible_phone || "—"}{a.client.country ? ` · ${a.client.country}` : ""}</div>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-1 text-xs font-medium uppercase text-gray-500">Trámites ({a.filings.length})</div>
            <ul className="space-y-1 text-sm">{a.filings.map((f) => (
              <li key={f.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-gray-50" onClick={() => onOpen(f.id)}>
                <span className={`h-2 w-2 rounded-full ${f.closedAt ? "bg-gray-300" : LIGHT[f.light]}`} /><span className="text-gray-900">{f.filingName}</span>
                <span className="ml-auto text-xs text-gray-400">{f.closedAt ? "cerrado" : f.stageName ? `${f.stagePos}/${f.stageTotal}` : "—"}</span>
              </li>))}</ul>
          </div>
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-xs font-medium uppercase text-gray-500">Servicios comprados</div>
              {ps.length ? <ul className="text-sm text-gray-700">{ps.map((s, i) => <li key={i}>{String(s.name || s.item_name || s.description || "")}{s.rate || s.item_total ? <span className="text-xs text-gray-400"> · USD {String(s.item_total ?? s.rate)}</span> : null}</li>)}</ul> : <div className="text-sm text-gray-400">Sin detalle</div>}
              {a.client.paid_at && <div className="text-xs text-gray-400">Cliente desde {fmtD(a.client.paid_at)}</div>}
            </div>
            <div>
              <div className="mb-1 text-xs font-medium uppercase text-gray-500">No contratado todavía</div>
              <div className="flex flex-wrap gap-1">{a.gaps.map((g) => <span key={g.key} className="rounded-full border border-dashed px-2 py-0.5 text-xs text-gray-600">{g.label}</span>)}</div>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium uppercase text-gray-500">Vencimientos</div>
              <ul className="text-sm text-gray-700">{a.filings.filter((f) => f.keyDate).map((f) => <li key={f.id}>{f.keyDateLabel || "Fecha clave"}: {f.keyDate} <span className="text-xs text-gray-400">({f.filingName})</span></li>)}{a.filings.every((f) => !f.keyDate) && <li className="text-gray-400">Sin fechas cargadas</li>}</ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
