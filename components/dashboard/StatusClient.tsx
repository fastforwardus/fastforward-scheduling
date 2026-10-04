"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageCircle, Phone, Mail, X, Copy, Building2, RotateCcw, CheckCircle2 } from "lucide-react";
import type { CaseRow } from "@/lib/status/queries";

type Scope = "open" | "closed";
type Detail = {
  case: CaseRow;
  stages: { id: string; position: number; name: string; status: string; started_at: string | null; completed_at: string | null; duration_days: number | null }[];
  comments: { id: string; author_name: string; kind: string; body: string; created_at: string }[];
  events: { id: string; actor_name: string | null; action: string; created_at: string }[];
  deliverables: { id: string; name: string; filename: string; blob_url: string; created_at: string }[];
  siblings: { id: string; name: string; status: string; closed_at: string | null; key_date: string | null; key_date_label: string | null }[];
};
type Account = {
  client: { id: string; name: string; company_legal_name: string | null; email: string | null; whatsapp: string | null; responsible_name: string | null; responsible_phone: string | null; country: string | null; industry: string | null; purchased_services: unknown; paid_at: string | null };
  filings: CaseRow[];
  gaps: { key: string; label: string }[];
};

const WAITING: Record<string, string> = { client: "Cliente", authority: "Autoridad", us: "Nosotros" };
const KIND: Record<string, string> = { comment: "Nota interna", call: "Llamada", whatsapp: "WhatsApp", email: "Email", meeting: "Reunión", system: "Sistema" };
const LIGHT = { green: "bg-emerald-500", yellow: "bg-amber-400", red: "bg-red-500" } as const;

const digits = (s: string | null | undefined) => (s || "").replace(/\D/g, "");
const fmtDT = (iso: string | null) => (iso ? new Date(iso).toLocaleString("es-US", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const fmtMiami = (iso: string | null) => (iso ? new Date(iso).toLocaleString("es-US", { timeZone: "America/New_York", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) + " Miami" : "");
const fmtD = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-US", { timeZone: "America/New_York", day: "2-digit", month: "2-digit", year: "2-digit" }) : "—");

function ContactButtons({ c, compact }: { c: CaseRow; compact?: boolean }) {
  const wa = digits(c.whatsapp) || digits(c.phone);
  const tel = digits(c.phone) || digits(c.whatsapp);
  const msg = encodeURIComponent(`Hola ${c.contactName || ""}, le escribo de FastForward sobre su trámite "${c.filingName}".`);
  const cls = `inline-flex items-center justify-center rounded-md border ${compact ? "h-7 w-7" : "h-9 px-3 gap-2 text-sm"}`;
  const off = "opacity-30 cursor-not-allowed";
  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <a className={`${cls} border-emerald-600 text-emerald-700 hover:bg-emerald-50 ${wa ? "" : off}`} title={wa ? "WhatsApp" : "Sin teléfono cargado"} href={wa ? `https://wa.me/${wa}?text=${msg}` : undefined} target="_blank" rel="noreferrer" onClick={(e) => !wa && e.preventDefault()}>
        <MessageCircle className="h-4 w-4" />{!compact && "WhatsApp"}
      </a>
      <a className={`${cls} border-gray-700 text-gray-800 hover:bg-gray-100 ${tel ? "" : off}`} title={tel ? "Llamar" : "Sin teléfono cargado"} href={tel ? `tel:+${tel}` : undefined} onClick={(e) => !tel && e.preventDefault()}>
        <Phone className="h-4 w-4" />{!compact && "Llamar"}
      </a>
      <a className={`${cls} border-gray-700 text-gray-800 hover:bg-gray-100 ${c.email ? "" : off}`} title={c.email || "Sin email"} href={c.email ? `mailto:${c.email}` : undefined} onClick={(e) => !c.email && e.preventDefault()}>
        <Mail className="h-4 w-4" />{!compact && "Email"}
      </a>
    </div>
  );
}

export default function StatusClient({ isAdmin }: { isAdmin: boolean }) {
  const [scope, setScope] = useState<Scope>("open");
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [fAgent, setFAgent] = useState("");
  const [fWait, setFWait] = useState("");
  const [fLight, setFLight] = useState("");
  const [fService, setFService] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/status?scope=${scope}`, { cache: "no-store" });
    if (r.ok) setRows((await r.json()).cases);
    setLoading(false);
  }, [scope]);
  useEffect(() => { load(); }, [load]);

  const openDetail = useCallback(async (id: string) => {
    setSel(id); setDetail(null);
    const r = await fetch(`/api/status/${id}`, { cache: "no-store" });
    if (r.ok) setDetail(await r.json());
  }, []);

  const agents = useMemo(() => Array.from(new Set(rows.map((r) => r.agentName).filter(Boolean) as string[])).sort(), [rows]);
  const services = useMemo(() => Array.from(new Set(rows.map((r) => r.serviceType).filter(Boolean) as string[])).sort(), [rows]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) =>
      (!t || [r.company, r.legalName, r.contactName, r.email, r.filingName, r.country, r.nextStep, r.lastComment].some((v) => (v || "").toLowerCase().includes(t))) &&
      (!fAgent || r.agentName === fAgent) &&
      (!fWait || (fWait === "none" ? !r.waitingOn : r.waitingOn === fWait)) &&
      (!fLight || r.light === fLight) &&
      (!fService || r.serviceType === fService)
    );
  }, [rows, q, fAgent, fWait, fLight, fService]);

  const byAgent = useMemo(() => {
    if (scope !== "open") return [];
    const m = new Map<string, { total: number; red: number; late: number }>();
    rows.forEach((r) => { const k = r.agentName || "Sin asignar"; const v = m.get(k) || { total: 0, red: 0, late: 0 }; v.total++; if (r.light === "red") v.red++; if (r.sla === "late") v.late++; m.set(k, v); });
    return Array.from(m.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [rows, scope]);

  async function refreshAll(id: string) { await Promise.all([load(), openDetail(id)]); }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Status de casos</h1>
          <p className="text-xs text-gray-500">Todos los trámites de clientes con su etapa, de quién depende y el último contacto. Visible para todo el equipo.</p>
        </div>
        <div className="flex gap-1 rounded-md border p-0.5">
          {(["open", "closed"] as Scope[]).map((s) => (
            <button key={s} onClick={() => setScope(s)} className={`px-3 py-1.5 text-sm rounded ${scope === s ? "bg-black text-white" : "text-gray-700 hover:bg-gray-100"}`}>{s === "open" ? "Abiertos" : "Cerrados"}</button>
          ))}
        </div>
      </div>

      {scope === "open" && byAgent.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {byAgent.map(([name, v]) => (
            <button key={name} onClick={() => setFAgent(fAgent === name ? "" : name)} className={`rounded-md border px-3 py-2 text-left text-xs ${fAgent === name ? "border-black bg-gray-50" : "hover:bg-gray-50"}`}>
              <div className="font-medium text-gray-900">{name}</div>
              <div className="text-gray-500">{v.total} activos · <span className={v.red ? "text-red-600" : ""}>{v.red} sin movimiento</span> · <span className={v.late ? "text-amber-600" : ""}>{v.late} fuera de SLA</span></div>
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-2 md:grid-cols-5">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar empresa, contacto, email, trámite…" className="md:col-span-2 rounded-md border px-3 py-2 text-sm" />
        <select value={fAgent} onChange={(e) => setFAgent(e.target.value)} className="rounded-md border px-2 py-2 text-sm"><option value="">Agente: todos</option>{agents.map((a) => <option key={a}>{a}</option>)}</select>
        <select value={fWait} onChange={(e) => setFWait(e.target.value)} className="rounded-md border px-2 py-2 text-sm"><option value="">Esperando a: todos</option><option value="client">Cliente</option><option value="authority">Autoridad</option><option value="us">Nosotros</option><option value="none">Sin definir</option></select>
        <div className="flex gap-2">
          <select value={fLight} onChange={(e) => setFLight(e.target.value)} className="flex-1 rounded-md border px-2 py-2 text-sm"><option value="">Semáforo</option><option value="red">Rojo (+14 d)</option><option value="yellow">Amarillo (7–14 d)</option><option value="green">Verde</option></select>
          <select value={fService} onChange={(e) => setFService(e.target.value)} className="flex-1 rounded-md border px-2 py-2 text-sm"><option value="">Servicio</option>{services.map((s) => <option key={s}>{s}</option>)}</select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2 w-6"></th>
              <th className="px-3 py-2">Empresa / trámite</th>
              <th className="px-3 py-2">Agente</th>
              <th className="px-3 py-2">Etapa</th>
              <th className="px-3 py-2">Esperando a</th>
              <th className="px-3 py-2">{scope === "open" ? "Última actividad" : "Cerrado"}</th>
              <th className="px-3 py-2">Contacto</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">Cargando…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">Sin resultados</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id} onClick={() => openDetail(r.id)} className="cursor-pointer border-t hover:bg-gray-50">
                <td className="px-3 py-2"><span className={`inline-block h-2.5 w-2.5 rounded-full ${LIGHT[r.light]}`} title={`${r.daysInactive} días sin movimiento`} /></td>
                <td className="px-3 py-2">
                  <div className="font-medium text-gray-900">{r.company}{r.country ? <span className="ml-1 text-xs font-normal text-gray-400">· {r.country}</span> : null}</div>
                  <div className="text-xs text-gray-600">{r.filingName}</div>
                  {r.lastComment && <div className="mt-0.5 line-clamp-1 text-xs text-gray-400">{r.lastCommentBy}: {r.lastComment}</div>}
                </td>
                <td className="px-3 py-2 text-gray-700">{r.agentName || <span className="text-gray-400">Sin asignar</span>}</td>
                <td className="px-3 py-2">
                  {r.stageName ? <><div className="text-gray-900">{r.stagePos}/{r.stageTotal}</div><div className="line-clamp-1 text-xs text-gray-500">{r.stageName}</div></> : <span className="text-gray-400">—</span>}
                  {scope === "open" && r.sla === "late" && <span className="mt-0.5 inline-block rounded bg-amber-100 px-1.5 text-[10px] font-medium text-amber-800">Fuera de SLA</span>}
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs ${r.waitingOn === "client" ? "bg-blue-50 text-blue-700" : r.waitingOn === "authority" ? "bg-purple-50 text-purple-700" : r.waitingOn === "us" ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-500"}`}>{r.waitingOn ? WAITING[r.waitingOn] : "Sin definir"}</span>
                  {r.keyDate && <div className="mt-0.5 text-[11px] text-gray-500">{r.keyDateLabel || "Fecha clave"}: {r.keyDate.slice(8, 10)}/{r.keyDate.slice(5, 7)}/{r.keyDate.slice(2, 4)}</div>}
                </td>
                <td className="px-3 py-2 text-gray-700">
                  {scope === "open" ? <><div>{fmtD(r.lastActivityAt)}</div><div className="text-xs text-gray-500">hace {r.daysInactive} d</div></> : <><div>{fmtD(r.closedAt)}</div><div className="text-xs text-gray-500">{r.closedReason === "completed" ? "Completado" : r.closedReason === "cancelled" ? "Cancelado" : r.closedReason === "no_response" ? "Sin respuesta" : "—"}{r.surveyScore ? ` · ${["", "☹️", "😐", "😊"][r.surveyScore]}` : ""}</div></>}
                </td>
                <td className="px-3 py-2"><ContactButtons c={r} compact /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">{filtered.length} de {rows.length} casos</p>

      {sel && <DetailPanel id={sel} detail={detail} isAdmin={isAdmin} onClose={() => { setSel(null); setDetail(null); }} onChanged={() => refreshAll(sel)} onAccount={async (cid) => { const r = await fetch(`/api/status/account/${cid}`, { cache: "no-store" }); if (r.ok) setAccount(await r.json()); }} setMsg={setMsg} />}
      {account && <AccountPanel a={account} onClose={() => setAccount(null)} onOpen={(id) => { setAccount(null); openDetail(id); }} />}
      {msg && <div className="fixed bottom-4 right-4 rounded-md bg-black px-4 py-2 text-sm text-white shadow" onAnimationEnd={() => setMsg("")}>{msg}</div>}
    </div>
  );
}

function DetailPanel({ id, detail, isAdmin, onClose, onChanged, onAccount, setMsg }: { id: string; detail: Detail | null; isAdmin: boolean; onClose: () => void; onChanged: () => void; onAccount: (clientId: string) => void; setMsg: (s: string) => void }) {
  const c = detail?.case;
  const [waiting, setWaiting] = useState<string>("");
  const [nextStep, setNextStep] = useState("");
  const [keyDate, setKeyDate] = useState("");
  const [keyLabel, setKeyLabel] = useState("");
  const [kind, setKind] = useState("whatsapp");
  const [text, setText] = useState("");
  const [closeReason, setCloseReason] = useState("completed");
  const [closeNote, setCloseNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (c) { setWaiting(c.waitingOn || ""); setNextStep(c.nextStep || ""); setKeyDate(c.keyDate || ""); setKeyLabel(c.keyDateLabel || ""); } }, [c]);

  async function saveMeta() {
    setBusy(true);
    const r = await fetch(`/api/status/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ waitingOn: waiting || null, nextStep, keyDate: keyDate || null, keyDateLabel: keyLabel }) });
    setBusy(false); flash(r.ok ? "Guardado" : "Error al guardar"); if (r.ok) onChanged();
  }
  async function addComment() {
    if (!text.trim()) return;
    setBusy(true);
    const r = await fetch(`/api/status/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "comment", kind, body: text }) });
    setBusy(false); if (r.ok) { setText(""); flash("Registrado"); onChanged(); } else flash("Error");
  }
  async function closeCase() {
    if (!confirm("¿Cerrar este caso? Pasa al archivo de cerrados.")) return;
    setBusy(true);
    const r = await fetch(`/api/status/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "close", reason: closeReason, note: closeNote }) });
    setBusy(false); flash(r.ok ? "Caso cerrado" : "Error"); if (r.ok) onChanged();
  }
  async function reopen() {
    setBusy(true);
    const r = await fetch(`/api/status/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reopen" }) });
    setBusy(false); flash(r.ok ? "Caso reabierto" : "Error"); if (r.ok) onChanged();
  }
  function flash(s: string) { setMsg(s); setTimeout(() => setMsg(""), 2500); }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        {!c ? <div className="p-6 text-sm text-gray-500">Cargando…</div> : (
          <div className="space-y-5 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2"><span className={`inline-block h-2.5 w-2.5 rounded-full ${LIGHT[c.light]}`} /><h2 className="text-lg font-semibold text-gray-900">{c.company}</h2></div>
                <div className="text-sm text-gray-600">{c.filingName}</div>
                <div className="text-xs text-gray-500">{c.contactName || "—"} · {c.email || "—"} · {c.country || "—"} · Agente: {c.agentName || "sin asignar"}</div>
              </div>
              <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ContactButtons c={c} />
              <button onClick={() => onAccount(c.clientId)} className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-700 px-3 text-sm text-gray-800 hover:bg-gray-100"><Building2 className="h-4 w-4" />Perfil de cuenta</button>
            </div>

            <div className="rounded-md border border-gray-900 bg-gray-50 p-3">
              <div className="mb-1 flex items-center justify-between text-xs font-medium uppercase text-gray-500">Resumen para el teléfono
                <button onClick={() => { navigator.clipboard.writeText(c.summary); flash("Copiado"); }} className="inline-flex items-center gap-1 text-gray-600 hover:text-black"><Copy className="h-3.5 w-3.5" />Copiar</button></div>
              <p className="text-sm text-gray-900">{c.summary}</p>
              {c.sla === "late" && <p className="mt-1 text-xs text-amber-700">Etapa fuera de SLA: vencía el {fmtD(c.slaDueAt)}.</p>}
            </div>

            {!c.closedAt && (
              <div className="grid gap-2 rounded-md border p-3 md:grid-cols-2">
                <label className="text-xs text-gray-600">Esperando a
                  <select value={waiting} onChange={(e) => setWaiting(e.target.value)} className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"><option value="">Sin definir</option><option value="client">Cliente</option><option value="authority">Autoridad (FDA/TTB/USPTO…)</option><option value="us">Nosotros</option></select></label>
                <label className="text-xs text-gray-600">Próximo paso
                  <input value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="Ej.: cliente envía certificado" className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm" /></label>
                <label className="text-xs text-gray-600">Fecha clave
                  <input type="date" value={keyDate} onChange={(e) => setKeyDate(e.target.value)} className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm" /></label>
                <label className="text-xs text-gray-600">Qué vence
                  <input value={keyLabel} onChange={(e) => setKeyLabel(e.target.value)} placeholder="Ej.: Renovación FDA, Office Action" className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm" /></label>
                <div className="md:col-span-2 text-right"><button disabled={busy} onClick={saveMeta} className="rounded-md bg-black px-4 py-1.5 text-sm text-white disabled:opacity-50">Guardar</button></div>
              </div>
            )}

            <div>
              <div className="mb-2 text-xs font-medium uppercase text-gray-500">Etapas</div>
              <ol className="space-y-1">
                {detail!.stages.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 text-sm">
                    <span className={`h-2 w-2 rounded-full ${s.status === "completed" ? "bg-emerald-500" : s.status === "active" ? "bg-black" : s.status === "skipped" ? "bg-gray-300" : "bg-gray-200"}`} />
                    <span className={s.status === "active" ? "font-medium text-gray-900" : "text-gray-700"}>{s.position}. {s.name}</span>
                    <span className="ml-auto text-xs text-gray-400">{s.status === "completed" ? `✓ ${fmtD(s.completed_at)}` : s.status === "active" ? `desde ${fmtD(s.started_at)}${s.duration_days ? ` · SLA ${s.duration_days} d` : ""}` : s.status === "skipped" ? "omitida" : "pendiente"}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-md border p-3">
              <div className="mb-2 text-xs font-medium uppercase text-gray-500">Registrar contacto / nota</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(KIND).filter(([k]) => k !== "system").map(([k, v]) => (
                  <button key={k} onClick={() => setKind(k)} className={`rounded-full border px-3 py-1 text-xs ${kind === k ? "border-black bg-black text-white" : "text-gray-700 hover:bg-gray-100"}`}>{v}</button>
                ))}
              </div>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={kind === "call" ? "Quién llamó, qué preguntó, qué se respondió…" : "Qué se habló, qué quedó pendiente…"} className="mt-2 w-full rounded-md border px-3 py-2 text-sm" />
              <div className="mt-2 text-right"><button disabled={busy || !text.trim()} onClick={addComment} className="rounded-md bg-black px-4 py-1.5 text-sm text-white disabled:opacity-50">Registrar</button></div>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium uppercase text-gray-500">Historial ({detail!.comments.length})</div>
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

            {detail!.deliverables.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-medium uppercase text-gray-500">Entregables</div>
                <ul className="space-y-1 text-sm">{detail!.deliverables.map((d) => <li key={d.id}><a className="text-gray-900 underline" href={d.blob_url} target="_blank" rel="noreferrer">{d.name || d.filename}</a> <span className="text-xs text-gray-400">{fmtD(d.created_at)}</span></li>)}</ul>
              </div>
            )}

            {detail!.siblings.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-medium uppercase text-gray-500">Otros trámites de esta empresa</div>
                <ul className="space-y-1 text-sm">{detail!.siblings.map((s) => <li key={s.id} className="text-gray-700">{s.name} <span className="text-xs text-gray-400">· {s.closed_at ? `cerrado ${fmtD(s.closed_at)}` : s.status}</span></li>)}</ul>
              </div>
            )}

            <div className="rounded-md border p-3">
              {!c.closedAt ? (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-xs text-gray-600">Cerrar caso como
                    <select value={closeReason} onChange={(e) => setCloseReason(e.target.value)} className="mt-1 block rounded-md border px-2 py-1.5 text-sm"><option value="completed">Completado</option><option value="cancelled">Cancelado</option><option value="no_response">Sin respuesta del cliente</option></select></label>
                  <input value={closeNote} onChange={(e) => setCloseNote(e.target.value)} placeholder="Nota de cierre (opcional)" className="flex-1 rounded-md border px-2 py-1.5 text-sm" />
                  <button disabled={busy} onClick={closeCase} className="inline-flex items-center gap-1 rounded-md border border-gray-900 px-3 py-1.5 text-sm text-gray-900 hover:bg-gray-100"><CheckCircle2 className="h-4 w-4" />Cerrar</button>
                </div>
              ) : (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">Cerrado el {fmtD(c.closedAt)} por {c.closedBy || "—"} ({c.closedReason === "completed" ? "completado" : c.closedReason === "cancelled" ? "cancelado" : "sin respuesta"})</span>
                  {isAdmin && <button disabled={busy} onClick={reopen} className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-gray-100"><RotateCcw className="h-4 w-4" />Reabrir</button>}
                </div>
              )}
            </div>

            {detail!.events.length > 0 && (
              <details className="text-xs text-gray-500"><summary className="cursor-pointer">Auditoría ({detail!.events.length})</summary>
                <ul className="mt-1 space-y-0.5">{detail!.events.map((e) => <li key={e.id}>{fmtDT(e.created_at)} · {e.actor_name || "sistema"} · {e.action}</li>)}</ul></details>
            )}
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
            <h2 className="text-lg font-semibold text-gray-900">{a.client.name}</h2>
            <div className="text-xs text-gray-500">{a.client.company_legal_name || ""} · {a.client.country || "—"} · {a.client.industry || "—"}</div>
            <div className="text-xs text-gray-500">{a.client.responsible_name || "—"} · {a.client.email || "—"} · {a.client.whatsapp || a.client.responsible_phone || "—"}</div>
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
              {ps.length ? <ul className="text-sm text-gray-700">{ps.map((s, i) => <li key={i}>{String(s.name || s.item_name || s.description || JSON.stringify(s))}{s.rate || s.item_total ? <span className="text-xs text-gray-400"> · USD {String(s.item_total ?? s.rate)}</span> : null}</li>)}</ul> : <div className="text-sm text-gray-400">Sin detalle de compra</div>}
              {a.client.paid_at && <div className="text-xs text-gray-400">Cliente desde {fmtD(a.client.paid_at)}</div>}
            </div>
            <div>
              <div className="mb-1 text-xs font-medium uppercase text-gray-500">Oportunidades (no contratado)</div>
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
