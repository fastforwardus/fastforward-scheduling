"use client";
import { useEffect, useState } from "react";
import { parseFechaSegura as parseFecha } from "@/lib/fechas";

interface Mov {
  occurred_at: string; source: string; kind: string;
  actor: string | null; description: string | null; detail: string | null;
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


function cuando(iso: string, tz: string) {
  const d = parseFecha(iso);
  if (isNaN(d.getTime())) return "";
  const ahora = new Date();
  const dias = Math.floor((ahora.getTime() - d.getTime()) / 86400000);
  const hora = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  if (d.toDateString() === ahora.toDateString()) return hora;
  if (dias <= 1) return "ayer " + hora;
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", timeZone: tz });
}

export function UltimosMovimientos({ email, timezone = "America/New_York", cantidad = 3 }: {
  email: string; timezone?: string; cantidad?: number;
}) {
  const [items, setItems] = useState<Mov[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch(`/api/clients/movimientos?email=${encodeURIComponent(email)}`);
        const d = await r.json();
        if (!vivo) return;
        setItems((d.items || []).slice(0, cantidad));
        setTotal(d.total || 0);
      } catch { if (vivo) setItems([]); }
      if (vivo) setLoading(false);
    })();
    return () => { vivo = false; };
  }, [email, cantidad]);

  return (
    <div className="min-w-0 border-l pl-5" style={{ borderColor: "#E5E7EB" }}>
      <p className="text-xs uppercase tracking-wider mb-2.5"
         style={{ color: "#9CA3AF", fontFamily: "ui-monospace, monospace" }}>Ultimos movimientos</p>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-4 rounded animate-pulse" style={{ background: "#F3F4F6" }} />)}
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs" style={{ color: "#9CA3AF" }}>Sin movimientos registrados.</p>
      ) : (
        <>
          {items.map((m, i) => {
            const st = ESTILO[m.kind] || { bg: "#F1EFE8", color: "#5F5E5A", label: m.kind };
            return (
              <div key={i}
                className="grid gap-2.5 items-baseline pb-2 mb-2 border-b last:border-b-0 last:mb-0 last:pb-0"
                style={{ gridTemplateColumns: "74px 88px minmax(0,1fr)", borderColor: "#F0F0F0" }}>
                <span className="text-xs" style={{ color: "#9CA3AF", fontFamily: "ui-monospace, monospace" }}>
                  {cuando(m.occurred_at, timezone)}
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded text-center truncate"
                      style={{ background: st.bg, color: st.color }}>{st.label}</span>
                <span className="text-xs leading-relaxed" style={{ color: "#374151" }}>
                  {m.actor && m.kind === "mensaje" && (
                    <span style={{ color: "#9CA3AF" }}>{m.actor}: </span>
                  )}
                  {(m.description || "").slice(0, 110)}
                  {(m.description || "").length > 110 ? "…" : ""}
                </span>
              </div>
            );
          })}
          <a href={"/dashboard/clients/" + encodeURIComponent(email)}
             className="inline-block text-xs mt-2.5 hover:underline" style={{ color: "#27295C" }}>
            Ver los {total} movimientos →
          </a>
        </>
      )}
    </div>
  );
}
