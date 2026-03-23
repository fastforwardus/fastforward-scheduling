"use client";
import ProposalModal from "@/components/dashboard/ProposalModal";
import type { Appt } from "@/types/appointments";

import { useState } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { AssignModal } from "@/components/dashboard/AssignModal";
import { OutcomeModal } from "@/components/dashboard/OutcomeModal";
import { NotesPanel } from "@/components/dashboard/NotesPanel";
import { RefreshCw, ChevronDown, ChevronUp, Video, MessageCircle, Phone, ExternalLink } from "lucide-react";



const STATUS_STYLES: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  pending_assignment: { bg: "#FEF9C3", text: "#854D0E", label: "Sin asignar", dot: "#EAB308" },
  scheduled:          { bg: "#DBEAFE", text: "#1E40AF", label: "Agendada",    dot: "#3B82F6" },
  confirmed:          { bg: "#DCFCE7", text: "#166534", label: "Confirmada",  dot: "#22C55E" },
  completed:          { bg: "#EDE9FE", text: "#4C1D95", label: "Completada",  dot: "#8B5CF6" },
  no_show:            { bg: "#FEE2E2", text: "#991B1B", label: "No-show",     dot: "#EF4444" },
  cancelled:          { bg: "#F3F4F6", text: "#374151", label: "Cancelada",   dot: "#9CA3AF" },
};

const OUTCOME_LABELS: Record<string, string> = {
  interested: "🔥 Interesado", needs_time: "🤔 Necesita tiempo",
  not_qualified: "❌ No califica", proposal_sent: "📄 Propuesta enviada", closed: "🏆 Cerrado",
};

const SCORE_ICONS: Record<string, string> = { hot: "🔥", warm: "🟡", cold: "❄️" };

function AppointmentRow({ appt, canAssign, currentUserId, currentRole, onRefresh, userTimezone }: {
  appt: Appt; canAssign: boolean; currentUserId: string; currentRole: string; onRefresh: () => void; userTimezone: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showOutcome, setShowOutcome] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const slotDate = new Date(appt.scheduledAt);
  const timeStr = slotDate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: userTimezone });
  const tzDate = new Date(slotDate.toLocaleString("en-US", { timeZone: userTimezone }));
  const nowInTz = new Date(new Date().toLocaleString("en-US", { timeZone: userTimezone }));
  const isToday = tzDate.toDateString() === nowInTz.toDateString();
  const st = STATUS_STYLES[appt.status] || STATUS_STYLES.scheduled;

  return (
    <>
      <div className="border-b last:border-b-0 transition-colors"
           style={{ borderColor: "#F0F0F0", background: expanded ? "#FAFAFA" : "white" }}>

        <div className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
             onClick={() => setExpanded(!expanded)}>
          <div className="w-14 flex-shrink-0 text-right">
            <span className="text-sm font-bold" style={{ color: isToday ? "#27295C" : "#6B7280" }}>{timeStr}</span>
          </div>
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: st.dot }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold" style={{ color: "#111827" }}>{appt.clientName}</span>
              {appt.outcome && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#F3F4F6", color: "#374151" }}>
                  {OUTCOME_LABELS[appt.outcome]}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs" style={{ color: "#6B7280" }}>{appt.clientCompany}</span>
              {appt.serviceInterest && <span className="text-xs" style={{ color: "#9CA3AF" }}>· {appt.serviceInterest.replace(/_/g," ")}</span>}
            </div>
          </div>
          {appt.repName && (
            <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold"
                   style={{ background: "#27295C", fontSize: "9px" }}>{appt.repName[0]}</div>
              <span className="text-xs" style={{ color: "#6B7280" }}>{appt.repName.split(" ")[0]}</span>
            </div>
          )}
          <div className="hidden sm:block flex-shrink-0">
            {appt.platform === "whatsapp"
              ? <MessageCircle className="w-4 h-4" style={{ color: "#25D366" }} />
              : <Video className="w-4 h-4" style={{ color: "#9CA3AF" }} />}
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0"
                style={{ background: st.bg, color: st.text }}>{st.label}</span>
          <span className="text-sm flex-shrink-0">{SCORE_ICONS[appt.leadScore]}</span>
          <div style={{ color: "#9CA3AF" }}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>

        {expanded && (
          <div className="px-5 pb-5 pt-1" onClick={e => e.stopPropagation()}>
            <div className="ml-[74px] space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Email", value: appt.clientEmail },
                  { label: "WhatsApp", value: appt.clientWhatsapp },
                  { label: "Plataforma", value: appt.platform === "meet" ? "Google Meet" : appt.platform === "zoom" ? "Zoom" : "WhatsApp" },
                  { label: "Experto", value: appt.repName || "Sin asignar" },
                ].map(item => (
                  <div key={item.label}>
                    <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#9CA3AF" }}>{item.label}</p>
                    <p className="text-xs font-medium truncate" style={{ color: "#374151" }}>{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {appt.status === "pending_assignment" && canAssign && (
                  <button onClick={() => setShowAssign(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                    style={{ background: "#EAB308", color: "white" }}>
                    Asignar →
                  </button>
                )}
                {canAssign && appt.assignedTo && (
                  <button onClick={() => setShowAssign(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border"
                    style={{ borderColor: "#E5E7EB", color: "#6B7280" }}>
                    Reasignar
                  </button>
                )}
                <button onClick={() => setShowOutcome(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                  style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)", color: "#92400E" }}>
                  📋 Outcome
                </button>
                <button onClick={() => {
                    const phone = appt.clientWhatsapp.replace(/\D/g, "");
                    const d = new Date(appt.scheduledAt);
                    const time = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" });
                    const date = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "America/New_York" });
                    const url = window.location.origin + "/book/confirm/" + (appt.confirmToken || appt.id);
                    const msg = "Hola " + appt.clientName + ", te recordamos tu reunion con FastForward el " + date + " a las " + time + " (hora Miami).\n\nAccede aqui: " + url + "\n\nEquipo FastForward";
                    window.open("https://wa.me/" + phone + "?text=" + encodeURIComponent(msg), "_blank");
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                  style={{ background: "#25D366", color: "white" }}>
                  💬 WA Recordatorio
                </button>
                {appt.platform !== "whatsapp" && appt.meetingLink && (
                  <a href={appt.meetingLink} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all hover:-translate-y-0.5"
                    style={{ background: "#27295C", color: "white" }}>
                    <Video className="w-3 h-3" /> Iniciar reunion
                  </a>
                )}
                {appt.platform !== "whatsapp" && !appt.meetingLink && (
                  <span title="Conectar Google Calendar en Configuracion para generar el link"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-help"
                    style={{ background: "#F3F4F6", color: "#9CA3AF" }}>
                    Sin link aun
                  </span>
                )}
                {appt.platform === "whatsapp" && (
                  <a href={"https://wa.me/" + appt.clientWhatsapp.replace(/\D/g, "")} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                    style={{ background: "#25D366", color: "white" }}>
                    <Phone className="w-3 h-3" /> Llamar
                  </a>
                )}
                <a href={window.location.origin + "/book/confirm/" + (appt.confirmToken || appt.id)} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border"
                  style={{ borderColor: "#E5E7EB", color: "#6B7280" }}>
                  <ExternalLink className="w-3 h-3" /> Ver cita
                </a>
                <a href={"/dashboard/clients/" + encodeURIComponent(appt.clientEmail)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border"
                  style={{ borderColor: "#E5E7EB", color: "#6B7280" }}>
                  👤 Historial
                </a>
                <button onClick={() => setShowNotes(!showNotes)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border"
                  style={{ borderColor: showNotes ? "#27295C" : "#E5E7EB", color: showNotes ? "#27295C" : "#6B7280" }}>
                  📝 Notas
                </button>
              </div>
              {showNotes && (
                <NotesPanel appointmentId={appt.id} currentUserId={currentUserId} currentRole={currentRole} />
              )}
            </div>
          </div>
        )}
      </div>
      {showAssign && (
        <AssignModal appointment={appt} onClose={() => setShowAssign(false)}
          onAssigned={() => { setShowAssign(false); onRefresh(); }} />
      )}
      {proposalAppt && (
        <ProposalModal
          appointmentId={proposalAppt.id}
          clientName={proposalAppt.clientName}
          clientCompany={proposalAppt.clientCompany}
          repSlug={proposalAppt.repSlug}
          onClose={() => setProposalAppt(null)}
          onSuccess={() => { setProposalAppt(null); onRefresh(); }}
        />
      )}
      {showOutcome && (
        <OutcomeModal appointment={appt} onClose={() => setShowOutcome(false)}
          onSaved={() => { setShowOutcome(false); onRefresh(); }} />
      )}
    </>
  );
}

export function DashboardShell({ user, roleLabel, appointments, loading, onRefresh, canAssign }: {
  user: { id?: string; fullName: string; email: string; role: string; slug?: string; timezone?: string };
  roleLabel: string; appointments: Appt[]; loading: boolean; onRefresh: () => void; canAssign: boolean;
}) {
  const [tab, setTab] = useState<"today" | "unassigned" | "upcoming" | "all">("today");
  const now = new Date();
  const today = appointments.filter(a => new Date(a.scheduledAt).toDateString() === now.toDateString()).sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const unassigned = appointments.filter(a => !a.assignedTo);
  const upcoming = appointments.filter(a => new Date(a.scheduledAt) > now).sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const tabs = [
    { key: "today",      label: "Hoy",        count: today.length,        red: false },
    { key: "unassigned", label: "Sin asignar", count: unassigned.length,   red: unassigned.length > 0 },
    { key: "upcoming",   label: "Proximas",    count: upcoming.length,     red: false },
    { key: "all",        label: "Todas",       count: appointments.length, red: false },
  ].filter(t => !(t.key === "unassigned" && !canAssign));

  const tabData = tab === "today" ? today : tab === "unassigned" ? unassigned : tab === "upcoming" ? upcoming : appointments;

  const grouped: Record<string, Appt[]> = {};
  if (tab === "today") {
    grouped["Hoy"] = tabData;
  } else {
    tabData.forEach(a => {
      const d = new Date(a.scheduledAt);
      const key = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/New_York" });
      const cap = key.charAt(0).toUpperCase() + key.slice(1);
      if (!grouped[cap]) grouped[cap] = [];
      grouped[cap].push(a);
    });
  }

  return (
    <div className="flex min-h-screen" style={{ background: "#F8F9FB" }}>
      <Sidebar user={user} />
      <main className="flex-1 lg:ml-0 pt-14 lg:pt-0 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#9CA3AF" }}>{roleLabel} · {(user.timezone || "America/New_York").replace(/_/g, " ")}</p>
              <h1 className="text-2xl font-bold" style={{ color: "#27295C" }}>Hola, {user.fullName.split(" ")[0]} 👋</h1>
            </div>
            <div className="flex gap-2">
              {user.slug && (
                <a href={"/book/" + user.slug} target="_blank"
                  className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border-2"
                  style={{ borderColor: "#27295C", color: "#27295C" }}>Mi link</a>
              )}
              <button onClick={onRefresh}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: "#E5E7EB", color: "#6B7280", background: "white" }}>
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex gap-0 border-b mb-0" style={{ borderColor: "#E5E7EB" }}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
                className="relative flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all border-b-2 -mb-px"
                style={{ borderBottomColor: tab === t.key ? "#27295C" : "transparent", color: tab === t.key ? "#27295C" : "#9CA3AF" }}>
                {t.label}
                {t.count > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-xs font-bold"
                        style={{ background: t.red ? "#EF4444" : tab === t.key ? "#27295C" : "#E5E7EB", color: t.red || tab === t.key ? "white" : "#6B7280" }}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="rounded-b-2xl overflow-hidden"
               style={{ background: "white", border: "1px solid #E5E7EB", borderTop: "none" }}>
            {loading ? (
              [1,2,3,4,5].map(i => (
                <div key={i} className="flex items-center gap-4 px-5 py-4 border-b" style={{ borderColor: "#F0F0F0" }}>
                  <div className="w-12 h-4 rounded animate-pulse" style={{ background: "#E5E7EB" }} />
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#E5E7EB" }} />
                  <div className="flex-1">
                    <div className="w-40 h-4 rounded animate-pulse mb-1.5" style={{ background: "#E5E7EB" }} />
                    <div className="w-24 h-3 rounded animate-pulse" style={{ background: "#F3F4F6" }} />
                  </div>
                </div>
              ))
            ) : tabData.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-3xl mb-3">{tab === "today" ? "☀️" : tab === "unassigned" ? "✅" : "📭"}</p>
                <p className="font-semibold text-sm" style={{ color: "#27295C" }}>
                  {tab === "today" ? "Sin citas para hoy" : tab === "unassigned" ? "Todo asignado" : "Sin citas aqui"}
                </p>
              </div>
            ) : (
              Object.entries(grouped).map(([dateLabel, appts]) => (
                <div key={dateLabel}>
                  {tab !== "today" && (
                    <div className="px-5 py-2 border-b" style={{ background: "#F8F9FB", borderColor: "#F0F0F0" }}>
                      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#6B7280" }}>{dateLabel}</p>
                    </div>
                  )}
                  {appts.map(appt => (
                    <AppointmentRow key={appt.id} appt={appt} canAssign={canAssign}
                      currentUserId={user.id || ""} currentRole={user.role} onRefresh={onRefresh}
                      userTimezone={user.timezone || "America/New_York"} />
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
