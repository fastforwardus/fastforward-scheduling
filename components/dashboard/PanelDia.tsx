"use client";
import { useEffect, useState, useCallback } from "react";
import { Circle, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { parseFechaSegura as parseFecha } from "@/lib/fechas";

interface Rem {
  id: string; title: string; due_at: string; snooze_count: number;
  lead_email: string | null; done_at: string | null;
}


function relativo(iso: string, tz: string) {
  const d = parseFecha(iso);
  const diff = Date.now() - d.getTime();
  const hora = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: tz });

  if (diff > 0) {
    const dias = Math.floor(diff / 86400000);
    if (dias >= 1) return `hace ${dias} d`;
    if (diff > 3600000) return `hace ${Math.floor(diff / 3600000)} h`;
    return `hace ${Math.max(1, Math.floor(diff / 60000))} m`;
  }

  const hoy = new Date();
  const manana = new Date(hoy.getTime() + 86400000);
  if (d.toDateString() === hoy.toDateString()) return hora;
  if (d.toDateString() === manana.toDateString()) return `man ${hora}`;
  const fecha = d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", timeZone: tz });
  return `${fecha} ${hora}`;
}

const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

export default function PanelDia({ timezone = "America/New_York" }: {
  timezone?: string;
}) {
  const [rems, setRems] = useState<Rem[]>([]);
  const [mes, setMes] = useState(() => { const d = new Date(); return { a: d.getFullYear(), m: d.getMonth() }; });
  const [sel, setSel] = useState<Date | null>(null);
  const [texto, setTexto] = useState("");
  const [hora, setHora] = useState("09:00");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/reminders-personales?vista=abiertos");
      const d = await r.json();
      setRems(d.items || []);
    } catch { setRems([]); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function completar(id: string) {
    setRems(p => p.filter(x => x.id !== id));
    await fetch("/api/reminders-personales", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, accion: "completar" }),
    }).catch(() => {});
  }

  async function crear() {
    if (!texto.trim() || !sel || guardando) return;
    setGuardando(true);
    const [h, mi] = hora.split(":").map(Number);
    const d = new Date(sel); d.setHours(h, mi, 0, 0);
    const res = await fetch("/api/reminders-personales", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: texto.trim(), dueAt: d.toISOString() }),
    }).catch(() => null);
    setGuardando(false);
    if (res?.ok) { setTexto(""); setSel(null); cargar(); }
  }

  const primero = new Date(mes.a, mes.m, 1);
  const dias = new Date(mes.a, mes.m + 1, 0).getDate();
  const hoy = new Date();
  const conRem = new Set(rems.map(r => parseFecha(r.due_at).toDateString()));
  const celdas: (number | null)[] = Array(primero.getDay()).fill(null);
  for (let i = 1; i <= dias; i++) celdas.push(i);

  const vencidos = rems.filter(r => parseFecha(r.due_at).getTime() < Date.now());
  const proximos = rems.filter(r => parseFecha(r.due_at).getTime() >= Date.now()).slice(0, 4);

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(0,1fr) 240px" }}>

      <div>
        {rems.length === 0 ? (
          <div className="bg-white rounded-2xl border p-8 text-center" style={{ borderColor: "#E5E7EB" }}>
            <p className="text-sm font-semibold" style={{ color: "#27295C" }}>Sin pendientes</p>
            <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>Agenda uno desde el calendario</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
            <div className="px-5 py-3.5 border-b flex items-center gap-2" style={{ borderColor: "#F0F0F0" }}>
              <p className="font-semibold text-sm" style={{ color: "#27295C" }}>Pendientes</p>
              {vencidos.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                      style={{ background: "#FEE2E2", color: "#991B1B" }}>{vencidos.length} vencidos</span>
              )}
            </div>
            {[...vencidos, ...proximos].map(r => {
              const venc = parseFecha(r.due_at).getTime() < Date.now();
              return (
                <div key={r.id}
                  className="grid gap-3 px-5 py-3 border-b last:border-b-0 items-start"
                  style={{ gridTemplateColumns: "22px 104px minmax(0,1fr)", borderColor: "#F0F0F0",
                           background: venc ? "#FEF2F2" : "white",
                           borderLeft: venc ? "2px solid #DC2626" : "2px solid transparent" }}>
                  <button onClick={() => completar(r.id)} aria-label="Marcar hecho">
                    <Circle className="w-4 h-4" style={{ color: venc ? "#DC2626" : "#D1D5DB" }} />
                  </button>
                  <span className="text-xs" style={{ color: venc ? "#991B1B" : "#9CA3AF", fontFamily: "ui-monospace, monospace" }}>
                    {relativo(r.due_at, timezone)}
                  </span>
                  <span className="text-sm" style={{ color: venc ? "#7F1D1D" : "#111827" }}>
                    {r.title}
                    {r.snooze_count > 0 && (
                      <span className="text-xs ml-2" style={{ color: "#9CA3AF" }}>
                        · reprogramada {r.snooze_count} {r.snooze_count === 1 ? "vez" : "veces"}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
        <div className="px-3 py-2.5 border-b flex items-center justify-between" style={{ borderColor: "#F0F0F0" }}>
          <button onClick={() => setMes(p => p.m === 0 ? { a: p.a - 1, m: 11 } : { ...p, m: p.m - 1 })} aria-label="Mes anterior">
            <ChevronLeft className="w-4 h-4" style={{ color: "#9CA3AF" }} />
          </button>
          <span className="text-xs font-semibold" style={{ color: "#27295C" }}>{MESES[mes.m]} {mes.a}</span>
          <button onClick={() => setMes(p => p.m === 11 ? { a: p.a + 1, m: 0 } : { ...p, m: p.m + 1 })} aria-label="Mes siguiente">
            <ChevronRight className="w-4 h-4" style={{ color: "#9CA3AF" }} />
          </button>
        </div>

        <div className="px-2.5 py-2">
          <div className="grid grid-cols-7 text-center mb-1">
            {["d","l","m","m","j","v","s"].map((x, i) => (
              <span key={i} className="text-xs" style={{ color: "#D1D5DB", fontFamily: "ui-monospace, monospace" }}>{x}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {celdas.map((n, i) => {
              if (n === null) return <span key={i} />;
              const d = new Date(mes.a, mes.m, n);
              const esHoy = d.toDateString() === hoy.toDateString();
              const esSel = sel?.toDateString() === d.toDateString();
              const tiene = conRem.has(d.toDateString());
              return (
                <button key={i} onClick={() => setSel(esSel ? null : d)}
                  className="text-xs py-1 rounded-lg transition-colors"
                  style={{
                    background: esHoy ? "#27295C" : esSel ? "rgba(39,41,92,0.08)" : "transparent",
                    color: esHoy ? "white" : "#374151",
                    border: esSel && !esHoy ? "1px solid #27295C" : "1px solid transparent",
                  }}>
                  {n}
                  {tiene && !esHoy && (
                    <span className="block w-1 h-1 rounded-full mx-auto mt-0.5" style={{ background: "#C9A84C" }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {sel && (
          <div className="border-t px-3 py-2.5" style={{ borderColor: "#F0F0F0", background: "#F8F9FB" }}>
            <p className="text-xs mb-1.5" style={{ color: "#9CA3AF", fontFamily: "ui-monospace, monospace" }}>
              {sel.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}
            </p>
            <input value={texto} onChange={e => setTexto(e.target.value)} autoFocus
              onKeyDown={e => { if (e.key === "Enter") crear(); if (e.key === "Escape") setSel(null); }}
              placeholder="Recordarme…"
              className="w-full text-xs px-2 py-1.5 rounded-lg border"
              style={{ borderColor: "#E5E7EB", color: "#27295C" }} />
            <div className="flex gap-1.5 mt-1.5">
              {["09:00","14:00","17:00"].map(h => (
                <button key={h} onClick={() => setHora(h)}
                  className="text-xs px-2 py-0.5 rounded-md"
                  style={{ background: hora === h ? "#27295C" : "transparent",
                           color: hora === h ? "white" : "#9CA3AF",
                           border: `1px solid ${hora === h ? "#27295C" : "#E5E7EB"}` }}>{h}</button>
              ))}
              <button onClick={crear} disabled={!texto.trim() || guardando}
                className="ml-auto text-xs px-2 py-0.5 rounded-md font-semibold"
                style={{ background: texto.trim() ? "#C9A84C" : "#F3F4F6", color: texto.trim() ? "white" : "#D1D5DB" }}>
                <CheckCircle2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
