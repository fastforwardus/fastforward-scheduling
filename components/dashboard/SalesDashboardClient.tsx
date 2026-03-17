"use client";

import { useEffect, useState, useCallback } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { AppointmentCard } from "@/components/dashboard/AppointmentCard";
import { Calendar, TrendingUp, CheckCircle, RefreshCw } from "lucide-react";

interface Appt {
  id: string; clientName: string; clientEmail: string; clientCompany: string;
  clientWhatsapp: string; platform: string; scheduledAt: string; status: string;
  outcome: string | null; leadScore: string; serviceInterest: string | null;
  repName: string | null; repSlug: string | null; assignedTo: string | null;
}

export default function SalesDashboardClient({ user }: { user: { fullName: string; email: string; role: string; slug?: string } }) {
  const [appointments, setAppointments] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"today" | "upcoming" | "all">("today");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/appointments/list?filter=mine");
    const data = await res.json();
    setAppointments(data.appointments || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = appointments.filter(a => new Date(a.scheduledAt).toDateString() === new Date().toDateString());
  const upcoming = appointments.filter(a => new Date(a.scheduledAt) > new Date());
  const completed = appointments.filter(a => a.status === "completed");
  const tabData = tab === "today" ? today : tab === "upcoming" ? upcoming : appointments;

  return (
    <div className="flex min-h-screen" style={{ background: "#F8F9FB" }}>
      <Sidebar user={user} />
      <main className="flex-1 lg:ml-0 pt-14 lg:pt-0 overflow-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#9CA3AF" }}>Sales Rep</p>
              <h1 className="text-2xl font-bold" style={{ color: "#27295C" }}>Hola, {user.fullName.split(" ")[0]} 👋</h1>
            </div>
            <div className="flex gap-2">
              {user.slug && (
                <a href={`/book/${user.slug}`} target="_blank"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all"
                  style={{ borderColor: "#27295C", color: "#27295C" }}>
                  Mi link
                </a>
              )}
              <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium"
                style={{ borderColor: "#E5E7EB", color: "#6B7280", background: "white" }}>
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: "Hoy", value: today.length, icon: Calendar, color: "#27295C" },
              { label: "Proximas", value: upcoming.length, icon: TrendingUp, color: "#3b82f6" },
              { label: "Completadas", value: completed.length, icon: CheckCircle, color: "#22c55e" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl p-5 border"
                style={{ background: "white", borderColor: "#E5E7EB", boxShadow: "0 2px 8px rgba(39,41,92,0.04)" }}>
                <s.icon className="w-4 h-4 mb-3" style={{ color: s.color }} />
                <p className="text-2xl font-bold" style={{ color: "#27295C" }}>{s.value}</p>
                <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{s.label}</p>
              </div>
            ))}
          </div>

          {user.slug && (
            <div className="rounded-xl p-4 mb-6 flex items-center justify-between"
                 style={{ background: "rgba(39,41,92,0.04)", border: "1px solid rgba(39,41,92,0.08)" }}>
              <div>
                <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: "#9CA3AF" }}>Tu link personal</p>
                <p className="text-sm font-semibold truncate" style={{ color: "#27295C" }}>
                  fastforward-scheduling.vercel.app/book/{user.slug}
                </p>
              </div>
              <button onClick={() => navigator.clipboard.writeText(`https://fastforward-scheduling.vercel.app/book/${user.slug}`)}
                className="flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold border-2 ml-3"
                style={{ borderColor: "#27295C", color: "#27295C" }}>
                Copiar
              </button>
            </div>
          )}

          <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit" style={{ background: "rgba(39,41,92,0.06)" }}>
            {[
              { key: "today",    label: `Hoy (${today.length})` },
              { key: "upcoming", label: `Proximas (${upcoming.length})` },
              { key: "all",      label: `Todas (${appointments.length})` },
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

          {loading ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {[1,2,3].map(i => <div key={i} className="h-48 rounded-2xl animate-pulse" style={{ background: "#E5E7EB" }} />)}
            </div>
          ) : tabData.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">📭</p>
              <p className="font-semibold" style={{ color: "#27295C" }}>Sin citas aqui</p>
              <p className="text-sm mt-1" style={{ color: "#9CA3AF" }}>Compartí tu link para recibir citas</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {tabData.map(appt => (
                <AppointmentCard key={appt.id} appt={appt} canAssign={false} onRefresh={load} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
