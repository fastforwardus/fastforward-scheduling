"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { RecoveryTabs } from "@/components/dashboard/RecoveryTabs";
import { RefreshCw, Phone, PhoneCall, Clock, TrendingUp } from "lucide-react";

interface Datos {
  resumen: {
    hoy: number; semana: number; mes: number; total: number;
    atendidas: number; minutos: number; sinResultado: number;
    tasaContacto: number; recuperados: number; usdRecuperado: number;
  };
  porUsuario: { usuario: string; llamadas: number; atendidas: number; minutos: number; recuperados: number }[];
  porOutcome: { outcome: string; cantidad: number }[];
  porDia: { fecha: string; llamadas: number }[];
  esEquipo: boolean;
}

const LABEL: Record<string, [string, string]> = {
  recuperado: ["Recuperado", "#16A34A"],
  interesado: ["Interesado", "#3B82F6"],
  pidio_tiempo: ["Pidio tiempo", "#C9A84C"],
  no_interesa: ["No le interesa", "#6B7280"],
  no_contesta: ["No contesta", "#9CA3AF"],
  numero_equivocado: ["Numero equivocado", "#EF4444"],
};

function Stat({ icon: Icon, label, value, sub, color, bg }: {
  icon: React.ElementType; label: string; value: string | number;
  sub?: string; color: string; bg: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border flex items-center gap-4" style={{ borderColor: "#E5E7EB" }}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold" style={{ color: "#27295C" }}>{value}</p>
        <p className="text-xs font-medium" style={{ color: "#9CA3AF" }}>{label}</p>
        {sub && <p className="text-xs" style={{ color }}>{sub}</p>}
      </div>
    </div>
  );
}

export default function RecoveryMetricsClient({ user }: {
  user: { id: string; fullName: string; email: string; role: string; canRecovery?: boolean };
}) {
  const [d, setD] = useState<Datos | null>(null);
  const [loading, setLoading] = useState(true);

  async function cargar() {
    setLoading(true);
    try {
      const r = await fetch("/api/recovery/metrics");
      const j = await r.json();
      if (!j.error) setD(j);
    } catch { /* noop */ }
    setLoading(false);
  }
  useEffect(() => { cargar(); }, []);

  const maxDia = Math.max(1, ...(d?.porDia || []).map(x => x.llamadas));
  const maxUser = Math.max(1, ...(d?.porUsuario || []).map(x => x.llamadas));

  return (
    <div className="flex min-h-screen" style={{ background: "#F8F9FB" }}>
      <Sidebar user={user} />
      <main className="flex-1 lg:ml-0 pt-14 lg:pt-0">
        <div className="max-w-6xl mx-auto px-6 py-8">

          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#9CA3AF" }}>Recupero</p>
              <h1 className="text-2xl font-bold" style={{ color: "#27295C" }}>Metricas</h1>
              {d && (
                <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
                  {d.esEquipo ? "Todo el equipo" : "Tus llamadas"}
                </p>
              )}
            </div>
            <button onClick={cargar} className="p-2 rounded-lg border" style={{ borderColor: "#E5E7EB", background: "white" }} aria-label="Refrescar">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} style={{ color: "#6B7280" }} />
            </button>
          </div>

          <RecoveryTabs />

          {!d ? (
            <p className="text-sm text-center py-12" style={{ color: "#9CA3AF" }}>
              {loading ? "Cargando..." : "Todavia no hay llamadas registradas"}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <Stat icon={Phone} label="Llamadas hoy" value={d.resumen.hoy}
                  sub={`${d.resumen.semana} esta semana`} color="#27295C" bg="rgba(39,41,92,0.08)" />
                <Stat icon={PhoneCall} label="Este mes" value={d.resumen.mes}
                  sub={`${d.resumen.total} en total`} color="#3B82F6" bg="rgba(59,130,246,0.1)" />
                <Stat icon={Clock} label="Minutos hablados" value={d.resumen.minutos}
                  sub={`${d.resumen.tasaContacto}% de contacto`} color="#8B5CF6" bg="rgba(139,92,246,0.1)" />
                <Stat icon={TrendingUp} label="Recuperadas" value={d.resumen.recuperados}
                  sub={d.resumen.usdRecuperado > 0 ? `USD ${d.resumen.usdRecuperado.toLocaleString("en-US")}` : undefined}
                  color="#16A34A" bg="rgba(34,197,94,0.1)" />
              </div>

              {d.resumen.sinResultado > 0 && (
                <p className="text-xs px-4 py-2.5 rounded-xl mb-4"
                  style={{ background: "#FEF9C3", color: "#854D0E" }}>
                  {d.resumen.sinResultado} llamada{d.resumen.sinResultado > 1 ? "s" : ""} sin resultado cargado.
                  Sin eso no se puede medir que funciona.
                </p>
              )}

              <div className="grid lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border p-5" style={{ borderColor: "#E5E7EB" }}>
                  <p className="text-sm font-semibold mb-4" style={{ color: "#27295C" }}>Quien llamo mas</p>
                  {d.porUsuario.length === 0 ? (
                    <p className="text-xs" style={{ color: "#9CA3AF" }}>Sin datos</p>
                  ) : d.porUsuario.map(u => (
                    <div key={u.usuario} className="mb-3 last:mb-0">
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-xs font-medium" style={{ color: "#374151" }}>{u.usuario}</span>
                        <span className="text-xs" style={{ color: "#9CA3AF" }}>
                          <b style={{ color: "#27295C" }}>{u.llamadas}</b> · {u.minutos}m
                          {u.recuperados > 0 && <span style={{ color: "#16A34A" }}> · {u.recuperados} rec.</span>}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: "#F3F4F6" }}>
                        <div className="h-1.5 rounded-full" style={{ width: `${(u.llamadas / maxUser) * 100}%`, background: "#27295C" }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-white rounded-2xl border p-5" style={{ borderColor: "#E5E7EB" }}>
                  <p className="text-sm font-semibold mb-4" style={{ color: "#27295C" }}>Resultados</p>
                  {d.porOutcome.length === 0 ? (
                    <p className="text-xs" style={{ color: "#9CA3AF" }}>Todavia nadie cargo resultados</p>
                  ) : (() => {
                    const tot = d.porOutcome.reduce((s, o) => s + o.cantidad, 0);
                    return d.porOutcome.map(o => {
                      const [label, color] = LABEL[o.outcome] || [o.outcome, "#9CA3AF"];
                      const pct = Math.round((o.cantidad / tot) * 100);
                      return (
                        <div key={o.outcome} className="mb-3 last:mb-0">
                          <div className="flex items-baseline justify-between mb-1">
                            <span className="text-xs font-medium" style={{ color: "#374151" }}>{label}</span>
                            <span className="text-xs" style={{ color: "#9CA3AF" }}>
                              <b style={{ color }}>{o.cantidad}</b> · {pct}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full" style={{ background: "#F3F4F6" }}>
                            <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color }} />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              <div className="bg-white rounded-2xl border p-5 mt-4" style={{ borderColor: "#E5E7EB" }}>
                <p className="text-sm font-semibold mb-4" style={{ color: "#27295C" }}>Ultimos 14 dias</p>
                {d.porDia.length === 0 ? (
                  <p className="text-xs" style={{ color: "#9CA3AF" }}>Sin datos</p>
                ) : (
                  <div className="flex items-end gap-1.5" style={{ height: 90 }}>
                    {d.porDia.map(x => (
                      <div key={x.fecha} className="flex-1 flex flex-col items-center justify-end gap-1">
                        <span className="text-xs" style={{ color: "#9CA3AF" }}>{x.llamadas}</span>
                        <div className="w-full rounded-t"
                          style={{ height: `${(x.llamadas / maxDia) * 60}px`, background: "#C9A84C", minHeight: 3 }} />
                        <span className="text-xs" style={{ color: "#9CA3AF", fontSize: 9 }}>
                          {x.fecha.slice(8, 10)}/{x.fecha.slice(5, 7)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
