"use client";
import { useState } from "react";
import { Send, X, Loader2, Pencil, Check } from "lucide-react";

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
        setMsg(accion === "reenviar" ? `Reenviada a ${d.a}`
             : accion === "aceptar_manual" ? "Marcada como aceptada"
             : "Anulada");
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
            // El cliente cerro por fuera del boton: pago directo, pidio factura
            // o confirmo en la llamada. Sin esto la propuesta seguia pendiente.
            const m = prompt(
              "¿Como se cerro?\n\n" +
              "1 = Pagó directo\n" +
              "2 = Pidió factura\n" +
              "3 = Cerró en la llamada\n" +
              "4 = Otro\n\n" +
              "Escribí el número:");
            if (m === null) return;
            const MOTIVOS: Record<string, string> = {
              "1": "pago_directo", "2": "pidio_factura",
              "3": "cerro_llamada", "4": "otro",
            };
            const motivo = MOTIVOS[m.trim()];
            if (!motivo) { setMsg("Número inválido"); return; }
            if (confirm("Se marca como aceptada y deja de recibir recordatorios. ¿Confirmás?")) {
              ejecutar("aceptar_manual", motivo);
            }
          }}
          disabled={!!cargando} title="Marcar como aceptada"
          className="p-1.5 rounded-md" style={{ background: "#F0FDF4" }}>
          {cargando === "aceptar_manual"
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "#166534" }} />
            : <Check className="w-3.5 h-3.5" style={{ color: "#16A34A" }} />}
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
