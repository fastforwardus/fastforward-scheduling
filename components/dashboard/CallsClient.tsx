"use client";

import { useEffect, useState, useMemo } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { RecoveryTabs } from "@/components/dashboard/RecoveryTabs";
import { RefreshCw, Search, Clock, Check, CalendarClock } from "lucide-react";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

const MIAMI = "America/New_York";

interface Call {
  id: string;
  sourceType: string | null;
  sourceId: string | null;
  userName: string | null;
  toPhone: string | null;
  status: string | null;
  durationSec: number;
  outcome: string | null;
  outcomeNote: string | null;
  followUpAt: string | null;
  followUpDone: boolean;
  createdAt: string;
  clientName: string | null;
  clientCompany: string | null;
  proposalNum: string | null;
  total: number | null;
}

const OUTCOMES: [string, string, string][] = [
  ["recuperado", "Recuperado", "#16A34A"],
  ["interesado", "Interesado", "#3B82F6"],
  ["pidio_tiempo", "Pidio tiempo", "#C9A84C"],
  ["no_interesa", "No le interesa", "#6B7280"],
  ["no_contesta", "No contesta", "#9CA3AF"],
  ["numero_equivocado", "Numero equivocado", "#EF4444"],
];

const ESTADO: Record<string, string> = {
  completed: "Atendida", "no-answer": "Sin respuesta", busy: "Ocupado",
  failed: "Fallo", canceled: "Cancelada", initiated: "Iniciada",
};

export default function CallsClient({ user }: {
  user: { id: string; fullName: string; email: string; role: string; canRecovery?: boolean };
}) {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  // Arranca en los que faltan resolver: es la bandeja de trabajo
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [fecha, setFecha] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      const r = await fetch("/api/recovery/calls");
      const d = await r.json();
      setCalls(d.items || []);
    } catch { /* noop */ }
    setLoading(false);
  }

  useEffect(() => { cargar(); }, []);

  const filtradas = useMemo(() => {
    const t = q.toLowerCase().trim();
    return calls.filter(c => {
      // Sigue pendiente si falta el outcome o si tiene un recordatorio sin cumplir:
      // aunque ya haya resultado cargado, la gestion no termino.
      if (soloPendientes) {
        const pendiente = !c.outcome || (!!c.followUpAt && !c.followUpDone);
        if (!pendiente) return false;
      }
      if (!t) return true;
      return [c.clientName, c.clientCompany, c.toPhone, c.userName, c.proposalNum]
        .some(v => (v || "").toLowerCase().includes(t));
    });
  }, [calls, q, soloPendientes]);

  async function guardar(c: Call, patch: Record<string, unknown>) {
    setGuardando(true);
    const res = await fetch("/api/recovery/calls", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callId: c.id, ...patch }),
    });
    setGuardando(false);
    if (res.ok) { setAbierta(null); setDraft(""); setFecha(""); cargar(); }
    else alert("No se pudo guardar");
  }

  const dur = (s: number) => s > 0 ? `${Math.floor(s / 60)}m ${s % 60}s` : "—";
  const fmt = (iso: string) => new Date(iso).toLocaleString("es-ES", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "America/New_York",
  });

  return (
    <div className="flex min-h-screen" style={{ background: "#F8F9FB" }}>
      <Sidebar user={user} />
      <main className="flex-1 lg:ml-0 pt-14 lg:pt-0">
        <div className="max-w-6xl mx-auto px-6 py-8">

          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#9CA3AF" }}>Recupero</p>
              <h1 className="text-2xl font-bold" style={{ color: "#27295C" }}>Llamados</h1>
            </div>
            <button onClick={cargar} className="p-2 rounded-lg border" style={{ borderColor: "#E5E7EB", background: "white" }} aria-label="Refrescar">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} style={{ color: "#6B7280" }} />
            </button>
          </div>

          <RecoveryTabs />

          <div className="flex gap-3 mb-5 flex-wrap items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }} />
              <input value={q} onChange={e => setQ(e.target.value)}
                placeholder="Buscar cliente, telefono, agente..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: "#E5E7EB", background: "white" }} />
            </div>
            <button onClick={() => setSoloPendientes(!soloPendientes)}
              className="px-3 py-2 rounded-lg text-xs font-semibold"
              style={{
                background: soloPendientes ? "#27295C" : "white",
                color: soloPendientes ? "white" : "#6B7280",
                border: `1px solid ${soloPendientes ? "#27295C" : "#E5E7EB"}`,
              }}>
              Pendientes
            </button>
            <span className="text-xs" style={{ color: "#9CA3AF" }}>{filtradas.length} de {calls.length}</span>
          </div>

          <div className="rounded-2xl border" style={{ borderColor: "#E5E7EB", background: "white" }}>
            {loading && calls.length === 0 ? (
              <p className="text-sm text-center py-12" style={{ color: "#9CA3AF" }}>Cargando...</p>
            ) : filtradas.length === 0 ? (
              <p className="text-sm text-center py-12" style={{ color: "#9CA3AF" }}>
                Todavia no hay llamadas registradas
              </p>
            ) : filtradas.map(c => {
              const abierto = abierta === c.id;
              const oc = OUTCOMES.find(o => o[0] === c.outcome);
              return (
                <div key={c.id} className="border-b last:border-b-0" style={{ borderColor: "#F0F0F0" }}>
                  <div className="px-5 py-4">
                    <div className="flex items-start gap-4 flex-wrap">
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold" style={{ color: "#27295C" }}>{c.clientName || "Sin nombre"}</p>
                          {c.proposalNum && (
                            <span className="text-xs" style={{ color: "#C9A84C" }}>
                              {c.proposalNum}{c.total != null ? ` · USD ${c.total.toLocaleString("en-US")}` : ""}
                            </span>
                          )}
                          {oc && (
                            <span className="text-xs px-2 py-0.5 rounded-md font-semibold"
                              style={{ background: oc[2] + "1A", color: oc[2] }}>{oc[1]}</span>
                          )}
                          {c.followUpAt && !c.followUpDone && (
                            <span className="text-xs px-2 py-0.5 rounded-md flex items-center gap-1"
                              style={{ background: "rgba(201,168,76,0.14)", color: "#92400E" }}>
                              <CalendarClock className="w-3 h-3" /> Volver a llamar: {fmt(c.followUpAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
                          {c.clientCompany || "Sin empresa"} · {c.toPhone}
                        </p>
                      </div>

                      <div className="min-w-[130px]">
                        <p className="text-xs" style={{ color: "#9CA3AF" }}>Llamo</p>
                        <p className="text-xs font-medium" style={{ color: "#374151" }}>{c.userName || "—"}</p>
                      </div>

                      <div className="min-w-[110px]">
                        <p className="text-xs" style={{ color: "#9CA3AF" }}>Duracion</p>
                        <p className="text-xs font-medium flex items-center gap-1" style={{ color: "#374151" }}>
                          <Clock className="w-3 h-3" /> {dur(c.durationSec)}
                          <span style={{ color: "#9CA3AF" }}>· {ESTADO[c.status || ""] || c.status}</span>
                        </p>
                      </div>

                      <div className="min-w-[110px]">
                        <p className="text-xs" style={{ color: "#9CA3AF" }}>Fecha</p>
                        <p className="text-xs font-medium" style={{ color: "#374151" }}>{fmt(c.createdAt)}</p>
                      </div>

                      <button onClick={() => {
                          setAbierta(abierto ? null : c.id);
                          setDraft(c.outcomeNote || "");
                          setFecha(c.followUpAt ? formatInTimeZone(new Date(c.followUpAt), MIAMI, "yyyy-MM-dd'T'HH:mm") : "");
                        }}
                        className="px-3 py-2 rounded-lg text-xs font-semibold self-start"
                        style={{ background: "white", border: "1px solid #E5E7EB", color: "#374151" }}>
                        {c.outcome ? "Editar" : "Cargar resultado"}
                      </button>
                    </div>

                    {c.outcomeNote && !abierto && (
                      <p className="text-xs mt-2 px-3 py-2 rounded-lg" style={{ background: "#F8F9FB", color: "#6B7280" }}>
                        {c.outcomeNote}
                      </p>
                    )}

                    {abierto && (
                      <div className="mt-3 p-3 rounded-xl" style={{ background: "#F8F9FB", border: "1px solid #E5E7EB" }}>
                        <p className="text-xs mb-2" style={{ color: "#9CA3AF" }}>Resultado</p>
                        <div className="flex gap-1.5 flex-wrap mb-3">
                          {OUTCOMES.map(([k, label, color]) => (
                            <button key={k} disabled={guardando}
                              onClick={() => guardar(c, { outcome: k, outcomeNote: draft, followUpAt: fecha ? fromZonedTime(fecha, MIAMI).toISOString() : null })}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                              style={{
                                background: c.outcome === k ? color : "white",
                                color: c.outcome === k ? "white" : color,
                                border: `1px solid ${color}55`,
                              }}>
                              {label}
                            </button>
                          ))}
                        </div>

                        <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2}
                          placeholder="Que dijo, objecion, proximo paso..."
                          className="w-full px-3 py-2 rounded-lg border text-xs mb-2"
                          style={{ borderColor: "#E5E7EB" }} />

                        <div className="flex items-center gap-2 flex-wrap">
                          <label className="text-xs" style={{ color: "#9CA3AF" }}>Volver a llamar <span style={{ color: "#C9A84C" }}>(hora Miami)</span></label>
                          <input type="datetime-local" value={fecha} onChange={e => setFecha(e.target.value)}
                            className="px-2 py-1.5 rounded-lg border text-xs"
                            style={{ borderColor: "#E5E7EB", color: "#27295C" }} />
                          <button onClick={() => guardar(c, { outcomeNote: draft, followUpAt: fecha ? fromZonedTime(fecha, MIAMI).toISOString() : null })}
                            disabled={guardando}
                            className="px-4 py-1.5 rounded-lg text-xs font-semibold ml-auto"
                            style={{ background: "#27295C", color: "white" }}>
                            {guardando ? "..." : "Guardar"}
                          </button>
                          {c.followUpAt && !c.followUpDone && (
                            <button onClick={() => guardar(c, { followUpDone: true })}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1"
                              style={{ background: "rgba(34,197,94,0.12)", color: "#16A34A" }}>
                              <Check className="w-3 h-3" /> Recordatorio hecho
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
