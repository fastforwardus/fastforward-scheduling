"use client";

import { useEffect, useState } from "react";
import { X, Mail, FileText, CheckCircle, AlertTriangle, DollarSign, StickyNote } from "lucide-react";

interface Item {
  at: string; kind: string; channel?: string | null;
  label: string; detail?: string | null; exact: boolean;
}
interface Info {
  proposalNum: string; clientName: string | null; clientEmail: string | null;
  clientPhone: string | null; total: number; status: string; lang: string;
  repName: string | null; reminderStage: number; whatsappStage: number;
  whatsappFailCount: number; isDirect: boolean;
}

const ICONS: Record<string, typeof Mail> = {
  created: FileText, reminder: Mail, reminder_failed: AlertTriangle,
  delivery_failed: AlertTriangle, accepted: CheckCircle,
  invoice: FileText, paid: DollarSign, note: StickyNote,
};

const COLORS: Record<string, string> = {
  created: "#27295C", reminder: "#3B82F6", reminder_failed: "#EF4444",
  delivery_failed: "#EF4444", accepted: "#22C55E",
  invoice: "#C9A84C", paid: "#16A34A", note: "#8B5CF6",
};

export default function ProposalTimelineModal({ proposalId, onClose }: {
  proposalId: string; onClose: () => void;
}) {
  const [info, setInfo] = useState<Info | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [aprox, setAprox] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/proposals/timeline?id=${encodeURIComponent(proposalId)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else { setInfo(d.proposal); setItems(d.items || []); setAprox(!!d.aproximado); }
        setLoading(false);
      })
      .catch(() => { setError("No se pudo cargar"); setLoading(false); });
  }, [proposalId]);

  const fmt = (iso: string) => new Date(iso).toLocaleString("es-ES", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "America/New_York",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
           style={{ background: "white", maxHeight: "85vh" }} onClick={e => e.stopPropagation()}>

        <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ background: "#27295C" }}>
          <div>
            <p className="text-white font-semibold text-sm">
              {info?.proposalNum || "Propuesta"}
              {info && <span className="ml-2 font-normal" style={{ color: "rgba(255,255,255,0.6)" }}>
                USD {info.total.toLocaleString("en-US")}
              </span>}
            </p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
              {info ? `${info.clientName || "Sin nombre"} · ${info.repName || "Sin agente"} · ${info.lang.toUpperCase()}` : ""}
            </p>
          </div>
          <button onClick={onClose} style={{ color: "rgba(255,255,255,0.4)" }} aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-center py-8" style={{ color: "#9CA3AF" }}>Cargando...</p>
          ) : error ? (
            <p className="text-sm text-center py-8" style={{ color: "#EF4444" }}>{error}</p>
          ) : (
            <>
              {info && (
                <div className="flex gap-2 flex-wrap mb-5">
                  <span className="text-xs px-2 py-1 rounded-md"
                    style={{ background: info.status === "accepted" ? "#DCFCE7" : "#F3F4F6",
                             color: info.status === "accepted" ? "#166534" : "#6B7280" }}>
                    {info.status === "accepted" ? "Aceptada" : "Pendiente"}
                  </span>
                  {info.isDirect && (
                    <span className="text-xs px-2 py-1 rounded-md" style={{ background: "#F3F4F6", color: "#6B7280" }}>
                      Propuesta directa
                    </span>
                  )}
                  <span className="text-xs px-2 py-1 rounded-md" style={{ background: "#EFF6FF", color: "#1E40AF" }}>
                    Email etapa {info.reminderStage}
                  </span>
                  <span className="text-xs px-2 py-1 rounded-md" style={{ background: "#F0FDF4", color: "#166534" }}>
                    WhatsApp etapa {info.whatsappStage}
                  </span>
                  {info.whatsappFailCount > 0 && (
                    <span className="text-xs px-2 py-1 rounded-md" style={{ background: "#FEE2E2", color: "#991B1B" }}>
                      {info.whatsappFailCount} fallo{info.whatsappFailCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              )}

              {aprox && (
                <p className="text-xs px-3 py-2 rounded-lg mb-4"
                   style={{ background: "#FEF9C3", color: "#854D0E" }}>
                  Esta propuesta es anterior al registro de eventos: las fechas de los
                  recordatorios son estimadas a partir de la etapa alcanzada.
                </p>
              )}

              <div className="relative">
                {items.map((it, i) => {
                  const Icon = ICONS[it.kind] || FileText;
                  const color = COLORS[it.kind] || "#9CA3AF";
                  return (
                    <div key={i} className="flex gap-3 pb-5 relative">
                      {i < items.length - 1 && (
                        <div className="absolute left-[15px] top-8 bottom-0 w-px" style={{ background: "#E5E7EB" }} />
                      )}
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10"
                           style={{ background: color + "1A", border: `1px solid ${color}40` }}>
                        <Icon className="w-4 h-4" style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0 pt-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <p className="text-sm font-semibold" style={{ color: "#27295C" }}>{it.label}</p>
                          {it.channel && (
                            <span className="text-xs px-1.5 py-0.5 rounded"
                              style={{ background: "#F3F4F6", color: "#6B7280" }}>{it.channel}</span>
                          )}
                          <span className="text-xs" style={{ color: it.exact ? "#9CA3AF" : "#D97706" }}>
                            {fmt(it.at)}{!it.exact ? " (aprox)" : ""}
                          </span>
                        </div>
                        {it.detail && (
                          <p className="text-xs mt-0.5 break-words" style={{ color: "#6B7280" }}>{it.detail}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
