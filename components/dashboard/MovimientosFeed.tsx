"use client";
import { useEffect, useState, useCallback } from "react";
import { parseFechaSegura as parseFecha } from "@/lib/fechas";

interface Mov {
  occurred_at: string; source: string; kind: string; actor: string | null;
  description: string | null; detail: string | null;
  lead_company: string | null; src_type: string; src_id: string;
}

const ESTILO: Record<string, { bg: string; color: string; label: string }> = {
  mensaje:            { bg: "#EEEDFE", color: "#3C3489", label: "whatsapp" },
  pendiente:          { bg: "#FAECE7", color: "#993C1D", label: "pendiente" },
  cita:               { bg: "#E1F5EE", color: "#0F6E56", label: "cita" },
  cita_agendada:      { bg: "#E1F5EE", color: "#0F6E56", label: "agendada" },
  llamada:            { bg: "#FBEAF0", color: "#72243E", label: "llamada" },
  propuesta_enviada:  { bg: "#E6F1FB", color: "#0C447C", label: "propuesta" },
  propuesta_reminder: { bg: "#E6F1FB", color: "#0C447C", label: "recordatorio" },
  propuesta_call:     { bg: "#FBEAF0", color: "#72243E", label: "llamada" },
  propuesta_accepted: { bg: "#EAF3DE", color: "#3B6D11", label: "aceptada" },
  pago:               { bg: "#EAF3DE", color: "#3B6D11", label: "pago" },
  propuesta_paid:     { bg: "#EAF3DE", color: "#3B6D11", label: "pago" },
  nota:               { bg: "#F1EFE8", color: "#5F5E5A", label: "nota" },
  lead_web:           { bg: "#F1EFE8", color: "#5F5E5A", label: "web" },
};

const FILTROS = [
  { key: "todo", label: "Todo" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "scheduling", label: "Citas" },
  { key: "propuestas", label: "Propuestas" },
  { key: "telefono", label: "Llamadas" },
];


function fechaTitulo(iso: string, tz: string) {
  const d = parseFecha(iso);
  const hoy = new Date();
  const mismo = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const ayer = new Date(hoy.getTime() - 86400000);
  if (mismo(d, hoy)) return "Hoy";
  if (mismo(d, ayer)) return "Ayer";
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: tz });
}

function servicios(detail: string): string {
  try {
    const arr = JSON.parse(detail) as { name: string; price: number }[];
    return arr.map(s => `${s.name} — USD ${s.price}`).join(" · ");
  } catch { return detail; }
}

export default function MovimientosFeed({ email, timezone = "America/New_York" }: {
  email: string; timezone?: string;
}) {
  const [items, setItems] = useState<Mov[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("todo");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/clients/movimientos?email=${encodeURIComponent(email)}`);
      const d = await r.json();
      setItems(d.items || []);
    } catch { setItems([]); }
    setLoading(false);
  }, [email]);

  useEffect(() => { cargar(); }, [cargar]);

  const visibles = filtro === "todo" ? items : items.filter(m => m.source === filtro);

  const grupos: [string, Mov[]][] = [];
  visibles.forEach(m => {
    const t = fechaTitulo(m.occurred_at, timezone);
    const ult = grupos[grupos.length - 1];
    if (ult && ult[0] === t) ult[1].push(m);
    else grupos.push([t, [m]]);
  });

  return (
    <div className="rounded-2xl bg-white border overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
      <div className="px-5 py-3 border-b flex items-center gap-4 flex-wrap" style={{ borderColor: "#F0F0F0" }}>
        <span className="text-sm font-semibold" style={{ color: "#27295C" }}>Movimientos</span>
        <div className="flex gap-3 flex-wrap">
          {FILTROS.map(f => {
            const n = f.key === "todo" ? items.length : items.filter(m => m.source === f.key).length;
            if (n === 0 && f.key !== "todo") return null;
            return (
              <button key={f.key} onClick={() => setFiltro(f.key)}
                className="text-xs transition-colors"
                style={{ color: filtro === f.key ? "#27295C" : "#9CA3AF", fontWeight: filtro === f.key ? 600 : 400 }}>
                {f.label} <span style={{ color: "#D1D5DB" }}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="px-5 py-8 space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-6 rounded animate-pulse" style={{ background: "#F3F4F6" }} />)}
        </div>
      ) : visibles.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm" style={{ color: "#9CA3AF" }}>Sin movimientos.</p>
      ) : (
        grupos.map(([titulo, movs]) => (
          <div key={titulo}>
            <div className="px-5 py-1.5 border-b" style={{ background: "#FAFAFA", borderColor: "#F0F0F0" }}>
              <span className="text-xs uppercase tracking-wider" style={{ color: "#9CA3AF", fontFamily: "ui-monospace, monospace" }}>{titulo}</span>
            </div>
            {movs.map((m, i) => {
              const st = ESTILO[m.kind] || { bg: "#F1EFE8", color: "#5F5E5A", label: m.kind };
              const id = m.src_type + m.src_id + m.occurred_at + i;
              const hora = parseFecha(m.occurred_at)
                .toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: timezone });
              return (
                <div key={id}

                  className="grid gap-3 px-5 py-2.5 border-b items-start hover:bg-gray-50 transition-colors"
                  style={{ gridTemplateColumns: "46px 96px minmax(0,1fr)", borderColor: "#F0F0F0" }}>
                  <span className="text-xs" style={{ color: "#9CA3AF", fontFamily: "ui-monospace, monospace" }}>{hora}</span>
                  <span className="text-xs px-2 py-0.5 rounded text-center truncate"
                        style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  <div className="min-w-0">
                    <p className="text-sm" style={{ color: "#111827", whiteSpace: "pre-wrap" }}>
                      {m.actor && <span style={{ color: "#6B7280" }}>{m.actor}: </span>}
                      {m.description}
                    </p>
                    {m.detail && (
                      <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>
                        {m.kind === "propuesta_enviada" ? servicios(m.detail) : m.detail}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
