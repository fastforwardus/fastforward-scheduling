"use client";
import { useEffect, useState, useCallback } from "react";
import { Send, UserCheck, Loader2 } from "lucide-react";

interface Usuario { id: string; fullName: string; role: string; isActive: boolean }

export default function ConversacionAcciones({
  conversationId, ownerUserId, lastUserMsgAt, optedOut, sessionUser, onCambio,
}: {
  conversationId: string;
  ownerUserId: string | null;
  lastUserMsgAt: string | null;
  optedOut: boolean;
  sessionUser: { id: string; role: string };
  onCambio: () => void;
}) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const puedeAsignar = sessionUser.role === "admin" || sessionUser.role === "sales_manager";
  const esDueno = ownerUserId === sessionUser.id || sessionUser.role === "admin";

  const horas = lastUserMsgAt
    ? (Date.now() - new Date(String(lastUserMsgAt).replace(" ", "T")).getTime()) / 3600000
    : Infinity;
  const ventanaAbierta = horas <= 24;
  const restante = ventanaAbierta ? Math.max(0, Math.floor(24 - horas)) : 0;

  const cargarUsuarios = useCallback(async () => {
    if (!puedeAsignar) return;
    try {
      const r = await fetch("/api/admin/users");
      const d = await r.json();
      setUsuarios((Array.isArray(d) ? d : d.users || []).filter((u: Usuario) => u.isActive));
    } catch { /* silencioso */ }
  }, [puedeAsignar]);

  useEffect(() => { cargarUsuarios(); }, [cargarUsuarios]);

  async function asignar(userId: string) {
    setError(null);
    const r = await fetch("/api/admin/adriana/asignar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, userId: userId || null }),
    });
    if (r.ok) onCambio();
    else setError("No se pudo asignar");
  }

  async function responder() {
    if (!texto.trim() || enviando) return;
    setEnviando(true); setError(null);
    const r = await fetch("/api/admin/adriana/asignar", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, texto }),
    });
    const d = await r.json().catch(() => ({}));
    setEnviando(false);
    if (r.ok) { setTexto(""); onCambio(); }
    else setError(d.mensaje || d.error || "No se pudo enviar");
  }

  return (
    <div className="border-b" style={{ borderColor: "#E5E7EB", background: "white" }}>
      <div className="px-4 py-2.5 flex items-center gap-2 flex-wrap">
        <UserCheck className="w-4 h-4" style={{ color: "#9CA3AF" }} />
        <span className="text-xs" style={{ color: "#6B7280" }}>Responsable</span>
        {puedeAsignar ? (
          <select value={ownerUserId || ""} onChange={e => asignar(e.target.value)}
            className="text-xs px-2 py-1 rounded-md border"
            style={{ borderColor: "#E5E7EB", color: "#27295C" }}>
            <option value="">Sin asignar</option>
            {usuarios.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
        ) : (
          <span className="text-xs font-medium" style={{ color: "#27295C" }}>
            {usuarios.find(u => u.id === ownerUserId)?.fullName || (ownerUserId ? "Asignada" : "Sin asignar")}
          </span>
        )}
        {ventanaAbierta && (
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full"
            style={{ background: "#DCFCE7", color: "#166534" }}>
            Podés responder · {restante} h
          </span>
        )}
      </div>

      {optedOut ? (
        <p className="px-4 pb-3 text-xs" style={{ color: "#991B1B" }}>
          El cliente pidió no recibir más mensajes.
        </p>
      ) : !ownerUserId ? (
        <p className="px-4 pb-3 text-xs" style={{ color: "#9CA3AF" }}>
          Asigná un responsable para poder responder.
        </p>
      ) : !esDueno ? (
        <p className="px-4 pb-3 text-xs" style={{ color: "#9CA3AF" }}>
          Solo el responsable puede responder esta conversación.
        </p>
      ) : !ventanaAbierta ? (
        <p className="px-4 pb-3 text-xs" style={{ color: "#854D0E" }}>
          Pasaron más de 24 h desde el último mensaje del cliente. WhatsApp solo permite plantillas aprobadas fuera de esa ventana.
        </p>
      ) : (
        <div className="px-4 pb-3 flex gap-2 items-end">
          <textarea value={texto} onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) responder(); }}
            rows={2} placeholder="Escribí tu respuesta…"
            className="flex-1 text-sm px-3 py-2 rounded-lg border resize-none"
            style={{ borderColor: "#E5E7EB", color: "#1F2937" }} />
          <button onClick={responder} disabled={!texto.trim() || enviando}
            className="p-2.5 rounded-lg flex-shrink-0"
            style={{ background: texto.trim() ? "#27295C" : "#F3F4F6" }}
            aria-label="Enviar">
            {enviando
              ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: "white" }} />
              : <Send className="w-4 h-4" style={{ color: texto.trim() ? "white" : "#D1D5DB" }} />}
          </button>
        </div>
      )}

      {error && <p className="px-4 pb-3 text-xs" style={{ color: "#991B1B" }}>{error}</p>}
    </div>
  );
}
