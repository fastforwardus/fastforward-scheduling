"use client";
import { useEffect, useState, useCallback } from "react";
import { Bell, X, Check } from "lucide-react";
import Link from "next/link";

interface Item {
  id: string;
  tipo: "llamada" | "recordatorio";
  titulo: string;
  detalle: string | null;
  cuando: string;
  vencido: boolean;
}

function parseFecha(iso: string): Date {
  let t = String(iso).trim().replace(" ", "T");
  if (/([+-])(\d{2})$/.test(t)) t += ":00";
  return new Date(t);
}

export function ReminderBell() {
  const [items, setItems] = useState<Item[]>([]);
  const [abierto, setAbierto] = useState(false);

  const cargar = useCallback(async () => {
    const salida: Item[] = [];
    const ahora = Date.now();

    try {
      const r = await fetch("/api/recovery/reminders");
      const d = await r.json();
      for (const i of d.items || []) {
        salida.push({
          id: i.id, tipo: "llamada",
          titulo: i.clientName,
          detalle: i.proposalNum || null,
          cuando: i.followUpAt,
          vencido: parseFecha(i.followUpAt).getTime() < ahora,
        });
      }
    } catch { /* silencioso */ }

    try {
      const r = await fetch("/api/reminders-personales?vista=abiertos");
      const d = await r.json();
      for (const i of d.items || []) {
        salida.push({
          id: i.id, tipo: "recordatorio",
          titulo: i.title,
          detalle: i.lead_email || null,
          cuando: i.due_at,
          vencido: parseFecha(i.due_at).getTime() < ahora,
        });
      }
    } catch { /* silencioso */ }

    salida.sort((a, b) => parseFecha(a.cuando).getTime() - parseFecha(b.cuando).getTime());
    setItems(salida);
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [cargar]);

  async function completar(it: Item) {
    setItems(prev => prev.filter(x => x.id !== it.id));
    if (it.tipo === "llamada") {
      await fetch("/api/recovery/calls", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId: it.id, followUpDone: true }),
      }).catch(() => {});
    } else {
      await fetch("/api/reminders-personales", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: it.id, accion: "completar" }),
      }).catch(() => {});
    }
  }

  if (items.length === 0) return null;

  const vencidos = items.filter(i => i.vencido).length;

  const fmt = (iso: string) => parseFecha(iso).toLocaleDateString("es-ES", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "America/New_York",
  });

  return (
    <div className="relative px-3 pb-2">
      <button onClick={() => setAbierto(!abierto)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
        style={{
          background: vencidos > 0 ? "rgba(239,68,68,0.16)" : "rgba(201,168,76,0.16)",
          color: vencidos > 0 ? "#FCA5A5" : "#C9A84C",
        }}>
        <Bell className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-left">Pendientes</span>
        <span className="px-2 py-0.5 rounded-full text-xs font-bold"
          style={{
            background: vencidos > 0 ? "#EF4444" : "#C9A84C",
            color: vencidos > 0 ? "white" : "#1A1C3E",
          }}>{items.length}</span>
      </button>

      {abierto && (
        <div className="absolute left-3 right-3 bottom-full mb-2 z-50 rounded-xl overflow-hidden"
          style={{ background: "white", boxShadow: "0 -4px 28px rgba(0,0,0,0.28)" }}>
          <div className="px-4 py-2.5 flex items-center justify-between"
            style={{ background: "#F8F9FB", borderBottom: "1px solid #E5E7EB" }}>
            <span className="text-xs font-semibold" style={{ color: "#27295C" }}>
              {vencidos > 0 ? `${vencidos} vencido${vencidos === 1 ? "" : "s"}` : "Pendientes"}
            </span>
            <button onClick={() => setAbierto(false)} aria-label="Cerrar">
              <X className="w-3.5 h-3.5" style={{ color: "#9CA3AF" }} />
            </button>
          </div>

          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {items.map(i => (
              <div key={i.tipo + i.id} className="px-4 py-2.5 flex items-start gap-2"
                style={{
                  borderBottom: "1px solid #F0F0F0",
                  background: i.vencido ? "#FEF2F2" : "white",
                  borderLeft: i.vencido ? "2px solid #DC2626" : "2px solid transparent",
                }}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate"
                     style={{ color: i.vencido ? "#7F1D1D" : "#27295C" }}>{i.titulo}</p>
                  <p className="text-xs" style={{ color: i.vencido ? "#991B1B" : "#9CA3AF" }}>
                    {i.tipo === "llamada" ? "Volver a llamar · " : ""}
                    {i.detalle ? i.detalle + " · " : ""}{fmt(i.cuando)}
                  </p>
                </div>
                <button onClick={() => completar(i)}
                  className="p-1 rounded-md flex-shrink-0" style={{ background: "rgba(34,197,94,0.12)" }}
                  aria-label="Marcar como hecho">
                  <Check className="w-3 h-3" style={{ color: "#16A34A" }} />
                </button>
              </div>
            ))}
          </div>

          <Link href="/dashboard" onClick={() => setAbierto(false)}
            className="block px-4 py-2.5 text-xs font-semibold text-center"
            style={{ background: "#27295C", color: "white" }}>
            Ver mi dia →
          </Link>
        </div>
      )}
    </div>
  );
}
