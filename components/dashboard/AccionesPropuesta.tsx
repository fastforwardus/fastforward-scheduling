"use client";
import { useState } from "react";
import { Send, X, Loader2, Pencil } from "lucide-react";

export default function AccionesPropuesta({ id, pagada, onListo, onEditar }: {
  id: string; pagada: boolean; onListo: () => void; onEditar?: () => void;
}) {
  const [cargando, setCargando] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function ejecutar(accion: string, motivo?: string) {
    setCargando(accion); setMsg(null);
    try {
      const r = await fetch("/api/proposals/acciones", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, accion, motivo }),
      });
      const d = await r.json();
      if (r.ok) {
        setMsg(accion === "reenviar" ? `Reenviada a ${d.a}` : "Anulada");
        onListo();
      } else {
        setMsg(d.error || "No se pudo");
      }
    } catch {
      setMsg("Error de conexion");
    }
    setCargando(null);
  }

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {msg && <span className="text-xs mr-1" style={{ color: "#6B7280" }}>{msg}</span>}

      <button onClick={e => { e.stopPropagation(); ejecutar("reenviar"); }}
        disabled={!!cargando} title="Reenviar al cliente"
        className="p-1.5 rounded-md" style={{ background: "#F3F4F6" }}>
        {cargando === "reenviar"
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "#6B7280" }} />
          : <Send className="w-3.5 h-3.5" style={{ color: "#27295C" }} />}
      </button>

      {!pagada && onEditar && (
        <button onClick={e => { e.stopPropagation(); onEditar(); }}
          title="Editar y reenviar"
          className="p-1.5 rounded-md" style={{ background: "#F3F4F6" }}>
          <Pencil className="w-3.5 h-3.5" style={{ color: "#27295C" }} />
        </button>
      )}

      {!pagada && (
        <button onClick={e => {
            e.stopPropagation();
            const m = prompt("Motivo de la anulacion (opcional):");
            if (m !== null) ejecutar("anular", m);
          }}
          disabled={!!cargando} title="Anular"
          className="p-1.5 rounded-md" style={{ background: "#FEF2F2" }}>
          {cargando === "anular"
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "#991B1B" }} />
            : <X className="w-3.5 h-3.5" style={{ color: "#DC2626" }} />}
        </button>
      )}
    </div>
  );
}
