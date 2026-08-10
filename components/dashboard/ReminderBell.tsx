"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, X, Check } from "lucide-react";
import Link from "next/link";

interface Item {
  id: string;
  clientName: string;
  proposalNum: string | null;
  toPhone: string | null;
  followUpAt: string;
}

export function ReminderBell() {
  const [items, setItems] = useState<Item[]>([]);
  const [abierto, setAbierto] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/recovery/reminders");
      const d = await r.json();
      setItems(d.items || []);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => {
    cargar();
    // Refresco cada 5 min: los recordatorios vencen por hora, no al segundo
    const t = setInterval(cargar, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [cargar]);

  async function descartar(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
    await fetch("/api/recovery/calls", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callId: id, followUpDone: true }),
    }).catch(() => {});
  }

  if (items.length === 0) return null;

  const fmt = (iso: string) => new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "America/New_York",
  });

  return (
    <div className="relative px-3 pb-2">
      <button onClick={() => setAbierto(!abierto)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
        style={{ background: "rgba(201,168,76,0.16)", color: "#C9A84C" }}>
        <Bell className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-left">Recordatorios</span>
        <span className="px-2 py-0.5 rounded-full text-xs font-bold"
          style={{ background: "#C9A84C", color: "#1A1C3E" }}>{items.length}</span>
      </button>

      {abierto && (
        <div className="absolute left-3 right-3 bottom-full mb-2 z-50 rounded-xl overflow-hidden"
          style={{ background: "white", boxShadow: "0 -4px 28px rgba(0,0,0,0.28)" }}>
          <div className="px-4 py-2.5 flex items-center justify-between"
            style={{ background: "#F8F9FB", borderBottom: "1px solid #E5E7EB" }}>
            <span className="text-xs font-semibold" style={{ color: "#27295C" }}>Volver a llamar</span>
            <button onClick={() => setAbierto(false)} aria-label="Cerrar">
              <X className="w-3.5 h-3.5" style={{ color: "#9CA3AF" }} />
            </button>
          </div>
          <div style={{ maxHeight: 280, overflowY: "auto" }}>
            {items.map(i => (
              <div key={i.id} className="px-4 py-2.5 flex items-start gap-2"
                style={{ borderBottom: "1px solid #F0F0F0" }}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: "#27295C" }}>{i.clientName}</p>
                  <p className="text-xs" style={{ color: "#9CA3AF" }}>
                    {i.proposalNum ? i.proposalNum + " · " : ""}{fmt(i.followUpAt)}
                  </p>
                </div>
                <button onClick={() => descartar(i.id)}
                  className="p-1 rounded-md flex-shrink-0" style={{ background: "rgba(34,197,94,0.12)" }}
                  aria-label="Marcar como hecho">
                  <Check className="w-3 h-3" style={{ color: "#16A34A" }} />
                </button>
              </div>
            ))}
          </div>
          <Link href="/dashboard/recovery" onClick={() => setAbierto(false)}
            className="block px-4 py-2.5 text-xs font-semibold text-center"
            style={{ background: "#27295C", color: "white" }}>
            Ir a Recupero →
          </Link>
        </div>
      )}
    </div>
  );
}
