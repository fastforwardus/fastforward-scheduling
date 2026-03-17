"use client";

import { useEffect, useState, useCallback } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { AppointmentCard } from "@/components/dashboard/AppointmentCard";
import { AlertCircle, Calendar, Users, TrendingUp, RefreshCw } from "lucide-react";

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

export default function ManagerDashboardClient({ user, defaultTab }: { user: { id?: string; fullName: string; email: string; role: string; slug?: string }; defaultTab?: string }) {
  const [appointments, setAppointments] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"unassigned" | "all" | "today">((defaultTab as "unassigned" | "all" | "today") || "unassigned");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/appointments/list");
    const data = await res.json();
    setAppointments(data.appointments || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const unassigned = appointments.filter(a => !a.assignedTo);
  const today = appointments.filter(a => {
    const d = new Date(a.scheduledAt);
    return d.toDateString() === new Date().toDateString();
  });
  const upcoming = appointments.filter(a => new Date(a.scheduledAt) > new Date());

  const stats = [
    { label: "Sin asignar", value: unassigned.length, icon: AlertCircle, color: "#C9A84C", urgent: unassigned.length > 0 },
    { label: "Hoy", value: today.length, icon: Calendar, color: "#27295C", urgent: false },
    { label: "Próximas", value: upcoming.length, icon: TrendingUp, color: "#3b82f6", urgent: false },
    { label: "Total", value: appointments.length, icon: Users, color: "#6b7280", urgent: false },
  ];

  const tabData = tab === "unassigned" ? unassigned : tab === "today" ? today : appointments;

  return (
    <div className="flex min-h-screen" style={{ background: "#F8F9FB" }}>
      <Sidebar user={user} />

      <main className="flex-1 lg:ml-0 pt-14 lg:pt-0 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#9CA3AF" }}>Sales Manager</p>
              <h1 className="text-2xl font-bold" style={{ color: "#27295C" }}>Hola, {user.fullName.split(" ")[0]} 👋</h1>
            </div>
            <button onClick={load}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all hover:-translate-y-0.5"
              style={{ borderColor: "#E5E7EB", color: "#6B7280", background: "white" }}>
              <RefreshCw className="w-3.5 h-3.5" /> Actualizar
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((s) => (
              <div key={s.label}
                className="rounded-2xl p-5 border transition-all"
                style={{
                  background: "white",
                  borderColor: s.urgent ? "rgba(201,168,76,0.4)" : "#E5E7EB",
                  boxShadow: s.urgent ? "0 0 0 1px rgba(201,168,76,0.2), 0 4px 12px rgba(201,168,76,0.1)" : "0 2px 8px rgba(39,41,92,0.04)",
                }}>
                <div className="flex items-center justify-between mb-3">
                  <s.icon className="w-4 h-4" style={{ color: s.color }} />
                  {s.urgent && <span className="w-2 h-2 rounded-full" style={{ background: "#C9A84C" }} />}
                </div>
                <p className="text-2xl font-bold" style={{ color: "#27295C" }}>{s.value}</p>
                <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Alert banner if unassigned */}
          {unassigned.length > 0 && (
            <div className="flex items-center gap-3 px-5 py-4 rounded-xl mb-6"
                 style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.25)" }}>
              <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#C9A84C" }} />
              <p className="text-sm font-medium" style={{ color: "#92400e" }}>
                {unassigned.length === 1
                  ? "Hay 1 cita sin asignar. Asignala ahora."
                  : `Hay ${unassigned.length} citas sin asignar. Asignalas lo antes posible.`}
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

          {/* Appointments */}
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
                <AppointmentCard key={appt.id} appt={appt} canAssign={true} onRefresh={load} currentUserId={user.id ?? ""} currentRole={user.role} />
              ))}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
