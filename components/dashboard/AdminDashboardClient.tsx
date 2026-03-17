"use client";

import { useEffect, useState, useCallback } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { AppointmentCard } from "@/components/dashboard/AppointmentCard";
import { AlertCircle, Calendar, Users, TrendingUp, RefreshCw, BarChart2 } from "lucide-react";

interface Appt {
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

interface Rep {
  id: string;
  fullName: string;
  email: string;
  role: string;
  slug: string | null;
}

export default function AdminDashboardClient({ user }: { user: { fullName: string; email: string; role: string } }) {
  const [appointments, setAppointments] = useState<Appt[]>([]);
  const [reps, setReps] = useState<Rep[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"unassigned" | "all" | "today">("unassigned");

  const load = useCallback(async () => {
    setLoading(true);
    const [apptRes, usersRes] = await Promise.all([
      fetch("/api/appointments/list"),
      fetch("/api/users/list"),
    ]);
    const apptData = await apptRes.json();
    const usersData = await usersRes.json();
    setAppointments(apptData.appointments || []);
    setReps(usersData.users || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const unassigned = appointments.filter(a => !a.assignedTo);
  const today = appointments.filter(a => new Date(a.scheduledAt).toDateString() === new Date().toDateString());
  const upcoming = appointments.filter(a => new Date(a.scheduledAt) > new Date());

  // Stats por rep
  const repStats = reps.map(rep => ({
    ...rep,
    count: appointments.filter(a => a.assignedTo === rep.id).length,
    upcoming: appointments.filter(a => a.assignedTo === rep.id && new Date(a.scheduledAt) > new Date()).length,
  }));

  const tabData = tab === "unassigned" ? unassigned : tab === "today" ? today : appointments;

  return (
    <div className="flex min-h-screen" style={{ background: "#F8F9FB" }}>
      <Sidebar user={user} />

      <main className="flex-1 lg:ml-0 pt-14 lg:pt-0 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#9CA3AF" }}>Admin</p>
              <h1 className="text-2xl font-bold" style={{ color: "#27295C" }}>Hola, {user.fullName.split(" ")[0]} 👋</h1>
            </div>
            <div className="flex gap-2">
              <a href="/book" target="_blank"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5"
                style={{ background: "#C9A84C", color: "#1A1C3E" }}>
                + Nueva cita
              </a>
              <button onClick={load}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all hover:-translate-y-0.5"
                style={{ borderColor: "#E5E7EB", color: "#6B7280", background: "white" }}>
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Sin asignar", value: unassigned.length, icon: AlertCircle, color: "#C9A84C", urgent: unassigned.length > 0 },
              { label: "Hoy", value: today.length, icon: Calendar, color: "#27295C", urgent: false },
              { label: "Próximas", value: upcoming.length, icon: TrendingUp, color: "#3b82f6", urgent: false },
              { label: "Equipo activo", value: reps.length, icon: Users, color: "#6b7280", urgent: false },
            ].map((s) => (
              <div key={s.label}
                className="rounded-2xl p-5 border transition-all"
                style={{
                  background: "white",
                  borderColor: s.urgent ? "rgba(201,168,76,0.4)" : "#E5E7EB",
                  boxShadow: s.urgent ? "0 0 0 1px rgba(201,168,76,0.2), 0 4px 12px rgba(201,168,76,0.1)" : "0 2px 8px rgba(39,41,92,0.04)",
                }}>
                <div className="flex items-center justify-between mb-3">
                  <s.icon className="w-4 h-4" style={{ color: s.color }} />
                  {s.urgent && <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#C9A84C" }} />}
                </div>
                <p className="text-2xl font-bold" style={{ color: "#27295C" }}>{s.value}</p>
                <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Team overview */}
          <div className="rounded-2xl border mb-8 overflow-hidden"
               style={{ background: "white", borderColor: "#E5E7EB" }}>
            <div className="px-6 py-4 border-b flex items-center justify-between"
                 style={{ borderColor: "#E5E7EB" }}>
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4" style={{ color: "#27295C" }} />
                <h2 className="font-semibold text-sm" style={{ color: "#27295C" }}>Equipo</h2>
              </div>
              <a href="/dashboard/team"
                className="text-xs font-medium" style={{ color: "#C9A84C" }}>
                Ver todo →
              </a>
            </div>
            <div className="divide-y" style={{ divideColor: "#F0F0F0" }}>
              {repStats.map(rep => (
                <div key={rep.id} className="flex items-center gap-4 px-6 py-3.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                       style={{ background: "#27295C" }}>
                    {rep.fullName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "#27295C" }}>{rep.fullName}</p>
                    <p className="text-xs" style={{ color: "#9CA3AF" }}>
                      {rep.role === "admin" ? "Admin" : rep.role === "sales_manager" ? "Manager" : "Sales Rep"}
                      {rep.slug && <span className="ml-1">/book/{rep.slug}</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: "#27295C" }}>{rep.upcoming}</p>
                    <p className="text-xs" style={{ color: "#9CA3AF" }}>próximas</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Alert */}
          {unassigned.length > 0 && (
            <div className="flex items-center gap-3 px-5 py-4 rounded-xl mb-6"
                 style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.25)" }}>
              <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#C9A84C" }} />
              <p className="text-sm font-medium" style={{ color: "#92400e" }}>
                {unassigned.length === 1
                  ? "1 cita sin asignar."
                  : `${unassigned.length} citas sin asignar.`}
              </p>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit"
               style={{ background: "rgba(39,41,92,0.06)" }}>
            {[
              { key: "unassigned", label: `Sin asignar (${unassigned.length})` },
              { key: "today",      label: `Hoy (${today.length})` },
              { key: "all",        label: `Todas (${appointments.length})` },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: tab === t.key ? "white" : "transparent",
                  color: tab === t.key ? "#27295C" : "#9CA3AF",
                  boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Appointments grid */}
          {loading ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-48 rounded-2xl animate-pulse" style={{ background: "#E5E7EB" }} />
              ))}
            </div>
          ) : tabData.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">✨</p>
              <p className="font-semibold" style={{ color: "#27295C" }}>Todo al día</p>
              <p className="text-sm mt-1" style={{ color: "#9CA3AF" }}>No hay citas en esta categoría</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {tabData.map(appt => (
                <AppointmentCard key={appt.id} appt={appt} canAssign={true} onRefresh={load} />
              ))}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
