"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Check } from "lucide-react";

interface User { id: string; fullName: string; role: string; email: string; }
interface Appointment {
  id: string;
  clientName: string;
  clientCompany: string;
  scheduledAt: string;
}

export function AssignModal({
  appointment,
  onClose,
  onAssigned,
}: {
  appointment: Appointment;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/users/list")
      .then(r => r.json())
      .then(d => setUsers(d.users || []));
  }, []);

  async function handleAssign() {
    if (!selected) return;
    setLoading(true);
    const res = await fetch("/api/appointments/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId: appointment.id, userId: selected }),
    });
    setLoading(false);
    if (res.ok) {
      setSuccess(true);
      setTimeout(() => { onAssigned(); onClose(); }, 1200);
    }
  }

  const slotDate = new Date(appointment.scheduledAt);
  const formatted = slotDate.toLocaleDateString("es-ES", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", timeZone: "America/New_York",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: "rgba(0,0,0,0.6)" }}
         onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden"
           style={{ background: "white", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}
           onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between"
             style={{ background: "#27295C" }}>
          <div>
            <p className="text-white font-semibold text-sm">{appointment.clientName}</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{appointment.clientCompany} · {formatted}</p>
          </div>
          <button onClick={onClose} style={{ color: "rgba(255,255,255,0.4)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {success ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                   style={{ background: "rgba(34,197,94,0.12)" }}>
                <Check className="w-6 h-6 text-green-500" />
              </div>
              <p className="font-semibold text-sm" style={{ color: "#27295C" }}>Cita asignada y notificación enviada</p>
            </div>
          ) : (
            <>
              <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "#9CA3AF" }}>Asignar a</p>
              <div className="space-y-2 mb-6">
                {users
                  .filter(u => u.role !== "sales_rep" ? true : true)
                  .map(u => (
                    <button key={u.id} onClick={() => setSelected(u.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all"
                      style={{
                        borderColor: selected === u.id ? "#C9A84C" : "#E5E7EB",
                        background: selected === u.id ? "rgba(201,168,76,0.05)" : "white",
                      }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                           style={{ background: "#27295C" }}>
                        {u.fullName[0]}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold" style={{ color: "#27295C" }}>{u.fullName}</p>
                        <p className="text-xs" style={{ color: "#9CA3AF" }}>
                          {u.role === "admin" ? "Admin" : u.role === "sales_manager" ? "Manager" : "Sales Rep"}
                        </p>
                      </div>
                      {selected === u.id && <Check className="w-4 h-4" style={{ color: "#C9A84C" }} />}
                    </button>
                  ))
                }
              </div>

              <button onClick={handleAssign} disabled={!selected || loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all"
                style={{
                  background: !selected ? "#E5E7EB" : "#C9A84C",
                  color: !selected ? "#9CA3AF" : "#1A1C3E",
                  cursor: !selected ? "not-allowed" : "pointer",
                }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Asignar y notificar →"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
