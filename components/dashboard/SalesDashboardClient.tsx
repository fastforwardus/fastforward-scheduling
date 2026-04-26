"use client";
import type { Appt } from "@/types/appointments";
import { useEffect, useState, useCallback } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Calendar, CheckCircle, TrendingUp, FileText, Clock, ChevronRight, Send, DollarSign } from "lucide-react";
import Link from "next/link";

interface Stats {
  total: number;
  completed: number;
  noShow: number;
  proposalsSent: number;
  closed: number;
  todayCount: number;
}

interface MyProposal {
  id: string; proposal_num: string; total: number; discount: number;
  status: string; created_at: string; accepted_at: string | null;
  invoice_sent_at: string | null; payment_confirmed_at: string | null;
  client_name: string; client_company: string; client_email: string;
  zoho_invoice_id: string | null; confirm_token: string; rep_name: string | null;
}

function StatusBadge({ status, invoiceSent, paymentConfirmed }: { status: string; invoiceSent: boolean; paymentConfirmed: boolean }) {
  if (paymentConfirmed) return <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "#DCFCE7", color: "#166534" }}>💰 Pagada</span>;
  if (status === "accepted" && invoiceSent) return <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "#DBEAFE", color: "#1E40AF" }}>📧 Factura enviada</span>;
  if (status === "accepted") return <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "#FEF9C3", color: "#854D0E" }}>✅ Aceptada</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "#F3F4F6", color: "#6B7280" }}>⏳ Pendiente</span>;
}

function StatCard({ icon: Icon, label, value, color, bg }: { icon: React.ElementType; label: string; value: number; color: string; bg: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 border flex items-center gap-4" style={{ borderColor: "#E5E7EB", boxShadow: "0 1px 4px rgba(39,41,92,0.06)" }}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-bold" style={{ color: "#27295C" }}>{value}</p>
        <p className="text-xs font-medium" style={{ color: "#9CA3AF" }}>{label}</p>
      </div>
    </div>
  );
}

export default function SalesDashboardClient({ user }: {
  user: { id?: string; fullName: string; email: string; role: string; slug?: string };
}) {
  const [appointments, setAppointments] = useState<Appt[]>([]);
  const [myProposals, setMyProposals] = useState<MyProposal[]>([]);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"home" | "all">("home");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/appointments/list?filter=mine");
    const data = await res.json();
    setAppointments(data.appointments || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const todayStr = now.toDateString();

  const todayAppts = appointments.filter(a => new Date(a.scheduledAt).toDateString() === todayStr);
  const upcoming = appointments.filter(a => new Date(a.scheduledAt) > now && a.status !== "cancelled").slice(0, 5);

  const stats: Stats = {
    total: appointments.length,
    completed: appointments.filter(a => a.outcome === "completed" || a.status === "completed").length,
    noShow: appointments.filter(a => a.status === "no_show").length,
    proposalsSent: appointments.filter(a => a.outcome === "proposal_sent").length,
    closed: appointments.filter(a => a.outcome === "closed").length,
    todayCount: todayAppts.length,
  };

  const firstName = user.fullName.split(" ")[0];
  const hour = now.getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches";

  if (view === "all") return (
    <DashboardShell
      user={user}
      roleLabel="Sales Rep"
      appointments={appointments}
      loading={loading}
      onRefresh={load}
      canAssign={false}

    />
  );

  return (
    <div className="min-h-screen" style={{ background: "#F8F9FB" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #27295C 0%, #1e2150 100%)" }}>
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: "rgba(201,168,76,0.9)" }}>{greeting} 👋</p>
              <h1 className="text-3xl font-bold text-white mb-1">{firstName}</h1>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>FastForward FDA Experts · Sales Rep</p>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.1)" }}>
                <Calendar className="w-4 h-4" style={{ color: "#C9A84C" }} />
                <span className="text-sm font-semibold text-white">{stats.todayCount} {stats.todayCount === 1 ? "cita hoy" : "citas hoy"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Calendar} label="Total citas" value={stats.total} color="#27295C" bg="rgba(39,41,92,0.08)" />
          <StatCard icon={CheckCircle} label="Completadas" value={stats.completed} color="#166534" bg="#DCFCE7" />
          <StatCard icon={FileText} label="Propuestas" value={stats.proposalsSent} color="#92400E" bg="rgba(201,168,76,0.12)" />
          <StatCard icon={TrendingUp} label="Cerradas" value={stats.closed} color="#C9A84C" bg="rgba(201,168,76,0.1)" />
        </div>

        {/* Today */}
        <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E5E7EB", boxShadow: "0 1px 4px rgba(39,41,92,0.06)" }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "#F0F0F0" }}>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" style={{ color: "#27295C" }} />
              <p className="font-semibold text-sm" style={{ color: "#27295C" }}>Mis citas de hoy</p>
              {stats.todayCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "#27295C", color: "white" }}>{stats.todayCount}</span>
              )}
            </div>
            <button onClick={() => setView("all")} className="flex items-center gap-1 text-xs font-medium" style={{ color: "#C9A84C" }}>
              Ver todas <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {loading ? (
            <div className="text-center py-10">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: "#C9A84C", borderTopColor: "transparent" }} />
            </div>
          ) : todayAppts.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-3xl mb-2">🎉</p>
              <p className="text-sm font-medium" style={{ color: "#27295C" }}>Sin citas hoy</p>
              <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>Disfruta el día</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "#F8F9FB" }}>
              {todayAppts.map(appt => {
                const time = new Date(appt.scheduledAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" });
                const minsLeft = Math.round((new Date(appt.scheduledAt).getTime() - now.getTime()) / 60000);
                const isNow = minsLeft >= -30 && minsLeft <= 0;
                const isSoon = minsLeft > 0 && minsLeft <= 30;
                return (
                  <div key={appt.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="text-center flex-shrink-0 w-14">
                      <p className="text-lg font-bold" style={{ color: "#27295C" }}>{time}</p>
                      {isNow && <span className="text-xs font-bold" style={{ color: "#EF4444" }}>AHORA</span>}
                      {isSoon && <span className="text-xs font-bold" style={{ color: "#C9A84C" }}>en {minsLeft}m</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: "#27295C" }}>{appt.clientName}</p>
                      <p className="text-xs truncate" style={{ color: "#9CA3AF" }}>{appt.clientCompany} · {appt.platform === "meet" ? "Google Meet" : "WhatsApp"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {appt.meetingLink && (
                        <a href={appt.meetingLink} target="_blank" rel="noreferrer"
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                          style={{ background: "#27295C", color: "white" }}>
                          Unirse
                        </a>
                      )}
                      <span className="text-xs px-2 py-1 rounded-full" style={{ background: "#F3F4F6", color: "#6B7280" }}>
                        {appt.outcome ? appt.outcome.replace(/_/g, " ") : appt.status.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E5E7EB", boxShadow: "0 1px 4px rgba(39,41,92,0.06)" }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: "#F0F0F0" }}>
              <p className="font-semibold text-sm" style={{ color: "#27295C" }}>Próximas citas</p>
            </div>
            <div className="divide-y" style={{ borderColor: "#F8F9FB" }}>
              {upcoming.map(appt => {
                const d = new Date(appt.scheduledAt);
                const date = d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: "America/New_York" });
                const time = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" });
                return (
                  <div key={appt.id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="flex-shrink-0 text-center w-20">
                      <p className="text-xs font-semibold capitalize" style={{ color: "#27295C" }}>{date}</p>
                      <p className="text-xs" style={{ color: "#9CA3AF" }}>{time}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate" style={{ color: "#27295C" }}>{appt.clientName}</p>
                      <p className="text-xs truncate" style={{ color: "#9CA3AF" }}>{appt.clientCompany}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Mis Propuestas */}
        <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
          <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: "#F0F0F0", background: "#F8F9FB" }}>
            <p className="text-sm font-semibold" style={{ color: "#27295C" }}>Mis propuestas ({myProposals.length})</p>
            <Send className="w-4 h-4" style={{ color: "#C9A84C" }} />
          </div>
          {loadingProposals ? (
            <div className="text-center py-8"><Clock className="w-5 h-5 animate-spin mx-auto" style={{ color: "#C9A84C" }} /></div>
          ) : myProposals.length === 0 ? (
            <div className="text-center py-8"><p className="text-sm" style={{ color: "#9CA3AF" }}>No hay propuestas enviadas</p></div>
          ) : (
            <div className="divide-y" style={{ borderColor: "#F9FAFB" }}>
              {myProposals.slice(0, 10).map(prop => (
                <div key={prop.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="text-sm font-semibold truncate" style={{ color: "#27295C" }}>{prop.client_name || prop.client_email}</p>
                      <StatusBadge status={prop.status} invoiceSent={!!prop.invoice_sent_at} paymentConfirmed={!!prop.payment_confirmed_at} />
                    </div>
                    <p className="text-xs" style={{ color: "#9CA3AF" }}>
                      {prop.proposal_num} · USD ${Number(prop.total).toLocaleString("en-US")}
                      {prop.client_company ? ` · ${prop.client_company}` : ""}
                    </p>
                  </div>
                  <p className="text-xs shrink-0" style={{ color: "#D1D5DB" }}>
                    {new Date(prop.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/dashboard/propuesta"
            className="bg-white rounded-2xl p-5 border flex items-center gap-3 hover:shadow-md transition-all"
            style={{ borderColor: "#E5E7EB" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(201,168,76,0.1)" }}>
              <FileText className="w-5 h-5" style={{ color: "#C9A84C" }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "#27295C" }}>Enviar propuesta</p>
              <p className="text-xs" style={{ color: "#9CA3AF" }}>Sin cita previa</p>
            </div>
          </Link>
          <button onClick={() => setView("all")}
            className="bg-white rounded-2xl p-5 border flex items-center gap-3 hover:shadow-md transition-all"
            style={{ borderColor: "#E5E7EB" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(39,41,92,0.08)" }}>
              <Calendar className="w-5 h-5" style={{ color: "#27295C" }} />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold" style={{ color: "#27295C" }}>Todas mis citas</p>
              <p className="text-xs" style={{ color: "#9CA3AF" }}>{stats.total} en total</p>
            </div>
          </button>
        </div>

      </div>
    </div>
  );
}
