"use client";
import type { Appt } from "@/types/appointments";

import { useEffect, useState, useCallback } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";



export default function ManagerDashboardClient({ user }: {
  user: { id?: string; fullName: string; email: string; role: string; slug?: string };
}) {
  const [appointments, setAppointments] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/appointments/list");
    const data = await res.json();
    setAppointments(data.appointments || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <DashboardShell
      user={user}
      roleLabel="Sales Manager"
      appointments={appointments}
      loading={loading}
      onRefresh={load}
      canAssign={true}
    />
  );
}
