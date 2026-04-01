"use client";
import type { Appt } from "@/types/appointments";
import { useEffect, useState, useCallback } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Calendar, CheckCircle, TrendingUp, FileText, Users, AlertCircle, ChevronRight } from "lucide-react";
import Link from "next/link";

function StatCard({ icon: Icon, label, value, color, bg, sub }: { icon: React.ElementType; label: string; value: number; color: string; bg: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 border flex items-center gap-4" style={{ borderColor: "#E5E7EB", boxShadow: "0 1px 4px rgba(39,41,92,0.06)" }}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-bold" style={{ color: "#27295C" }}>{value}</p>
        <p className="text-xs font-medium" style={{ color: "#9CA3AF" }}>{label}</p>
        {sub && <p className="text-xs font-semibold mt-0.5" style={{ color }}>{sub}</p>}
      </div>
    </div>
  );
}

const REPS = ["Daiana Guastella", "Francisco Logarzo", "Emiliano Caracciolo", "Mauricio Lobaton"];

export default function ManagerDashboardClient({ user }: {
  user: { id?: string; fullName: string; email: string; role: string; slug?: string };
}) {
  const [appointments, setAppointments] = useState<Appt[]>([]);
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
  const unassigned = appointments.filter(a => a.status === "pending_assignment");
  const pendingOutcome = appointments.filter(a => {
    const minsAgo = (now.getTime() - new Date(a.scheduledAt).getTime()) / 60000;
    return minsAgo > 15 && minsAgo < 180 && !a.outcome && a.status !== "no_show" && a.status !== "cancelled";
  });

  const stats = {
    total: appointments.length,
    today: todayAppts.length,
    unassigned: unassigned.length,
    completed: appointments.filter(a => a.outcome === "completed" || a.status === "completed").length,
    proposals: appointments.filter(a => a.outcome === "proposal_sent").length,
    closed: appointments.filter(a => a.outcome === "closed").length,
  };

  // Per-rep stats
  const repStats = REPS.map(name => {
    const repAppts = appointments.filter(a => a.repName === name);
    return {
      name: name.split(" ")[0],
      fullName: name,
      total: repAppts.length,
      today: repAppts.filter(a => new Date(a.scheduledAt).toDateString() === todayStr).length,
      closed: repAppts.filter(a => a.outcome === "closed").length,
      proposals: repAppts.filter(a => a.outcome === "proposal_sent").length,
    };
  }).filter(r => r.total > 0);

  const firstName = user.fullName.split(" ")[0];
  const hour = now.getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches";

  if (view === "all") return (
    <DashboardShell
      user={user}
      roleLabel="Sales Manager"
      appointments={appointments}
      loading={loading}
      onRefresh={load}
      canAssign={true}
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
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>FastForward FDA Experts · Sales Manager</p>
            </div>
            <div className="flex flex-col gap-2 items-end">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.1)" }}>
                <Calendar className="w-4 h-4" style={{ color: "#C9A84C" }} />
                <span className="text-sm font-semibold text-white">{stats.today} citas hoy</span>
              </div>
              {stats.unassigned > 0 && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: "rgba(239,68,68,0.2)" }}>
                  <AlertCircle className="w-4 h-4" style={{ color: "#FCA5A5" }} />
                  <span className="text-sm font-semibold" style={{ color: "#FCA5A5" }}>{stats.unassigned} sin asignar</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Calendar} label="Total citas" value={stats.total} color="#27295C" bg="rgba(39,41,92,0.08)" />
          <StatCard icon={CheckCircle} label="Completadas" value={stats.completed} color="#166534" bg="#DCFCE7" />
          <StatCard icon={FileText} label="Propuestas enviadas" value={stats.proposals} color="#92400E" bg="rgba(201,168,76,0.12)" />
          <StatCard icon={TrendingUp} label="Cerradas" value={stats.closed} color="#C9A84C" bg="rgba(201,168,76,0.1)" sub={stats.total > 0 ? `${Math.round(stats.closed / stats.total * 100)}% conv.` : undefined} />
        </div>

        {/* Unassigned alert */}
        {stats.unassigned > 0 && (
          <button onClick={() => setView("all")}
            className="w-full flex items-center justify-between px-5 py-4 rounded-2xl border"
            style={{ background: "#FEF2F2", borderColor: "#FECACA" }}>
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5" style={{ color: "#EF4444" }} />
              <div className="text-left">
                <p className="text-sm font-semibold" style={{ color: "#DC2626" }}>{stats.unassigned} {stats.unassigned === 1 ? "cita sin asignar" : "citas sin asignar"}</p>
                <p className="text-xs" style={{ color: "#EF4444" }}>Asignalas ahora para que el cliente reciba su Meet</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4" style={{ color: "#EF4444" }} />
          </button>
        )}

        {/* Pending outcome alert */}
        {pendingOutcome.length > 0 && (
          <button onClick={() => setView("all")}
            className="w-full flex items-center justify-between px-5 py-4 rounded-2xl border"
            style={{ background: "#FFF7ED", borderColor: "#FED7AA" }}>
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5" style={{ color: "#F97316" }} />
              <div className="text-left">
                <p className="text-sm font-semibold" style={{ color: "#C2410C" }}>{pendingOutcome.length} {pendingOutcome.length === 1 ? "cita sin outcome" : "citas sin outcome"}</p>
                <p className="text-xs" style={{ color: "#F97316" }}>Reps que aun no marcaron el resultado</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4" style={{ color: "#F97316" }} />
          </button>
        )}

        {/* Today */}
        <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E5E7EB", boxShadow: "0 1px 4px rgba(39,41,92,0.06)" }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "#F0F0F0" }}>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" style={{ color: "#27295C" }} />
              <p className="font-semibold text-sm" style={{ color: "#27295C" }}>Citas de hoy</p>
              {stats.today > 0 && <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "#27295C", color: "white" }}>{stats.today}</span>}
            </div>
            <button onClick={() => setView("all")} className="flex items-center gap-1 text-xs font-medium" style={{ color: "#C9A84C" }}>
              Ver todas <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {loading ? (
            <div className="text-center py-10">
              <div className="w-6 h-6 border-2 rounded-full animate-spin mx-auto" style={{ borderColor: "#C9A84C", borderTopColor: "transparent" }} />
            </div>
          ) : todayAppts.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-2xl mb-2">📅</p>
              <p className="text-sm font-medium" style={{ color: "#27295C" }}>Sin citas hoy</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "#F8F9FB" }}>
              {todayAppts.slice(0, 6).map(appt => {
                const time = new Date(appt.scheduledAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" });
                return (
                  <div key={appt.id} className="flex items-center gap-4 px-5 py-3.5">
                    <p className="text-sm font-bold w-12 flex-shrink-0" style={{ color: "#27295C" }}>{time}</p>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate" style={{ color: "#27295C" }}>{appt.clientName}</p>
                      <p className="text-xs truncate" style={{ color: "#9CA3AF" }}>{appt.clientCompany}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {appt.repName && <span className="text-xs px-2 py-1 rounded-full" style={{ background: "#EEF2FF", color: "#27295C" }}>{appt.repName.split(" ")[0]}</span>}
                      <span className="text-xs px-2 py-1 rounded-full" style={{ background: "#F3F4F6", color: "#6B7280" }}>
                        {appt.status === "pending_assignment" ? "Sin asignar" : appt.outcome ? appt.outcome.replace(/_/g, " ") : appt.status.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rep performance */}
        {repStats.length > 0 && (
          <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E5E7EB", boxShadow: "0 1px 4px rgba(39,41,92,0.06)" }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: "#F0F0F0" }}>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" style={{ color: "#27295C" }} />
                <p className="font-semibold text-sm" style={{ color: "#27295C" }}>Performance del equipo</p>
              </div>
            </div>
            <div className="divide-y" style={{ borderColor: "#F8F9FB" }}>
              {repStats.sort((a,b) => b.closed - a.closed).map((rep, i) => (
                <div key={rep.name} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                    style={{ background: i === 0 ? "#C9A84C" : "rgba(39,41,92,0.08)", color: i === 0 ? "white" : "#27295C" }}>
                    {rep.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "#27295C" }}>{rep.name}</p>
                    <p className="text-xs" style={{ color: "#9CA3AF" }}>{rep.total} citas · {rep.today} hoy</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <p className="text-sm font-bold" style={{ color: "#C9A84C" }}>{rep.closed}</p>
                      <p className="text-xs" style={{ color: "#9CA3AF" }}>cierres</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold" style={{ color: "#27295C" }}>{rep.proposals}</p>
                      <p className="text-xs" style={{ color: "#9CA3AF" }}>propuestas</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
              <p className="text-sm font-semibold" style={{ color: "#27295C" }}>Todas las citas</p>
              <p className="text-xs" style={{ color: "#9CA3AF" }}>{stats.total} en total</p>
            </div>
          </button>
        </div>

      </div>
    </div>
  );
}
