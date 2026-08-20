"use client";
import { useEffect, useState, useCallback } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import AccionesPropuesta from "@/components/dashboard/AccionesPropuesta";
import ProposalModal from "@/components/dashboard/ProposalModal";
import { Search, RefreshCw } from "lucide-react";

interface Prop {
  id: string; proposal_num: string; total: number; discount: number;
  status: string; created_at: string; accepted_at: string | null;
  invoice_sent_at: string | null; payment_confirmed_at: string | null;
  client_name: string; client_company: string; client_email: string;
  zoho_invoice_id: string | null; confirm_token: string; rep_name: string | null;
  services?: unknown; lang?: string;
}

const FILTROS = [
  { key: "todas",     label: "Todas" },
  { key: "pendiente", label: "Pendientes" },
  { key: "aceptada",  label: "Aceptadas" },
  { key: "pagada",    label: "Pagadas" },
  { key: "anulada",   label: "Anuladas" },
];

function estadoDe(p: Prop) {
  if (p.payment_confirmed_at) return "pagada";
  if (p.status === "cancelled") return "anulada";
  if (p.status === "accepted") return "aceptada";
  return "pendiente";
}

const BADGE: Record<string, { bg: string; color: string; label: string }> = {
  pagada:    { bg: "#DCFCE7", color: "#166534", label: "Pagada" },
  aceptada:  { bg: "#FEF9C3", color: "#854D0E", label: "Aceptada" },
  anulada:   { bg: "#FEE2E2", color: "#991B1B", label: "Anulada" },
  pendiente: { bg: "#F3F4F6", color: "#6B7280", label: "Pendiente" },
};

export default function PropuestasClient({ user }: {
  user: { id?: string; fullName: string; email: string; role: string; slug?: string; canRecovery?: boolean };
}) {
  const [items, setItems] = useState<Prop[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("todas");
  const [q, setQ] = useState("");
  const [editando, setEditando] = useState<Prop | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/proposals/my");
      const d = await r.json();
      setItems(d.proposals || []);
    } catch { setItems([]); }
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const texto = q.trim().toLowerCase();
  const visibles = items.filter(p => {
    if (filtro !== "todas" && estadoDe(p) !== filtro) return false;
    if (!texto) return true;
    return [p.client_name, p.client_company, p.client_email, p.proposal_num, p.rep_name]
      .some(v => (v || "").toLowerCase().includes(texto));
  });

  const suma = visibles.reduce((a, p) => a + Number(p.total || 0), 0);

  return (
    <div className="flex min-h-screen" style={{ background: "#F8F9FB" }}>
      <Sidebar user={user} />
      <main className="flex-1 min-w-0 pt-14 lg:pt-0 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#9CA3AF" }}>
                {user.role === "admin" ? "Equipo" : "Mis propuestas"}
              </p>
              <h1 className="text-2xl font-bold" style={{ color: "#27295C" }}>Propuestas</h1>
            </div>
            <button onClick={cargar} className="p-2 rounded-lg border"
              style={{ borderColor: "#E5E7EB", background: "white" }} aria-label="Actualizar">
              <RefreshCw className="w-4 h-4" style={{ color: "#6B7280" }} />
            </button>
          </div>

          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#D1D5DB" }} />
              <input value={q} onChange={e => setQ(e.target.value)}
                placeholder="Buscar cliente, empresa, numero…"
                className="w-full text-sm pl-9 pr-3 py-2 rounded-lg border"
                style={{ borderColor: "#E5E7EB", color: "#27295C" }} />
            </div>
            {FILTROS.map(f => {
              const n = f.key === "todas" ? items.length : items.filter(p => estadoDe(p) === f.key).length;
              return (
                <button key={f.key} onClick={() => setFiltro(f.key)}
                  className="text-xs px-3 py-2 rounded-lg border"
                  style={{
                    borderColor: filtro === f.key ? "#27295C" : "#E5E7EB",
                    background: filtro === f.key ? "#27295C" : "white",
                    color: filtro === f.key ? "white" : "#6B7280",
                  }}>
                  {f.label} <span style={{ opacity: 0.6 }}>{n}</span>
                </button>
              );
            })}
          </div>

          <p className="text-xs mb-3" style={{ color: "#9CA3AF" }}>
            {visibles.length} propuesta{visibles.length === 1 ? "" : "s"} · USD ${suma.toLocaleString("en-US")}
          </p>

          <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
            {loading ? (
              <div className="px-5 py-10 space-y-3">
                {[1,2,3,4,5].map(i => <div key={i} className="h-5 rounded animate-pulse" style={{ background: "#F3F4F6" }} />)}
              </div>
            ) : visibles.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm" style={{ color: "#9CA3AF" }}>Sin resultados.</p>
            ) : visibles.map(p => {
              const b = BADGE[estadoDe(p)];
              return (
                <div key={p.id} className="px-5 py-3.5 flex items-center gap-3 border-b last:border-b-0"
                     style={{ borderColor: "#F0F0F0" }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="text-sm font-semibold truncate" style={{ color: "#27295C" }}>
                        {p.client_name || p.client_email}
                      </p>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: b.bg, color: b.color }}>{b.label}</span>
                    </div>
                    <p className="text-xs" style={{ color: "#9CA3AF" }}>
                      {p.proposal_num} · USD ${Number(p.total).toLocaleString("en-US")}
                      {p.client_company ? ` · ${p.client_company}` : ""}
                      {user.role === "admin" && p.rep_name ? ` · ${p.rep_name}` : ""}
                    </p>
                  </div>
                  <p className="text-xs shrink-0" style={{ color: "#D1D5DB" }}>
                    {new Date(p.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                  </p>
                  <AccionesPropuesta id={p.id} pagada={!!p.payment_confirmed_at}
                    onEditar={() => setEditando(p)} onListo={cargar} />
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {editando && (
        <ProposalModal
          appointmentId=""
          clientName={editando.client_name || ""}
          clientCompany={editando.client_company || ""}
          clientEmail={editando.client_email || ""}
          clientLanguage={editando.lang || "es"}
          editarId={editando.id}
          descuentoInicial={Number(editando.discount || 0)}
          serviciosIniciales={(() => {
            try {
              const arr = typeof editando.services === "string"
                ? JSON.parse(editando.services) : editando.services;
              return Array.isArray(arr) ? arr : [];
            } catch { return []; }
          })()}
          onClose={() => setEditando(null)}
          onSuccess={() => { setEditando(null); cargar(); }}
        />
      )}
    </div>
  );
}
