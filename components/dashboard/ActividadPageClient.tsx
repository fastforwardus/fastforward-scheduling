"use client";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";

type Ev = {
  created_at: string; actor: string | null; tipo: string;
  detalle: string | null; proposal_num: string | null; client_name: string | null;
};

const COLORES: Record<string, string> = {
  factura_manual: "bg-green-100 text-green-800",
  factura_editada: "bg-amber-100 text-amber-800",
  factura_editar_intento: "bg-gray-100 text-gray-700",
  factura_manual_error: "bg-red-100 text-red-800",
  factura_editada_error: "bg-red-100 text-red-800",
  invoice_manual: "bg-green-100 text-green-800",
  invoice_editada: "bg-amber-100 text-amber-800",
  accepted: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function ActividadPageClient({ user }: { user: { id: string; email: string; fullName: string; role: string; slug: string; canRecovery?: boolean } }) {
  const [evs, setEvs] = useState<Ev[]>([]);
  const [esAdmin, setEsAdmin] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [filtroActor, setFiltroActor] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");

  useEffect(() => {
    fetch("/api/actividad")
      .then((r) => r.json())
      .then((d) => { setEvs(d.eventos ?? []); setEsAdmin(!!d.esAdmin); })
      .catch(() => setEvs([]))
      .finally(() => setCargando(false));
  }, []);

  const actores = Array.from(new Set(evs.map((e) => e.actor).filter(Boolean))) as string[];
  const tipos = Array.from(new Set(evs.map((e) => e.tipo))).sort();

  const visibles = evs.filter((e) =>
    (!filtroActor || e.actor === filtroActor) && (!filtroTipo || e.tipo === filtroTipo)
  );

  const fecha = (s: string) =>
    new Date(s).toLocaleString("es", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex min-h-screen" style={{ background: "#F8F9FB" }}>
      <Sidebar user={user} />
      <main className="flex-1 lg:ml-0 pt-14 lg:pt-0 overflow-auto">
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-1">Actividad</h1>
      <p className="text-sm text-gray-500 mb-6">
        {esAdmin ? "Actividad de todo el equipo." : "Tu actividad."}
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {esAdmin && (
          <select className="border rounded-lg px-3 py-2 text-sm"
            value={filtroActor} onChange={(e) => setFiltroActor(e.target.value)}>
            <option value="">Todos</option>
            {actores.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        <select className="border rounded-lg px-3 py-2 text-sm"
          value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="text-sm text-gray-400 self-center ml-auto">
          {visibles.length} de {evs.length}
        </span>
      </div>

      {cargando && <p className="text-sm text-gray-500">Cargando...</p>}
      {!cargando && visibles.length === 0 && (
        <p className="text-sm text-gray-500">Sin actividad registrada.</p>
      )}

      <div className="space-y-1">
        {visibles.map((e, i) => (
          <div key={i} className="border rounded-lg px-4 py-3 flex gap-4 items-start text-sm">
            <span className="text-gray-400 whitespace-nowrap w-24 shrink-0">{fecha(e.created_at)}</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap shrink-0 ${COLORES[e.tipo] ?? "bg-gray-100 text-gray-600"}`}>
              {e.tipo}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-medium">
                {e.actor || "sistema"}
                {e.client_name && <span className="text-gray-500 font-normal"> · {e.client_name}</span>}
                {e.proposal_num && <span className="text-gray-400 font-normal"> · {e.proposal_num}</span>}
              </div>
              {e.detalle && <div className="text-gray-500 text-xs mt-0.5 break-words">{e.detalle}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
      </main>
    </div>
  );
}
