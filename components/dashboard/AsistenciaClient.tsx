"use client";
import { useCallback, useEffect, useState } from "react";

type Fila = { userId: string; fullName: string; fecha: string; entrada: string; salida: string | null; horas: number | null; marcas: number; origenes: string[] };
type Data = {
  filas: Fila[];
  lastSync: { at: string; from: string; to: string; punches: number; inserted: number; sinUsuario: string[] } | null;
  lastError: string | null;
  reps: { fullName: string; ngtecoId: string | null }[];
};

const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit" });
const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

export default function AsistenciaClient({ isAdmin }: { isAdmin: boolean }) {
  const hoy = new Date();
  const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
  const [from, setFrom] = useState(ymd(lunes));
  const [to, setTo] = useState(ymd(hoy));
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const cargar = useCallback(async () => {
    const r = await fetch(`/api/admin/asistencia?from=${from}&to=${to}`, { cache: "no-store" });
    if (r.ok) setData(await r.json());
  }, [from, to]);
  useEffect(() => { cargar(); }, [cargar]);

  async function sincronizar() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/admin/asistencia/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days: 14 }) });
      const j = await r.json();
      setMsg(r.ok ? `NGTeco: ${j.punches} marcas leídas, ${j.inserted} nuevas` : `Error: ${j.error}`);
      await cargar();
    } finally { setBusy(false); }
  }

  const sinMapear = data?.reps.filter((r) => !r.ngtecoId).map((r) => r.fullName) || [];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Asistencia</h1>
          <p className="text-xs text-gray-500">
            Huella en oficina (NGTeco) + clock-in remoto desde scheduling. Primera marca del día = entrada, última = salida.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-xs text-gray-600">Desde<br /><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-sm" /></label>
          <label className="text-xs text-gray-600">Hasta<br /><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-sm" /></label>
          {isAdmin && (
            <button onClick={sincronizar} disabled={busy} className="rounded-lg bg-black px-3 py-1.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50">
              {busy ? "Sincronizando…" : "Sincronizar NGTeco"}
            </button>
          )}
        </div>
      </div>

      <div className="text-xs text-gray-500 space-y-1">
        {data?.lastSync && (
          <div>Última sincronización NGTeco: {new Date(data.lastSync.at).toLocaleString("es-US", { timeZone: "America/New_York" })} · {data.lastSync.punches} marcas ({data.lastSync.inserted} nuevas)
            {data.lastSync.sinUsuario.length > 0 && <span className="text-amber-700"> · sin usuario en scheduling: {data.lastSync.sinUsuario.join(", ")}</span>}
          </div>
        )}
        {data?.lastError && <div className="text-red-600">Último error NGTeco: {data.lastError}</div>}
        {sinMapear.length > 0 && <div className="text-amber-700">Usuarios sin ID de NGTeco (solo fichan remoto): {sinMapear.join(", ")}</div>}
        {msg && <div className="text-gray-800">{msg}</div>}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Fecha</th><th className="px-3 py-2">Persona</th><th className="px-3 py-2">Entrada</th>
              <th className="px-3 py-2">Salida</th><th className="px-3 py-2">Horas</th><th className="px-3 py-2">Marcas</th><th className="px-3 py-2">Origen</th>
            </tr>
          </thead>
          <tbody>
            {!data && <tr><td className="px-3 py-4 text-gray-400" colSpan={7}>Cargando…</td></tr>}
            {data && data.filas.length === 0 && <tr><td className="px-3 py-4 text-gray-400" colSpan={7}>Sin marcas en el rango.</td></tr>}
            {data?.filas.map((f) => (
              <tr key={`${f.userId}-${f.fecha}`} className="border-t border-gray-100">
                <td className="px-3 py-2 whitespace-nowrap">{f.fecha}</td>
                <td className="px-3 py-2 whitespace-nowrap">{f.fullName}</td>
                <td className="px-3 py-2">{hora(f.entrada)}</td>
                <td className="px-3 py-2">{f.salida ? hora(f.salida) : <span className="text-amber-600">abierta</span>}</td>
                <td className="px-3 py-2">{f.horas ?? "—"}</td>
                <td className="px-3 py-2">{f.marcas}</td>
                <td className="px-3 py-2">{f.origenes.map((o) => o === "ngteco" ? "Huella" : "Remoto").join(" + ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
