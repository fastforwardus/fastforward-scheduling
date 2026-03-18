"use client";

import { useEffect, useState, useCallback } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

interface Appt {
  id: string; clientName: string; clientEmail: string; clientCompany: string;
  clientWhatsapp: string; platform: string; scheduledAt: string; status: string;
  outcome: string | null; leadScore: string; serviceInterest: string | null;
  repName: string | null; repSlug: string | null; assignedTo: string | null;
  notes: string | null; nextStep: string | null;
}

export default function Dashboard{ Admin }Client({ user, defaultTab }: {
  user: { id?: string; fullName: string; email: string; role: string; slug?: string };
  defaultTab?: string;
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
      roleLabel="Admin"
      appointments={appointments}
      loading={loading}
      onRefresh={load}
      canAssign={true}
    />
  );
}
