"use client";
import { useEffect, useState } from "react";
import { ExternalLink, FileText } from "lucide-react";

interface Tarea {
  id: string; titulo: string; estado: string; vence: string | null;
  prioridad: string | null; notas: string | null;
  cliente: string | null; url: string | null;
}

const ESTADO: Record<string, { bg: string; color: string; label: string }> = {
  "In Progress": { bg: "#E1F5EE", color: "#0F6E56", label: "en curso" },
  "Not Started": { bg: "#F3F4F6", color: "#6B7280", label: "sin iniciar" },
  "Waiting":     { bg: "#FEF3C7", color: "#854D0E", label: "esperando" },
};

const VISIBLES = 4;

export default function TrabajoEnCurso() {
  const [items, setItems] = useState<Tarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [todas, setTodas] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch("/api/zoho-tareas");
        const d = await r.json();
        if (vivo) setItems(d.items || []);
      } catch { if (vivo) setItems([]); }
      if (vivo) setLoading(false);
    })();
    return () => { vivo = false; };
  }, []);

  if (loading || items.length === 0) return null;

  const lista = todas ? items : items.slice(0, VISIBLES);

  return (
    <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
      <div className="px-5 py-3.5 border-b flex items-center gap-2" style={{ borderColor: "#F0F0F0" }}>
        <p className="font-semibold text-sm" style={{ color: "#27295C" }}>Trabajo en curso</p>
        <span className="text-xs px-2 py-0.5 rounded-full font-bold"
              style={{ background: "#F3F4F6", color: "#6B7280" }}>{items.length}</span>
        <span className="ml-auto text-xs" style={{ color: "#D1D5DB", fontFamily: "ui-monospace, monospace" }}>
          desde Zoho
        </span>
      </div>

      {lista.map(t => {
        const e = ESTADO[t.estado] || { bg: "#F3F4F6", color: "#6B7280", label: t.estado.toLowerCase() };
        return (
          <a key={t.id} href={t.url || "#"} target="_blank" rel="noreferrer"
            className="grid gap-3 px-5 py-3 border-b last:border-b-0 items-start hover:bg-gray-50 transition-colors"
            style={{ gridTemplateColumns: "88px minmax(0,1fr) 20px", borderColor: "#F0F0F0" }}>
            <span className="text-xs px-2 py-0.5 rounded text-center truncate"
                  style={{ background: e.bg, color: e.color }}>{e.label}</span>
            <div className="min-w-0">
              <p className="text-sm" style={{ color: "#111827" }}>
                {t.titulo}
                {t.notas && <FileText className="w-3 h-3 inline ml-1.5 -mt-0.5" style={{ color: "#D1D5DB" }} />}
              </p>
              {t.cliente && (
                <p className="text-xs mt-0.5 truncate" style={{ color: "#9CA3AF" }}>{t.cliente}</p>
              )}
            </div>
            <ExternalLink className="w-3.5 h-3.5 mt-0.5" style={{ color: "#D1D5DB" }} />
          </a>
        );
      })}

      {items.length > VISIBLES && (
        <button onClick={() => setTodas(!todas)}
          className="w-full px-5 py-2.5 text-xs text-left" style={{ color: "#27295C" }}>
          {todas ? "Ver menos" : `Ver las ${items.length} →`}
        </button>
      )}
    </div>
  );
}
