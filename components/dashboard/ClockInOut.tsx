"use client";
import { useCallback, useEffect, useState } from "react";

type Entry = { id: string; punchedAt: string; source: string; kind: string };
type Estado = { entries: Entry[]; clockedIn: boolean };

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit" });

export default function ClockInOut() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/asistencia/punch", { cache: "no-store" });
      if (r.ok) setEstado(await r.json());
    } catch {}
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function fichar(kind: "in" | "out") {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/asistencia/punch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind }) });
      const j = await r.json();
      if (!r.ok) setError(j.error || "Error");
      else setEstado(j);
    } catch { setError("Error de red"); }
    finally { setBusy(false); }
  }

  if (!estado) return null;
  const remotos = estado.entries.filter((e) => e.source === "scheduling");
  const ultimoIn = [...remotos].reverse().find((e) => e.kind === "in");
  const huellaHoy = estado.entries.some((e) => e.source === "ngteco");

  return (
    <div className="mx-4 mt-4 md:mx-6 md:mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">Asistencia remota</div>
          <div className="text-xs text-gray-500">
            {estado.clockedIn && ultimoIn
              ? `Clock-in abierto desde las ${hora(ultimoIn.punchedAt)}`
              : huellaHoy
                ? "Hoy ya hay marcas de huella en la oficina"
                : "Sin clock-in remoto hoy"}
          </div>
        </div>
        {estado.clockedIn ? (
          <button onClick={() => fichar("out")} disabled={busy}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            Clock-out
          </button>
        ) : (
          <button onClick={() => fichar("in")} disabled={busy}
            className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50">
            Clock-in remoto
          </button>
        )}
      </div>
      {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
      {estado.entries.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {estado.entries.map((e) => (
            <span key={e.id} className={`rounded-full px-2.5 py-1 text-xs ${e.source === "ngteco" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-700"}`}>
              {hora(e.punchedAt)} · {e.source === "ngteco" ? "Huella oficina" : e.kind === "in" ? "Entrada remota" : "Salida remota"}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
