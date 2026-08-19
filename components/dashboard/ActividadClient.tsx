"use client";
import { useEffect, useState, useCallback } from "react";

interface Mov {
  occurred_at: string; source: string; kind: string; actor: string | null;
  description: string | null; detail: string | null;
  lead_email: string | null; lead_company: string | null;
}

const ESTILO: Record<string, { bg: string; color: string; label: string }> = {
  mensaje:            { bg: "#EEEDFE", color: "#3C3489", label: "whatsapp" },
  pendiente:          { bg: "#FAECE7", color: "#993C1D", label: "pendiente" },
  cita:               { bg: "#E1F5EE", color: "#0F6E56", label: "cita" },
  cita_agendada:      { bg: "#E1F5EE", color: "#0F6E56", label: "agendada" },
  llamada:            { bg: "#FBEAF0", color: "#72243E", label: "llamada" },
  propuesta_call:     { bg: "#FBEAF0", color: "#72243E", label: "llamada" },
  propuesta_enviada:  { bg: "#E6F1FB", color: "#0C447C", label: "propuesta" },
  propuesta_reminder: { bg: "#E6F1FB", color: "#0C447C", label: "recordatorio" },
  propuesta_accepted: { bg: "#EAF3DE", color: "#3B6D11", label: "aceptada" },
  pago:               { bg: "#EAF3DE", color: "#3B6D11", label: "pago" },
  propuesta_paid:     { bg: "#EAF3DE", color: "#3B6D11", label: "pago" },
  nota:               { bg: "#F1EFE8", color: "#5F5E5A", label: "nota" },
  lead_web:           { bg: "#F1EFE8", color: "#5F5E5A", label: "web" },
};

function parseFecha(iso: string): Date {
  let t = String(iso).trim().replace(" ", "T");
  if (/([+-])(\d{2})$/.test(t)) t += ":00";
  return new Date(t);
}

function dia(iso: string, tz: string) {
  const d = parseFecha(iso);
  const hoy = new Date();
  const ayer = new Date(hoy.getTime() - 86400000);
  if (d.toDateString() === hoy.toDateString()) return "Hoy";
  if (d.toDateString() === ayer.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: tz });
}

export default function ActividadClient({ timezone = "America/New_York" }: { timezone?: string }) {
  const [items, setItems] = useState<Mov[]>([]);
  const [actores, setActores] = useState<{ actor: string; n: number }[]>([]);
  const [actor, setActor] = useState("");
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/actividad?limit=120${actor ? "&actor=" + encodeURIComponent(actor) : ""}`);
      const d = await r.json();
      setItems(d.items || []);
      if (!actor) setActores(d.actores || []);
    } catch { setItems([]); }
    setLoading(false);
  }, [actor]);

  useEffect(() => { cargar(); }, [cargar]);

  const grupos: [string, Mov[]][] = [];
  items.forEach(m => {
    const t = dia(m.occurred_at, timezone);
    const u = grupos[grupos.length - 1];
    if (u && u[0] === t) u[1].push(m); else grupos.push([t, [m]]);
  });

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #E5E7EB" }}>
      <div className="px-5 py-3 border-b flex items-center gap-3 flex-wrap" style={{ borderColor: "#F0F0F0" }}>
        <span className="text-sm font-semibold" style={{ color: "#27295C" }}>Actividad del equipo</span>
        <button onClick={() => setActor("")} className="text-xs"
          style={{ color: !actor ? "#27295C" : "#9CA3AF", fontWeight: !actor ? 600 : 400 }}>Todos</button>
        {actores.slice(0, 8).map(a => (
          <button key={a.actor} onClick={() => setActor(a.actor)} className="text-xs"
            style={{ color: actor === a.actor ? "#27295C" : "#9CA3AF", fontWeight: actor === a.actor ? 600 : 400 }}>
            {a.actor} <span style={{ color: "#D1D5DB" }}>{a.n}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="px-5 py-8 space-y-3">
          {[1,2,3,4,5].map(i => <div key={i} className="h-5 rounded animate-pulse" style={{ background: "#F3F4F6" }} />)}
        </div>
      ) : items.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm" style={{ color: "#9CA3AF" }}>Sin actividad.</p>
      ) : (
        grupos.map(([titulo, movs]) => (
          <div key={titulo}>
            <div className="px-5 py-1.5 border-b" style={{ background: "#FAFAFA", borderColor: "#F0F0F0" }}>
              <span className="text-xs uppercase tracking-wider" style={{ color: "#9CA3AF", fontFamily: "ui-monospace, monospace" }}>{titulo}</span>
            </div>
            {movs.map((m, i) => {
              const st = ESTILO[m.kind] || { bg: "#F1EFE8", color: "#5F5E5A", label: m.kind };
              const hora = parseFecha(m.occurred_at)
                .toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: timezone });
              return (
                <div key={i} className="grid gap-3 px-5 py-2.5 border-b items-start"
                  style={{ gridTemplateColumns: "46px 92px 96px minmax(0,1fr)", borderColor: "#F0F0F0" }}>
                  <span className="text-xs" style={{ color: "#9CA3AF", fontFamily: "ui-monospace, monospace" }}>{hora}</span>
                  <span className="text-xs truncate" style={{ color: "#6B7280" }}>{m.actor || "—"}</span>
                  <span className="text-xs px-2 py-0.5 rounded text-center truncate"
                        style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  <div className="min-w-0">
                    <p className="text-sm" style={{ color: "#111827" }}>{m.description}</p>
                    {(m.lead_company || m.lead_email) && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: "#9CA3AF" }}>
                        {m.lead_company || m.lead_email}
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
