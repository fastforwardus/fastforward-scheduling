"use client";

import { useState } from "react";
import { Calendar, Video, MessageCircle, Phone, Clock, Building2, Mail } from "lucide-react";
import { AssignModal } from "./AssignModal";

interface Appointment {
  id: string;
  clientName: string;
  clientEmail: string;
  clientCompany: string;
  clientWhatsapp: string;
  platform: string;
  scheduledAt: string;
  status: string;
  outcome: string | null;
  leadScore: string;
  serviceInterest: string | null;
  repName: string | null;
  repSlug: string | null;
  assignedTo: string | null;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending_assignment: { bg: "rgba(234,179,8,0.1)", text: "#92400e", label: "Sin asignar" },
  scheduled:         { bg: "rgba(59,130,246,0.1)", text: "#1d4ed8", label: "Agendada" },
  confirmed:         { bg: "rgba(34,197,94,0.1)", text: "#15803d", label: "Confirmada" },
  completed:         { bg: "rgba(39,41,92,0.1)",  text: "#27295C", label: "Completada" },
  no_show:           { bg: "rgba(239,68,68,0.1)", text: "#dc2626", label: "No-show" },
  cancelled:         { bg: "rgba(156,163,175,0.2)", text: "#6b7280", label: "Cancelada" },
};

const SCORE_COLORS: Record<string, string> = {
  hot: "#ef4444", warm: "#f59e0b", cold: "#3b82f6",
};

const SCORE_ICONS: Record<string, string> = {
  hot: "🔥", warm: "🟡", cold: "❄️",
};

export function AppointmentCard({
  appt,
  canAssign = false,
  onRefresh,
}: {
  appt: Appointment;
  canAssign?: boolean;
  onRefresh?: () => void;
}) {
  const [showAssign, setShowAssign] = useState(false);
  const status = STATUS_COLORS[appt.status] || STATUS_COLORS.scheduled;

  const slotDate = new Date(appt.scheduledAt);
  const isToday = new Date().toDateString() === slotDate.toDateString();
  const isFuture = slotDate > new Date();

  const dateStr = slotDate.toLocaleDateString("es-ES", {
    weekday: "short", day: "numeric", month: "short", timeZone: "America/New_York",
  });
  const timeStr = slotDate.toLocaleTimeString("es-ES", {
    hour: "2-digit", minute: "2-digit", timeZone: "America/New_York",
  });

  return (
    <>
      <div className="rounded-2xl border transition-all duration-200 hover:shadow-md overflow-hidden"
           style={{ background: "white", borderColor: "#E5E7EB" }}>

        {/* Top stripe for urgent */}
        {appt.status === "pending_assignment" && (
          <div className="h-1" style={{ background: "#C9A84C" }} />
        )}

        <div className="p-5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                   style={{ background: "#27295C" }}>
                {appt.clientName[0]}
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: "#27295C" }}>{appt.clientName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Building2 className="w-3 h-3" style={{ color: "#9CA3AF" }} />
                  <p className="text-xs" style={{ color: "#6B7280" }}>{appt.clientCompany}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">{SCORE_ICONS[appt.leadScore]}</span>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ background: status.bg, color: status.text }}>
                {status.label}
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="flex items-center gap-2 text-xs" style={{ color: "#6B7280" }}>
              <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#9CA3AF" }} />
              <span className={isToday ? "font-semibold" : ""} style={{ color: isToday ? "#C9A84C" : undefined }}>
                {isToday ? "HOY" : dateStr}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: "#6B7280" }}>
              <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#9CA3AF" }} />
              {timeStr} EST
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: "#6B7280" }}>
              {appt.platform === "whatsapp"
                ? <MessageCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#25D366" }} />
                : <Video className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#9CA3AF" }} />
              }
              {appt.platform === "meet" ? "Google Meet" : appt.platform === "zoom" ? "Zoom" : "WhatsApp"}
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: "#6B7280" }}>
              <Mail className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#9CA3AF" }} />
              <span className="truncate">{appt.clientEmail}</span>
            </div>
          </div>

          {/* Assigned rep */}
          {appt.repName && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg"
                 style={{ background: "rgba(39,41,92,0.04)" }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                   style={{ background: "#27295C" }}>
                {appt.repName[0]}
              </div>
              <span className="text-xs" style={{ color: "#27295C" }}>{appt.repName}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {appt.status === "pending_assignment" && canAssign && (
              <button onClick={() => setShowAssign(true)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all hover:-translate-y-0.5"
                style={{ background: "#C9A84C", color: "#1A1C3E" }}>
                Asignar →
              </button>
            )}
            {canAssign && appt.assignedTo && (
              <button onClick={() => setShowAssign(true)}
                className="py-2.5 px-3 rounded-xl text-xs font-medium border-2 transition-all"
                style={{ borderColor: "#E5E7EB", color: "#6B7280" }}>
                Reasignar
              </button>
            )}
            {isFuture && appt.platform !== "whatsapp" && appt.status !== "pending_assignment" && (
              <a href={`/book/confirm/${appt.id}`}
                className="py-2.5 px-3 rounded-xl text-xs font-medium border-2 transition-all flex items-center gap-1"
                style={{ borderColor: "#E5E7EB", color: "#6B7280" }}>
                <Video className="w-3 h-3" /> Iniciar
              </a>
            )}
            {appt.platform === "whatsapp" && isFuture && (
              <a href={`https://wa.me/${appt.clientWhatsapp.replace(/\D/g,"")}`}
                target="_blank" rel="noreferrer"
                className="py-2.5 px-3 rounded-xl text-xs font-medium flex items-center gap-1 transition-all"
                style={{ background: "#25D366", color: "white" }}>
                <Phone className="w-3 h-3" /> WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>

      {showAssign && (
        <AssignModal
          appointment={appt}
          onClose={() => setShowAssign(false)}
          onAssigned={() => { setShowAssign(false); onRefresh?.(); }}
        />
      )}
    </>
  );
}
