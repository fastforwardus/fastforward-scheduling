"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Phone, PhoneOff, Delete, Upload, Calendar, RefreshCw, ChevronRight, X, Mic, MicOff } from "lucide-react";
import { Sidebar } from "@/components/dashboard/Sidebar";

type User = { id: string; fullName: string; email: string; role: string; slug?: string; canRecovery?: boolean; modules?: string[] | null; timezone?: string };
type List = { id: string; name: string; script: string | null; active: boolean; created_by: string | null; total: number; pending: number; callback: number; done: number; invalid: number; scheduled: number };
type Q = { id: string; name: string | null; company: string | null; phone: string; phone_e164: string; email: string | null; country: string | null; industry: string | null; status: string; attempts: number; callback_at: string | null; last_outcome: string | null };
type Ctx = { isClient: boolean; client?: { name: string; company: string | null; services: string[]; filings: number; agent: string | null }; proposal?: { num: string; status: string; total: string; createdAt: string }; appointment?: { at: string; status: string; outcome: string | null; rep: string | null }; webLead?: { at: string; servicio: string | null; mensaje: string | null }; pitch?: { apertura: string; oferta: string; preguntas: string[]; cierre: string } };
type Contact = Q & { notes: string | null; context: Ctx | null };
type Slot = { utc: string; label: string; date: string };

const BLUE = "#0183FF";
const fmtTz = (iso: string, tz: string) => new Date(iso).toLocaleString("es-US", { timeZone: tz, weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const digits = (s: string) => s.replace(/\D/g, "");

export default function LlamadasClient({ user }: { user: User }) {
  const tz = user.timezone || "America/New_York";
  const isManager = user.role === "admin" || user.role === "sales_manager";
  const [lists, setLists] = useState<List[]>([]);
  const [listId, setListId] = useState<string>("");
  const [queue, setQueue] = useState<Q[]>([]);
  const [later, setLater] = useState<Q[]>([]);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [loadingContact, setLoadingContact] = useState(false);
  const [script, setScript] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [showPad, setShowPad] = useState(true);
  const [newList, setNewList] = useState(false);
  const [editScript, setEditScript] = useState(false);
  const [note, setNote] = useState("");
  const [cbAt, setCbAt] = useState("");
  const [showCb, setShowCb] = useState(false);
  const [schedule, setSchedule] = useState(false);
  const [msg, setMsg] = useState("");
  const flash = (s: string) => { setMsg(s); setTimeout(() => setMsg(""), 3500); };

  // ── Twilio Device ──
  const [voiceReady, setVoiceReady] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [calling, setCalling] = useState(false);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const deviceRef = useRef<{ connect: (o: unknown) => Promise<{ on: (e: string, cb: () => void) => void; disconnect: () => void; mute: (m: boolean) => void }> } | null>(null);
  const connRef = useRef<{ disconnect: () => void; mute: (m: boolean) => void } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await fetch("/api/voice/token");
        if (!r.ok) { setVoiceError(r.status === 503 ? "Las llamadas están desactivadas (VOICE_CALLS_ENABLED)." : "Sin permiso para llamar."); return; }
        const d = await r.json();
        if (!d.token || cancel) return;
        const { Device } = await import("@twilio/voice-sdk");
        if (cancel) return;
        deviceRef.current = new Device(d.token, { logLevel: 1 }) as unknown as typeof deviceRef.current;
        setVoiceReady(true);
      } catch { setVoiceError("No se pudo iniciar el teléfono en este navegador."); }
    })();
    return () => { cancel = true; };
  }, []);

  const loadLists = useCallback(async () => { const r = await fetch("/api/llamadas/lists", { cache: "no-store" }); if (r.ok) { const j = await r.json(); setLists(j.lists); if (!listId && j.lists.length) setListId(j.lists.find((l: List) => l.active)?.id || j.lists[0].id); } }, [listId]);
  const loadQueue = useCallback(async () => { if (!listId) return; const r = await fetch(`/api/llamadas/contacts?list=${listId}`, { cache: "no-store" }); if (r.ok) { const j = await r.json(); setQueue(j.queue); setLater(j.later); setStats(j.stats); setScript(j.list?.script ?? null); } }, [listId]);
  useEffect(() => { loadLists(); }, [loadLists]);
  useEffect(() => { loadQueue(); setContact(null); }, [loadQueue]);

  async function openContact(id: string, refresh = false) {
    setLoadingContact(true); setNote(""); setShowCb(false);
    const r = await fetch(`/api/llamadas/contacts?id=${id}${refresh ? "&refresh=1" : ""}`, { cache: "no-store" });
    if (r.ok) setContact((await r.json()).contact);
    setLoadingContact(false);
  }
  function next() { const n = queue.find((q) => q.id !== contact?.id); if (n) openContact(n.id); else setContact(null); }

  async function call(to: string, sourceType: string, sourceId: string) {
    if (!deviceRef.current) return;
    if (calling) { connRef.current?.disconnect(); return; }
    try {
      setCalling(true); setSeconds(0); setMuted(false);
      if (sourceType === "call_contact") fetch("/api/llamadas/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: sourceId, action: "started" }) });
      const conn = await deviceRef.current.connect({ params: { To: "+" + digits(to), sourceType, sourceId, userId: user.id, userName: user.fullName } });
      connRef.current = conn;
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      const end = () => { setCalling(false); connRef.current = null; if (timerRef.current) clearInterval(timerRef.current); };
      conn.on("disconnect", end); conn.on("error", end);
    } catch { setCalling(false); flash("No se pudo iniciar la llamada"); }
  }
  function toggleMute() { const m = !muted; setMuted(m); connRef.current?.mute(m); }

  async function outcome(o: string, extra: Record<string, unknown> = {}) {
    if (!contact) return;
    const r = await fetch("/api/llamadas/contacts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: contact.id, outcome: o, note, ...extra }) });
    const j = await r.json();
    if (!r.ok) return flash(j.error || "Error");
    flash(j.label); await loadQueue(); await loadLists(); next();
  }

  const current = useMemo(() => lists.find((l) => l.id === listId), [lists, listId]);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0"), ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="flex min-h-screen" style={{ background: "#F8F9FB" }}>
      <Sidebar user={user} />
      <main className="flex-1 min-w-0 pt-14 lg:pt-0 overflow-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#9CA3AF" }}>Prospección telefónica</p>
              <h1 className="text-2xl font-bold" style={{ color: "#000000" }}>Llamadas</h1>
            </div>
            <div className="flex items-center gap-2">
              <select value={listId} onChange={(e) => setListId(e.target.value)} className="text-sm px-3 py-2 rounded-lg border bg-white" style={{ borderColor: "#E5E7EB" }}>
                {lists.length === 0 && <option value="">Sin listas</option>}
                {lists.map((l) => <option key={l.id} value={l.id}>{l.name}{l.active ? "" : " (cerrada)"} · {l.pending + l.callback} por llamar</option>)}
              </select>
              <button onClick={() => setShowPad((v) => !v)} className="text-sm px-3 py-2 rounded-lg border bg-white" style={{ borderColor: "#E5E7EB" }}>Teclado</button>
              {isManager && <button onClick={() => setNewList(true)} className="text-sm px-3 py-2 rounded-lg text-white inline-flex items-center gap-2" style={{ background: BLUE }}><Upload className="w-4 h-4" />Subir lista</button>}
            </div>
          </div>

          {voiceError && <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ background: "#FEF2F2", borderColor: "#FECACA", color: "#991B1B" }}>{voiceError}</div>}
          {!voiceError && !voiceReady && <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ background: "#FEF9C3", borderColor: "#FDE68A", color: "#854D0E" }}>Conectando el teléfono… si tarda más de unos segundos, permite el micrófono en el navegador.</div>}

          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
              {[["Por llamar", stats.pending + stats.callback], ["Llamadas hoy", stats.called_today], ["Citas agendadas", stats.scheduled], ["Terminados", stats.done], ["Total lista", stats.total]].map(([k, v]) => (
                <div key={String(k)} className="bg-white rounded-2xl border px-4 py-3" style={{ borderColor: "#E5E7EB" }}><div className="text-2xl font-bold" style={{ color: "#000" }}>{v as number}</div><div className="text-xs" style={{ color: "#6B7280" }}>{k}</div></div>
              ))}
            </div>
          )}

          <div className="grid lg:grid-cols-[1fr_320px] gap-4">
            {/* ── Contacto actual ── */}
            <div className="space-y-4">
              {showPad && (
                <div className="bg-white rounded-2xl border p-5" style={{ borderColor: "#E5E7EB" }}>
                  <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "#9CA3AF" }}>Marcar un número</div>
                  <div className="flex items-center gap-2 mb-3">
                    <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="+54 9 11 1234 5678" className="flex-1 text-xl px-3 py-2 rounded-lg border font-mono" style={{ borderColor: "#E5E7EB" }} />
                    <button onClick={() => setManual((v) => v.slice(0, -1))} className="p-2 rounded-lg border" style={{ borderColor: "#E5E7EB" }}><Delete className="w-5 h-5" /></button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 max-w-xs">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((k) => <button key={k} onClick={() => setManual((v) => v + k)} className="py-3 rounded-full text-lg font-medium" style={{ background: "#F3F4F6", color: "#000" }}>{k}</button>)}
                  </div>
                  <button disabled={!voiceReady || digits(manual).length < 8} onClick={() => call(manual, "manual", "")} className="mt-3 inline-flex items-center gap-2 px-6 py-3 rounded-full text-white font-semibold disabled:opacity-40" style={{ background: calling ? "#DC2626" : "#22C55E" }}>{calling ? <><PhoneOff className="w-5 h-5" />Cortar · {mm}:{ss}</> : <><Phone className="w-5 h-5" />Llamar</>}</button>
                </div>
              )}

              <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
                {!contact && !loadingContact && (
                  <div className="px-6 py-14 text-center">
                    <p className="text-sm mb-3" style={{ color: "#6B7280" }}>{queue.length ? `${queue.length} contactos esperando en "${current?.name}".` : "No hay contactos pendientes en esta lista."}</p>
                    {queue.length > 0 && <button onClick={() => openContact(queue[0].id)} className="px-5 py-2.5 rounded-lg text-white text-sm font-semibold inline-flex items-center gap-2" style={{ background: BLUE }}>Empezar a llamar <ChevronRight className="w-4 h-4" /></button>}
                  </div>
                )}
                {loadingContact && <div className="px-6 py-14 text-center text-sm" style={{ color: "#9CA3AF" }}>Preparando el contacto…</div>}
                {contact && !loadingContact && (
                  <div>
                    <div className="px-6 py-5 border-b flex items-start justify-between gap-4" style={{ borderColor: "#F0F0F0" }}>
                      <div className="min-w-0">
                        <div className="text-lg font-bold truncate" style={{ color: "#000" }}>{contact.company || contact.name || contact.phone}</div>
                        <div className="text-sm" style={{ color: "#6B7280" }}>{contact.name && contact.company ? `${contact.name} · ` : ""}{contact.country || ""}{contact.industry ? ` · ${contact.industry}` : ""}</div>
                        <div className="text-sm font-mono mt-1" style={{ color: "#374151" }}>+{contact.phone_e164}{contact.email ? ` · ${contact.email}` : ""}</div>
                        <div className="flex gap-1.5 flex-wrap mt-2">
                          {contact.context?.isClient && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "#DCFCE7", color: "#166534" }}>Ya es cliente</span>}
                          {contact.context?.proposal && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "#FEF9C3", color: "#854D0E" }}>Propuesta {contact.context.proposal.num} · {contact.context.proposal.status}</span>}
                          {contact.context?.appointment && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "#DBEAFE", color: "#1E40AF" }}>Cita {contact.context.appointment.at.slice(0, 10)} · {contact.context.appointment.status}</span>}
                          {contact.context?.webLead && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "#F3F4F6", color: "#374151" }}>Consultó por la web</span>}
                          {contact.attempts > 0 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#F3F4F6", color: "#6B7280" }}>{contact.attempts} intento{contact.attempts > 1 ? "s" : ""}</span>}
                        </div>
                      </div>
                      <button disabled={!voiceReady} onClick={() => call(contact.phone_e164, "call_contact", contact.id)} className="shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-full text-white font-semibold disabled:opacity-40" style={{ background: calling ? "#DC2626" : "#22C55E" }}>
                        {calling ? <><PhoneOff className="w-5 h-5" />Cortar · {mm}:{ss}</> : <><Phone className="w-5 h-5" />Llamar</>}
                      </button>
                    </div>
                    {calling && <div className="px-6 py-2 flex items-center gap-3 text-sm" style={{ background: "#F0FDF4", color: "#166534" }}><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />En llamada<button onClick={toggleMute} className="ml-auto inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-white" style={{ borderColor: "#BBF7D0" }}>{muted ? <><MicOff className="w-3.5 h-3.5" />Activar micrófono</> : <><Mic className="w-3.5 h-3.5" />Silenciar</>}</button></div>}

                    <div className="px-6 py-5 grid md:grid-cols-2 gap-5">
                      <div>
                        <div className="flex items-center justify-between mb-2"><span className="text-xs uppercase tracking-widest" style={{ color: "#9CA3AF" }}>Qué decirle</span><button onClick={() => openContact(contact.id, true)} className="text-xs inline-flex items-center gap-1" style={{ color: "#6B7280" }}><RefreshCw className="w-3 h-3" />Regenerar</button></div>
                        {contact.context?.pitch ? (
                          <div className="space-y-3 text-sm" style={{ color: "#111827" }}>
                            <p><span className="font-semibold">Apertura: </span>{contact.context.pitch.apertura}</p>
                            <p><span className="font-semibold">Ofrecer: </span>{contact.context.pitch.oferta}</p>
                            <div><span className="font-semibold">Preguntar:</span><ul className="list-disc ml-5 mt-1">{contact.context.pitch.preguntas.map((p, i) => <li key={i}>{p}</li>)}</ul></div>
                            <p><span className="font-semibold">Cerrar: </span>{contact.context.pitch.cierre}</p>
                          </div>
                        ) : <p className="text-sm" style={{ color: "#9CA3AF" }}>Sin guion personalizado. {script ? "Usa el guion de la lista." : ""}</p>}
                        {contact.context?.client && <p className="text-xs mt-3" style={{ color: "#6B7280" }}>Cliente: {contact.context.client.company || contact.context.client.name} · {contact.context.client.services.join(", ") || "sin detalle de compra"} · agente {contact.context.client.agent || "—"}</p>}
                        {contact.notes && <p className="text-xs mt-2" style={{ color: "#6B7280" }}>Notas de la lista: {contact.notes}</p>}
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "#9CA3AF" }}>Resultado de la llamada</div>
                        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Qué dijo, qué le interesa, cuándo volver a llamar…" className="w-full text-sm px-3 py-2 rounded-lg border mb-2" style={{ borderColor: "#E5E7EB" }} />
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => setSchedule(true)} className="col-span-2 py-2.5 rounded-lg text-white text-sm font-semibold inline-flex items-center justify-center gap-2" style={{ background: BLUE }}><Calendar className="w-4 h-4" />Interesado · Agendar cita</button>
                          <button onClick={() => outcome("no_answer")} className="py-2 rounded-lg border text-sm" style={{ borderColor: "#E5E7EB" }}>No contesta</button>
                          <button onClick={() => setShowCb((v) => !v)} className="py-2 rounded-lg border text-sm" style={{ borderColor: "#E5E7EB" }}>Volver a llamar…</button>
                          <button onClick={() => outcome("not_interested")} className="py-2 rounded-lg border text-sm" style={{ borderColor: "#E5E7EB" }}>No interesado</button>
                          <button onClick={() => outcome("invalid")} className="py-2 rounded-lg border text-sm" style={{ borderColor: "#E5E7EB", color: "#991B1B" }}>Número inválido</button>
                          <button onClick={() => outcome("skip")} className="col-span-2 py-1.5 text-xs" style={{ color: "#9CA3AF" }}>Omitir por ahora</button>
                        </div>
                        {showCb && (
                          <div className="mt-2 flex items-center gap-2">
                            <input type="datetime-local" value={cbAt} onChange={(e) => setCbAt(e.target.value)} className="flex-1 text-sm px-2 py-1.5 rounded-lg border" style={{ borderColor: "#E5E7EB" }} />
                            <button disabled={!cbAt} onClick={() => outcome("callback", { callbackAt: new Date(cbAt).toISOString() })} className="text-sm px-3 py-1.5 rounded-lg text-white disabled:opacity-40" style={{ background: "#000" }}>Guardar</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {script && (
                <div className="bg-white rounded-2xl border p-5" style={{ borderColor: "#E5E7EB" }}>
                  <div className="flex items-center justify-between mb-2"><span className="text-xs uppercase tracking-widest" style={{ color: "#9CA3AF" }}>Guion de la lista</span>{isManager && <button onClick={() => setEditScript(true)} className="text-xs" style={{ color: "#6B7280" }}>Editar</button>}</div>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: "#374151" }}>{script}</p>
                </div>
              )}
              {!script && isManager && listId && <button onClick={() => setEditScript(true)} className="text-sm" style={{ color: BLUE }}>+ Agregar guion a esta lista</button>}
            </div>

            {/* ── Cola ── */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
                <div className="px-4 py-3 border-b text-sm font-semibold" style={{ borderColor: "#F0F0F0", color: "#000" }}>Siguientes <span className="text-xs font-normal" style={{ color: "#9CA3AF" }}>{queue.length}</span></div>
                {queue.length === 0 && <div className="px-4 py-6 text-center text-xs" style={{ color: "#9CA3AF" }}>Nada pendiente</div>}
                {queue.slice(0, 15).map((q) => (
                  <div key={q.id} onClick={() => openContact(q.id)} className="px-4 py-2.5 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 flex items-center gap-2" style={{ borderColor: "#F0F0F0", background: contact?.id === q.id ? "#F0F7FF" : undefined }}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: q.status === "callback" ? "#F59E0B" : "#D1D5DB" }} />
                    <div className="min-w-0 flex-1"><div className="text-sm font-medium truncate" style={{ color: "#111827" }}>{q.company || q.name || q.phone}</div><div className="text-xs truncate" style={{ color: "#9CA3AF" }}>{q.status === "callback" && q.callback_at ? `Volver a llamar · ${fmtTz(q.callback_at, tz)}` : q.country || q.name || ""}</div></div>
                  </div>
                ))}
              </div>
              {later.length > 0 && (
                <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
                  <div className="px-4 py-3 border-b text-sm font-semibold" style={{ borderColor: "#F0F0F0", color: "#000" }}>Más tarde</div>
                  {later.map((q) => <div key={q.id} onClick={() => openContact(q.id)} className="px-4 py-2 border-b last:border-b-0 cursor-pointer hover:bg-gray-50" style={{ borderColor: "#F0F0F0" }}><div className="text-sm truncate" style={{ color: "#111827" }}>{q.company || q.name}</div><div className="text-xs" style={{ color: "#9CA3AF" }}>{q.callback_at ? fmtTz(q.callback_at, tz) : ""}</div></div>)}
                </div>
              )}
            </div>
          </div>
        </div>

        {newList && <NewListModal onClose={() => setNewList(false)} onDone={async (id) => { setNewList(false); await loadLists(); setListId(id); }} flash={flash} />}
        {editScript && <ScriptModal listId={listId} initial={script || ""} onClose={() => setEditScript(false)} onDone={async () => { setEditScript(false); await loadQueue(); }} />}
        {schedule && contact && <ScheduleModal contact={contact} tz={tz} onClose={() => setSchedule(false)} onDone={async (appointmentId) => { setSchedule(false); await outcome("scheduled", { appointmentId }); }} flash={flash} />}
        {msg && <div className="fixed bottom-4 right-4 z-50 rounded-xl bg-black px-4 py-2 text-sm text-white shadow-lg">{msg}</div>}
      </main>
    </div>
  );
}

function NewListModal({ onClose, onDone, flash }: { onClose: () => void; onDone: (id: string) => void; flash: (s: string) => void }) {
  const [name, setName] = useState(""); const [script, setScript] = useState(""); const [csv, setCsv] = useState(""); const [fileName, setFileName] = useState(""); const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    const r = await fetch("/api/llamadas/lists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, script, csv }) });
    const j = await r.json(); setBusy(false);
    if (!r.ok) return flash(j.error || "Error");
    flash(`Lista creada: ${j.inserted} contactos (${j.duplicates} duplicados, ${j.invalid} sin teléfono válido)`); onDone(j.listId);
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold" style={{ color: "#000" }}>Subir lista</h2><button onClick={onClose}><X className="w-5 h-5" /></button></div>
        <label className="block text-xs mb-3" style={{ color: "#6B7280" }}>Nombre<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Expositores Fancy Food 2026" className="mt-1 w-full text-sm px-3 py-2 rounded-lg border" style={{ borderColor: "#E5E7EB" }} /></label>
        <label className="block text-xs mb-3" style={{ color: "#6B7280" }}>Guion (qué ofrecer, cómo presentarse)<textarea value={script} onChange={(e) => setScript(e.target.value)} rows={4} className="mt-1 w-full text-sm px-3 py-2 rounded-lg border" style={{ borderColor: "#E5E7EB" }} /></label>
        <label className="block text-xs mb-1" style={{ color: "#6B7280" }}>Archivo CSV (columnas: nombre, empresa, teléfono, email, país, rubro, notas — en cualquier orden)</label>
        <input type="file" accept=".csv,text/csv,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; setFileName(f.name); const fr = new FileReader(); fr.onload = () => setCsv(String(fr.result || "")); fr.readAsText(f); }} className="text-sm mb-1" />
        {fileName && <p className="text-xs mb-3" style={{ color: "#9CA3AF" }}>{fileName} · {csv.split(/\r?\n/).filter(Boolean).length - 1} filas</p>}
        <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border" style={{ borderColor: "#E5E7EB" }}>Cancelar</button><button disabled={busy || !name.trim() || !csv} onClick={submit} className="text-sm px-4 py-2 rounded-lg text-white disabled:opacity-40" style={{ background: BLUE }}>{busy ? "Importando…" : "Crear lista"}</button></div>
      </div>
    </div>
  );
}

function ScriptModal({ listId, initial, onClose, onDone }: { listId: string; initial: string; onClose: () => void; onDone: () => void }) {
  const [script, setScript] = useState(initial); const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-3" style={{ color: "#000" }}>Guion de la lista</h2>
        <textarea value={script} onChange={(e) => setScript(e.target.value)} rows={10} className="w-full text-sm px-3 py-2 rounded-lg border" style={{ borderColor: "#E5E7EB" }} />
        <div className="flex justify-end gap-2 mt-3"><button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border" style={{ borderColor: "#E5E7EB" }}>Cancelar</button><button disabled={busy} onClick={async () => { setBusy(true); await fetch("/api/llamadas/lists", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: listId, script }) }); setBusy(false); onDone(); }} className="text-sm px-4 py-2 rounded-lg text-white" style={{ background: BLUE }}>Guardar</button></div>
      </div>
    </div>
  );
}

function ScheduleModal({ contact, tz, onClose, onDone, flash }: { contact: Contact; tz: string; onClose: () => void; onDone: (appointmentId: string) => void; flash: (s: string) => void }) {
  const [slots, setSlots] = useState<Slot[]>([]); const [loading, setLoading] = useState(true);
  const [name, setName] = useState(contact.name || ""); const [company, setCompany] = useState(contact.company || ""); const [email, setEmail] = useState(contact.email || "");
  const [platform, setPlatform] = useState<"zoom" | "whatsapp">("zoom"); const [sel, setSel] = useState<Slot | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { (async () => { const r = await fetch(`/api/slots?timezone=${encodeURIComponent(tz)}`); if (r.ok) { const j = await r.json(); setSlots(j.slots || []); } setLoading(false); })(); }, [tz]);
  const byDay = useMemo(() => { const m = new Map<string, Slot[]>(); slots.forEach((s) => { const k = s.date; if (!m.has(k)) m.set(k, []); m.get(k)!.push(s); }); return [...m.entries()].slice(0, 7); }, [slots]);
  async function book() {
    if (!sel) return;
    setBusy(true);
    const r = await fetch("/api/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientName: name, clientEmail: email, clientCompany: company, clientWhatsapp: "+" + contact.phone_e164, clientTimezone: tz, clientLanguage: "es", serviceInterest: contact.industry || "otro", platform, scheduledAt: sel.utc, utmSource: "llamadas", clientNotes: `Agendado por prospección telefónica (${contact.country || ""})` }) });
    const j = await r.json(); setBusy(false);
    if (!r.ok) return flash(j.error || "No se pudo agendar");
    onDone(String(j.appointmentId || j.id || j.appointment?.id || ""));
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold" style={{ color: "#000" }}>Agendar reunión con un consultor</h2><button onClick={onClose}><X className="w-5 h-5" /></button></div>
        <div className="grid md:grid-cols-3 gap-2 mb-4">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del cliente" className="text-sm px-3 py-2 rounded-lg border" style={{ borderColor: "#E5E7EB" }} />
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Empresa" className="text-sm px-3 py-2 rounded-lg border" style={{ borderColor: "#E5E7EB" }} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (obligatorio)" className="text-sm px-3 py-2 rounded-lg border" style={{ borderColor: "#E5E7EB" }} />
        </div>
        <div className="flex gap-2 mb-4 text-sm">{(["zoom", "whatsapp"] as const).map((p) => <button key={p} onClick={() => setPlatform(p)} className="px-3 py-1.5 rounded-full border" style={platform === p ? { background: "#000", color: "#fff", borderColor: "#000" } : { borderColor: "#E5E7EB" }}>{p === "zoom" ? "Zoom" : "WhatsApp"}</button>)}<span className="text-xs self-center" style={{ color: "#9CA3AF" }}>Horarios en tu zona ({tz}); el cliente recibe el suyo.</span></div>
        {loading ? <p className="text-sm" style={{ color: "#9CA3AF" }}>Buscando horarios…</p> : byDay.length === 0 ? <p className="text-sm" style={{ color: "#9CA3AF" }}>No hay horarios disponibles.</p> : (
          <div className="space-y-3">{byDay.map(([day, ss]) => (
            <div key={day}><div className="text-xs font-semibold mb-1" style={{ color: "#6B7280" }}>{new Date(ss[0].utc).toLocaleDateString("es-US", { timeZone: tz, weekday: "long", day: "2-digit", month: "long" })}</div>
              <div className="flex flex-wrap gap-1.5">{ss.map((s) => <button key={s.utc} onClick={() => setSel(s)} className="text-sm px-3 py-1.5 rounded-lg border" style={sel?.utc === s.utc ? { background: BLUE, color: "#fff", borderColor: BLUE } : { borderColor: "#E5E7EB" }}>{new Date(s.utc).toLocaleTimeString("es-US", { timeZone: tz, hour: "2-digit", minute: "2-digit" })}</button>)}</div></div>
          ))}</div>
        )}
        <div className="flex items-center justify-between mt-5">
          <span className="text-xs" style={{ color: "#6B7280" }}>{sel ? `Miami: ${new Date(sel.utc).toLocaleString("es-US", { timeZone: "America/New_York", weekday: "short", hour: "2-digit", minute: "2-digit" })}` : "Elige un horario"}</span>
          <button disabled={busy || !sel || !email.includes("@") || !name.trim() || !company.trim()} onClick={book} className="text-sm px-5 py-2 rounded-lg text-white disabled:opacity-40" style={{ background: BLUE }}>{busy ? "Agendando…" : "Confirmar cita"}</button>
        </div>
      </div>
    </div>
  );
}
