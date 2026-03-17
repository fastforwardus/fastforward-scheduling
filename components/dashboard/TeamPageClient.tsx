"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Users, Calendar, TrendingUp, ExternalLink } from "lucide-react";

interface Rep {
  id: string;
  fullName: string;
  email: string;
  role: string;
  slug: string | null;
}

interface Appt {
  assignedTo: string | null;
  status: string;
  scheduledAt: string;
}

export default function TeamPageClient({ user }: { user: { id: string; fullName: string; email: string; role: string; slug?: string } }) {
  const [reps, setReps] = useState<Rep[]>([]);
  const [appointments, setAppointments] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/users/list").then(r => r.json()),
      fetch("/api/appointments/list").then(r => r.json()),
    ]).then(([usersData, apptData]) => {
      setReps(usersData.users || []);
      setAppointments(apptData.appointments || []);
      setLoading(false);
    });
  }, []);

  const now = new Date();

  const repStats = reps.map(rep => {
    const mine = appointments.filter(a => a.assignedTo === rep.id);
    const upcoming = mine.filter(a => new Date(a.scheduledAt) > now);
    const completed = mine.filter(a => a.status === "completed");
    const noShow = mine.filter(a => a.status === "no_show");
    return { ...rep, total: mine.length, upcoming: upcoming.length, completed: completed.length, noShow: noShow.length };
  });

  const roleLabel = (role: string) =>
    role === "admin" ? "Admin" : role === "sales_manager" ? "Manager" : "Sales Rep";

  const roleColor = (role: string) =>
    role === "admin" ? "#6366F1" : role === "sales_manager" ? "#F97316" : "#22C55E";

  return (
    <div className="flex min-h-screen" style={{ background: "#F8F9FB" }}>
      <Sidebar user={user} />
      <main className="flex-1 lg:ml-0 pt-14 lg:pt-0 overflow-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

          <div className="mb-8">
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#9CA3AF" }}>Dashboard</p>
            <h1 className="text-2xl font-bold" style={{ color: "#27295C" }}>Equipo</h1>
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {[1,2,3,4].map(i => <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: "#E5E7EB" }} />)}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {repStats.map(rep => (
                <div key={rep.id} className="rounded-2xl border p-5 bg-white"
                     style={{ borderColor: "#E5E7EB", boxShadow: "0 2px 8px rgba(39,41,92,0.04)" }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                         style={{ background: "#27295C" }}>
                      {rep.fullName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: "#27295C" }}>{rep.fullName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{ background: `${roleColor(rep.role)}18`, color: roleColor(rep.role) }}>
                          {roleLabel(rep.role)}
                        </span>
                        {rep.slug && (
                          <a href={`/book/${rep.slug}`} target="_blank"
                             className="flex items-center gap-1 text-xs transition-colors"
                             style={{ color: "#9CA3AF" }}>
                            /book/{rep.slug} <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Próximas", value: rep.upcoming, icon: Calendar, color: "#27295C" },
                      { label: "Completadas", value: rep.completed, icon: TrendingUp, color: "#22C55E" },
                      { label: "No-shows", value: rep.noShow, icon: Users, color: "#EF4444" },
                    ].map(s => (
                      <div key={s.label} className="text-center p-2.5 rounded-xl"
                           style={{ background: "#F8F9FB" }}>
                        <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                        <p className="text-xs" style={{ color: "#9CA3AF" }}>{s.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 pt-3 border-t flex items-center justify-between"
                       style={{ borderColor: "#F0F0F0" }}>
                    <span className="text-xs" style={{ color: "#9CA3AF" }}>{rep.email}</span>
                    <span className="text-xs font-semibold" style={{ color: "#27295C" }}>{rep.total} total</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
