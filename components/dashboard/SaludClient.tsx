"use client";
import { useEffect, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";

interface Proc {
  nombre: string; ruta: string; ultimo: string | null;
  horas: number | null; umbral: number; estado: "ok" | "lento" | "frenado" | "nunca";
}
interface Alertas {
  handoffs_abiertos?: number; sin_outcome?: number;
  facturas_impagas?: number; recordatorios_vencidos?: number;
}

const COLOR: Record<string, { dot: string; bg: string; texto: string; label: string }> = {
  ok:      { dot: "#16A34A", bg: "white",   texto: "#374151", label: "al día" },
  lento:   { dot: "#EAB308", bg: "#FEFCE8", texto: "#854D0E", label: "demorado" },
  frenado: { dot: "#EF4444", bg: "#FEF2F2", texto: "#991B1B", label: "frenado" },
  nunca:   { dot: "#9CA3AF", bg: "#F9FAFB", texto: "#6B7280", label: "sin datos" },
};

function hace(horas: number | null) {
  if (horas === null) return "nunca";
  if (horas < 1) return `hace ${Math.max(1, Math.round(horas * 60))} min`;
  if (horas < 48) return `hace ${Math.round(horas)} h`;
  return `hace ${Math.round(horas / 24)} d`;
}

export default function SaludClient() {
  const [items, setItems] = useState<Proc[]>([]);
  const [alertas, setAlertas] = useState<Alertas>({});
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/salud");
      const d = await r.json();
      setItems(d.items || []);
      setAlertas(d.alertas || {});
    } catch { setItems([]); }
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const rotos = items.filter(i => i.estado === "frenado" || i.estado === "nunca").length;

  const tarjetas = [
    { label: "Consultas sin responder", valor: alertas.handoffs_abiertos ?? 0, malo: (alertas.handoffs_abiertos ?? 0) > 3 },
    { label: "Citas sin resultado",     valor: alertas.sin_outcome ?? 0,       malo: (alertas.sin_outcome ?? 0) > 20 },
    { label: "Facturas sin cobrar",     valor: alertas.facturas_impagas ?? 0,  malo: (alertas.facturas_impagas ?? 0) > 10 },
    { label: "Recordatorios vencidos",  valor: alertas.recordatorios_vencidos ?? 0, malo: (alertas.recordatorios_vencidos ?? 0) > 5 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold" style={{ color: "#27295C" }}>
          {loading ? "Revisando…" : rotos === 0 ? "Todo funcionando" : `${rotos} proceso${rotos === 1 ? "" : "s"} sin actividad`}
        </span>
        <button onClick={cargar} aria-label="Actualizar">
          <RefreshCw className="w-3.5 h-3.5" style={{ color: "#9CA3AF" }} />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tarjetas.map(t => (
          <div key={t.label} className="rounded-xl p-4 border"
               style={{ background: t.malo ? "#FEF2F2" : "white", borderColor: t.malo ? "#FECACA" : "#E5E7EB" }}>
            <p className="text-2xl font-bold" style={{ color: t.malo ? "#991B1B" : "#27295C" }}>{t.valor}</p>
            <p className="text-xs mt-0.5" style={{ color: t.malo ? "#B91C1C" : "#9CA3AF" }}>{t.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #E5E7EB" }}>
        <div className="px-5 py-3 border-b" style={{ borderColor: "#F0F0F0" }}>
          <span className="text-sm font-semibold" style={{ color: "#27295C" }}>Actividad de cada proceso</span>
        </div>

        {loading ? (
          <div className="px-5 py-8 space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-5 rounded animate-pulse" style={{ background: "#F3F4F6" }} />)}
          </div>
        ) : items.map(i => {
          const c = COLOR[i.estado];
          return (
            <div key={i.nombre}
              className="grid gap-3 px-5 py-3 border-b last:border-b-0 items-center"
              style={{ gridTemplateColumns: "10px minmax(0,1fr) 110px 96px", borderColor: "#F0F0F0", background: c.bg }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.dot }} />
              <div className="min-w-0">
                <p className="text-sm" style={{ color: c.texto }}>{i.nombre}</p>
                <p className="text-xs truncate" style={{ color: "#9CA3AF", fontFamily: "ui-monospace, monospace" }}>{i.ruta}</p>
              </div>
              <span className="text-xs text-right" style={{ color: c.texto, fontFamily: "ui-monospace, monospace" }}>
                {hace(i.horas)}
              </span>
              <span className="text-xs text-right" style={{ color: c.texto }}>{c.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
