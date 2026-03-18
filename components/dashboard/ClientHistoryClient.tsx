"use client";

import { useEffect, useState, useCallback } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { OutcomeModal } from "@/components/dashboard/OutcomeModal";
import { NotesPanel } from "@/components/dashboard/NotesPanel";
import { ArrowLeft, Video, MessageCircle, Phone, ChevronDown, ChevronUp, Star } from "lucide-react";
import Link from "next/link";

interface Appt {
  id: string; clientName: string; clientCompany: string; clientWhatsapp: string;
  clientTimezone: string; clientLanguage: string; serviceInterest: string | null;
  exportVolume: string | null; platform: string; meetingLink: string | null;
  scheduledAt: string; status: string; outcome: string | null; notes: string | null;
  nextStep: string | null; leadScore: string; noShowCount: number; bookedVia: string;
  confirmToken: string | null; createdAt: string; repName: string | null; repEmail: string | null;
  assignedTo: string | null;
}

interface Survey { id: string; rating: number; feedback: string | null; submittedAt: string; }

interface Profile {
  name: string | null; company: string | null; whatsapp: string | null;
  timezone: string | null; language: string | null; leadScore: string | null;
  noShowCount: number; satisfactionAvg: string | null; isReincident: boolean;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending_assignment: { bg: "#FEF9C3", text: "#854D0E", label: "Sin asignar" },
  scheduled:          { bg: "#DBEAFE", text: "#1E40AF", label: "Agendada" },
  confirmed:          { bg: "#DCFCE7", text: "#166534", label: "Confirmada" },
  completed:          { bg: "#EDE9FE", text: "#4C1D95", label: "Completada" },
  no_show:            { bg: "#FEE2E2", text: "#991B1B", label: "No-show" },
  cancelled:          { bg: "#F3F4F6", text: "#374151", label: "Cancelada" },
};

const OUTCOME_LABELS: Record<string, string> = {
  interested: "Interesado", needs_time: "Necesita tiempo",
  not_qualified: "No califica", proposal_sent: "Propuesta enviada", closed: "Cerrado",
};

const SCORE_ICONS: Record<string, string> = { hot: "🔥", warm: "🟡", cold: "❄️" };

function AppointmentHistoryRow({ appt, currentUserId, currentRole, onRefresh }: {
  appt: Appt; currentUserId: string; currentRole: string; onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showOutcome, setShowOutcome] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const slotDate = new Date(appt.scheduledAt);
  const dateStr = slotDate.toLocaleDateString("es-ES", {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "America/New_York"
  });
  const timeStr = slotDate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" });
  const st = STATUS_STYLES[appt.status] || STATUS_STYLES.scheduled;

  return (
    <>
      <div className="border-b last:border-b-0" style={{ borderColor: "#F0F0F0" }}>
        <div className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-gray-50"
             onClick={() => setExpanded(!expanded)}>
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: st.bg === "#FEE2E2" ? "#EF4444" : st.bg === "#EDE9FE" ? "#8B5CF6" : st.bg === "#DCFCE7" ? "#22C55E" : st.bg === "#DBEAFE" ? "#3B82F6" : "#EAB308" }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold" style={{ color: "#374151" }}>{dateStr} · {timeStr} EST</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: st.bg, color: st.text }}>{st.label}</span>
              {appt.outcome && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#F3F4F6", color: "#374151" }}>
                  {OUTCOME_LABELS[appt.outcome]}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {appt.repName && <span className="text-xs" style={{ color: "#9CA3AF" }}>Con {appt.repName}</span>}
              {appt.serviceInterest && <span className="text-xs" style={{ color: "#9CA3AF" }}>· {appt.serviceInterest.replace(/_/g," ")}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">{SCORE_ICONS[appt.leadScore]}</span>
            {appt.platform === "whatsapp"
              ? <MessageCircle className="w-3.5 h-3.5" style={{ color: "#25D366" }} />
              : <Video className="w-3.5 h-3.5" style={{ color: "#9CA3AF" }} />}
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: "#9CA3AF" }} /> : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "#9CA3AF" }} />}
        </div>

        {expanded && (
          <div className="px-5 pb-4 pt-1" onClick={e => e.stopPropagation()}>
            <div className="ml-6 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Plataforma", value: appt.platform === "meet" ? "Google Meet" : appt.platform === "zoom" ? "Zoom" : "WhatsApp" },
                  { label: "Via", value: appt.bookedVia === "general" ? "Link general" : `/book/${appt.bookedVia}` },
                  { label: "No-shows", value: String(appt.noShowCount) },
                  { label: "Lead score", value: appt.leadScore },
                ].map(item => (
                  <div key={item.label}>
                    <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: "#9CA3AF" }}>{item.label}</p>
                    <p className="text-xs font-medium" style={{ color: "#374151" }}>{item.value}</p>
                  </div>
                ))}
              </div>
              {appt.notes && (
                <div className="p-3 rounded-xl" style={{ background: "#F8F9FB", border: "1px solid #E5E7EB" }}>
                  <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#9CA3AF" }}>Notas del outcome</p>
                  <p className="text-sm" style={{ color: "#374151" }}>{appt.notes}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setShowOutcome(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                  style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)", color: "#92400E" }}>
                  📋 Outcome
                </button>
                {appt.platform === "whatsapp" && (
                  <a href={"https://wa.me/" + appt.clientWhatsapp.replace(/\D/g,"")} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                    style={{ background: "#25D366", color: "white" }}>
                    <Phone className="w-3 h-3" /> WhatsApp
                  </a>
                )}
                {appt.confirmToken && (
                  <a href={"/book/confirm/" + appt.confirmToken} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border"
                    style={{ borderColor: "#E5E7EB", color: "#6B7280" }}>
                    Ver cita
                  </a>
                )}
                <button onClick={() => setShowNotes(!showNotes)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border"
                  style={{ borderColor: showNotes ? "#27295C" : "#E5E7EB", color: showNotes ? "#27295C" : "#6B7280" }}>
                  📝 Notas
                </button>
              </div>
              {showNotes && <NotesPanel appointmentId={appt.id} currentUserId={currentUserId} currentRole={currentRole} />}
            </div>
          </div>
        )}
      </div>
      {showOutcome && (
        <OutcomeModal appointment={appt} onClose={() => setShowOutcome(false)} onSaved={() => { setShowOutcome(false); onRefresh(); }} />
      )}
    </>
  );
}

export default function ClientHistoryClient({ user, clientEmail }: {
  user: { id?: string; fullName: string; email: string; role: string; slug?: string };
  clientEmail: string;
}) {
  const [data, setData] = useState<{ profile: Profile | null; appointments: Appt[]; surveys: Survey[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/clients?email=${encodeURIComponent(clientEmail)}`);
    const d = await res.json();
    setData(d);
    setLoading(false);
  }, [clientEmail]);

  useEffect(() => { load(); }, [load]);

  const completed = data?.appointments.filter(a => a.status === "completed").length || 0;
  const noShows = data?.appointments.filter(a => a.status === "no_show").length || 0;
  const avgRating = data?.surveys.length
    ? (data.surveys.reduce((s, sv) => s + sv.rating, 0) / data.surveys.length).toFixed(1)
    : null;

  return (
    <div className="flex min-h-screen" style={{ background: "#F8F9FB" }}>
      <Sidebar user={user} />
      <main className="flex-1 lg:ml-0 pt-14 lg:pt-0 overflow-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

          {/* Back */}
          <Link href="/dashboard" className="flex items-center gap-2 text-sm mb-6 transition-colors"
                style={{ color: "#9CA3AF" }}>
            <ArrowLeft className="w-4 h-4" /> Volver al dashboard
          </Link>

          {loading ? (
            <div className="space-y-4">
              {[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "#E5E7EB" }} />)}
            </div>
          ) : !data ? (
            <p style={{ color: "#9CA3AF" }}>Cliente no encontrado.</p>
          ) : (
            <div className="space-y-6">

              {/* Profile header */}
              <div className="rounded-2xl p-6 bg-white border" style={{ borderColor: "#E5E7EB" }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
                         style={{ background: "#27295C" }}>
                      {(data.profile?.name || clientEmail)[0].toUpperCase()}
                    </div>
                    <div>
                      <h1 className="text-xl font-bold" style={{ color: "#27295C" }}>
                        {data.profile?.name || clientEmail}
                      </h1>
                      {data.profile?.company && (
                        <p className="text-sm font-medium" style={{ color: "#6B7280" }}>{data.profile.company}</p>
                      )}
                      <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{clientEmail}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {data.profile?.leadScore && (
                      <span className="text-lg">{SCORE_ICONS[data.profile.leadScore]}</span>
                    )}
                    {data.profile?.isReincident && (
                      <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                            style={{ background: "#FEE2E2", color: "#991B1B" }}>
                        Reincidente
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t" style={{ borderColor: "#F0F0F0" }}>
                  {[
                    { label: "Total citas", value: data.appointments.length },
                    { label: "Completadas", value: completed },
                    { label: "No-shows", value: noShows },
                    { label: "Satisfaccion", value: avgRating ? `${avgRating}/5 ⭐` : "—" },
                  ].map(s => (
                    <div key={s.label} className="text-center p-3 rounded-xl" style={{ background: "#F8F9FB" }}>
                      <p className="text-xl font-bold" style={{ color: "#27295C" }}>{s.value}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Contact info */}
                {(data.profile?.whatsapp || data.profile?.timezone) && (
                  <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t" style={{ borderColor: "#F0F0F0" }}>
                    {data.profile.whatsapp && (
                      <div>
                        <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: "#9CA3AF" }}>WhatsApp</p>
                        <a href={"https://wa.me/" + data.profile.whatsapp.replace(/\D/g,"")} target="_blank" rel="noreferrer"
                           className="text-sm font-medium" style={{ color: "#25D366" }}>
                          {data.profile.whatsapp}
                        </a>
                      </div>
                    )}
                    {data.profile.timezone && (
                      <div>
                        <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: "#9CA3AF" }}>Timezone</p>
                        <p className="text-sm font-medium" style={{ color: "#374151" }}>{data.profile.timezone}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Surveys */}
              {data.surveys.length > 0 && (
                <div className="rounded-2xl bg-white border overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
                  <div className="px-5 py-3.5 border-b" style={{ borderColor: "#F0F0F0", background: "#F8F9FB" }}>
                    <h2 className="text-sm font-semibold" style={{ color: "#27295C" }}>Encuestas de satisfaccion</h2>
                  </div>
                  <div className="divide-y" style={{ borderColor: "#F0F0F0" }}>
                    {data.surveys.map(sv => (
                      <div key={sv.id} className="px-5 py-4 flex items-start gap-4">
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} className="w-4 h-4" style={{ color: sv.rating >= s ? "#F59E0B" : "#E5E7EB", fill: sv.rating >= s ? "#F59E0B" : "#E5E7EB" }} />
                          ))}
                        </div>
                        <div className="flex-1">
                          {sv.feedback && <p className="text-sm" style={{ color: "#374151" }}>{sv.feedback}</p>}
                          <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>
                            {new Date(sv.submittedAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Appointment history */}
              <div className="rounded-2xl bg-white border overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
                <div className="px-5 py-3.5 border-b" style={{ borderColor: "#F0F0F0", background: "#F8F9FB" }}>
                  <h2 className="text-sm font-semibold" style={{ color: "#27295C" }}>
                    Historial de citas ({data.appointments.length})
                  </h2>
                </div>
                {data.appointments.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-sm" style={{ color: "#9CA3AF" }}>Sin citas registradas</p>
                  </div>
                ) : (
                  data.appointments.map(appt => (
                    <AppointmentHistoryRow
                      key={appt.id} appt={appt}
                      currentUserId={user.id || ""} currentRole={user.role}
                      onRefresh={load}
                    />
                  ))
                )}
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  );
}
