"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { RefreshCw, MessageCircle, Search, Check, Phone, PhoneOff } from "lucide-react";

interface Row {
  sourceType: "proposal" | "appointment";
  sourceId: string;
  clientName: string | null;
  clientCompany: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  repName: string | null;
  clientLanguage: string;
  serviceInterest: string | null;
  total: number | null;
  refDate: string;
  lastNote: string | null;
  lastNoteAt: string | null;
  noteCount: number;
}

export default function RecoveryClient({ user }: {
  user: { id: string; fullName: string; email: string; role: string };
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "proposal" | "appointment" | "sin_gestion">("todos");
  const [abierta, setAbierta] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Llamadas: el SDK se carga solo si el flag esta activo. Sin VOICE_CALLS_ENABLED
  // el token devuelve 503 y el boton no aparece.
  const [voiceReady, setVoiceReady] = useState(false);
  const [enLlamada, setEnLlamada] = useState<string | null>(null);
  const deviceRef = useRef<{ connect: (o: unknown) => Promise<{ on: (e: string, cb: () => void) => void; disconnect: () => void }> } | null>(null);
  const connRef = useRef<{ disconnect: () => void } | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const r = await fetch("/api/voice/token");
        if (!r.ok) return;
        const d = await r.json();
        if (!d.token || cancelado) return;
        const { Device } = await import("@twilio/voice-sdk");
        if (cancelado) return;
        deviceRef.current = new Device(d.token, { logLevel: 1 }) as unknown as typeof deviceRef.current;
        setVoiceReady(true);
      } catch { /* sin llamadas */ }
    })();
    return () => { cancelado = true; };
  }, []);

  async function llamar(r: Row) {
    if (!deviceRef.current || !r.clientPhone) return;
    const key = r.sourceType + ":" + r.sourceId;
    if (enLlamada) { connRef.current?.disconnect(); return; }
    try {
      setEnLlamada(key);
      const conn = await deviceRef.current.connect({
        params: {
          To: r.clientPhone.replace(/[^\d+]/g, ""),
          sourceType: r.sourceType,
          sourceId: r.sourceId,
          userId: user.id,
          userName: user.fullName,
        },
      });
      connRef.current = conn;
      conn.on("disconnect", () => { setEnLlamada(null); connRef.current = null; cargar(); });
      conn.on("error", () => { setEnLlamada(null); connRef.current = null; });
    } catch {
      setEnLlamada(null);
      alert("No se pudo iniciar la llamada");
    }
  }

  async function cargar() {
    setLoading(true);
    try {
      const r = await fetch("/api/recovery/list");
      const d = await r.json();
      setRows(d.items || []);
    } catch { /* noop */ }
    setLoading(false);
  }

  useEffect(() => { cargar(); }, []);

  const filtradas = useMemo(() => {
    const t = q.toLowerCase().trim();
    return rows.filter(r => {
      if (filtro === "proposal" && r.sourceType !== "proposal") return false;
      if (filtro === "appointment" && r.sourceType !== "appointment") return false;
      if (filtro === "sin_gestion" && r.noteCount > 0) return false;
      if (!t) return true;
      return [r.clientName, r.clientCompany, r.clientPhone, r.clientEmail, r.repName, r.serviceInterest]
        .some(v => (v || "").toLowerCase().includes(t));
    });
  }, [rows, q, filtro]);

  async function guardarNota(r: Row) {
    if (!draft.trim()) return;
    setGuardando(true);
    const res = await fetch("/api/recovery/notes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceType: r.sourceType, sourceId: r.sourceId, content: draft }),
    });
    setGuardando(false);
    if (res.ok) { setDraft(""); setAbierta(null); cargar(); }
    else alert("No se pudo guardar el comentario");
  }

  const fmtFecha = (iso: string) =>
    new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="flex min-h-screen" style={{ background: "#F8F9FB" }}>
      <Sidebar user={user} />
      <main className="flex-1 lg:ml-0 pt-14 lg:pt-0">
        <div className="max-w-6xl mx-auto px-6 py-8">

          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#9CA3AF" }}>Recupero</p>
              <h1 className="text-2xl font-bold" style={{ color: "#27295C" }}>Leads para contactar</h1>
              <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
                Propuestas sin aceptar y citas que no cerraron
              </p>
            </div>
            <button onClick={cargar} className="p-2 rounded-lg border" style={{ borderColor: "#E5E7EB", background: "white" }} aria-label="Refrescar">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} style={{ color: "#6B7280" }} />
            </button>
          </div>

          <div className="flex gap-3 mb-5 flex-wrap items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }} />
              <input value={q} onChange={e => setQ(e.target.value)}
                placeholder="Buscar nombre, empresa, telefono, agente..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: "#E5E7EB", background: "white" }} />
            </div>
            {([
              ["todos", "Todos"],
              ["proposal", "Propuestas"],
              ["appointment", "Citas"],
              ["sin_gestion", "Sin gestionar"],
            ] as const).map(([k, label]) => (
              <button key={k} onClick={() => setFiltro(k)}
                className="px-3 py-2 rounded-lg text-xs font-semibold"
                style={{
                  background: filtro === k ? "#27295C" : "white",
                  color: filtro === k ? "white" : "#6B7280",
                  border: `1px solid ${filtro === k ? "#27295C" : "#E5E7EB"}`,
                }}>
                {label}
              </button>
            ))}
            <span className="text-xs" style={{ color: "#9CA3AF" }}>{filtradas.length} de {rows.length}</span>
          </div>

          <div className="rounded-2xl border" style={{ borderColor: "#E5E7EB", background: "white" }}>
            {loading && rows.length === 0 ? (
              <p className="text-sm text-center py-12" style={{ color: "#9CA3AF" }}>Cargando...</p>
            ) : filtradas.length === 0 ? (
              <p className="text-sm text-center py-12" style={{ color: "#9CA3AF" }}>Sin resultados</p>
            ) : filtradas.map(r => {
              const key = r.sourceType + ":" + r.sourceId;
              const abierto = abierta === key;
              return (
                <div key={key} className="border-b last:border-b-0" style={{ borderColor: "#F0F0F0" }}>
                  <div className="px-5 py-4">
                    <div className="flex items-start gap-4 flex-wrap">
                      <div className="flex-1 min-w-[220px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold" style={{ color: "#27295C" }}>{r.clientName || "Sin nombre"}</p>
                          <span className="text-xs px-2 py-0.5 rounded-md"
                            style={{
                              background: r.sourceType === "proposal" ? "rgba(201,168,76,0.12)" : "rgba(139,92,246,0.12)",
                              color: r.sourceType === "proposal" ? "#92400E" : "#4C1D95",
                            }}>
                            {r.sourceType === "proposal" ? "Propuesta" : "Cita"}
                          </span>
                          {r.total != null && (
                            <span className="text-xs font-semibold" style={{ color: "#C9A84C" }}>USD {r.total.toLocaleString("en-US")}</span>
                          )}
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "#F1F5F9", color: "#475569" }}>
                            {(r.clientLanguage || "es").toUpperCase()}
                          </span>
                          {r.noteCount > 0 && (
                            <span className="text-xs flex items-center gap-1" style={{ color: "#16A34A" }}>
                              <Check className="w-3 h-3" /> {r.noteCount}
                            </span>
                          )}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
                          {r.clientCompany || "Sin empresa"}
                          {r.serviceInterest ? ` · ${r.serviceInterest}` : ""}
                        </p>
                      </div>

                      <div className="min-w-[170px]">
                        <p className="text-xs" style={{ color: "#9CA3AF" }}>Telefono</p>
                        {r.clientPhone ? (
                          <a href={"https://wa.me/" + r.clientPhone.replace(/\D/g, "")} target="_blank" rel="noreferrer"
                            className="text-xs font-medium" style={{ color: "#25D366" }}>
                            {r.clientPhone}
                          </a>
                        ) : <span className="text-xs" style={{ color: "#9CA3AF" }}>—</span>}
                        <p className="text-xs truncate mt-0.5" style={{ color: "#6B7280" }}>{r.clientEmail || ""}</p>
                      </div>

                      <div className="min-w-[130px]">
                        <p className="text-xs" style={{ color: "#9CA3AF" }}>Agente</p>
                        <p className="text-xs font-medium" style={{ color: "#374151" }}>{r.repName || "Sin asignar"}</p>
                        <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{fmtFecha(r.refDate)}</p>
                      </div>

                      {voiceReady && r.clientPhone && (
                        <button onClick={() => llamar(r)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold self-start"
                          style={{
                            background: enLlamada === key ? "#FEE2E2" : "#27295C",
                            color: enLlamada === key ? "#991B1B" : "white",
                            border: "1px solid transparent",
                          }}>
                          {enLlamada === key
                            ? <><PhoneOff className="w-3.5 h-3.5" /> Colgar</>
                            : <><Phone className="w-3.5 h-3.5" /> Llamar</>}
                        </button>
                      )}
                      <button onClick={() => { setAbierta(abierto ? null : key); setDraft(""); }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold self-start"
                        style={{ background: "white", border: "1px solid #E5E7EB", color: "#374151" }}>
                        <MessageCircle className="w-3.5 h-3.5" /> Comentar
                      </button>
                    </div>

                    {r.lastNote && !abierto && (
                      <p className="text-xs mt-2 px-3 py-2 rounded-lg" style={{ background: "#F8F9FB", color: "#6B7280" }}>
                        {r.lastNote}
                      </p>
                    )}

                    {abierto && (
                      <div className="mt-3 flex gap-2">
                        <textarea value={draft} onChange={e => setDraft(e.target.value)} autoFocus rows={2}
                          placeholder="Resultado de la llamada, proximo paso, objecion..."
                          className="flex-1 px-3 py-2 rounded-lg border text-xs"
                          style={{ borderColor: "#E5E7EB" }} />
                        <button onClick={() => guardarNota(r)} disabled={guardando || !draft.trim()}
                          className="px-4 py-2 rounded-lg text-xs font-semibold self-end"
                          style={{ background: draft.trim() ? "#27295C" : "#E5E7EB", color: draft.trim() ? "white" : "#9CA3AF" }}>
                          {guardando ? "..." : "Guardar"}
                        </button>
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
