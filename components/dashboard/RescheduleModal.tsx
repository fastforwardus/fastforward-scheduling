"use client";

import { useState } from "react";
import { X, Calendar, Loader2, Check } from "lucide-react";

interface RescheduleModalProps {
  appointmentId: string;
  clientName: string;
  currentScheduledAt: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RescheduleModal({ appointmentId, clientName, currentScheduledAt, onClose, onSuccess }: RescheduleModalProps) {
  const current = new Date(currentScheduledAt);
  const localIso = new Date(current.getTime() - current.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [newDateTime, setNewDateTime] = useState(localIso);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!newDateTime) return;
    setSaving(true);
    const res = await fetch("/api/appointments/reschedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId, newScheduledAt: new Date(newDateTime).toISOString() }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.ok) {
      setSaved(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#E5E7EB" }}>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" style={{ color: "#27295C" }} />
            <p className="font-bold text-sm" style={{ color: "#27295C" }}>Reagendar cita</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4" style={{ color: "#6B7280" }} /></button>
        </div>

        {saved ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "#DCFCE7" }}>
              <Check className="w-6 h-6" style={{ color: "#22C55E" }} />
            </div>
            <p className="font-semibold" style={{ color: "#27295C" }}>Cita reagendada</p>
            <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>El cliente recibió un email de confirmación</p>
          </div>
        ) : (
          <div className="p-5">
            <p className="text-sm mb-4" style={{ color: "#6B7280" }}>
              Reagendando cita de <strong style={{ color: "#27295C" }}>{clientName}</strong>
            </p>
            <div className="mb-5">
              <label className="block text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: "#9CA3AF" }}>
                Nueva fecha y hora (hora Miami)
              </label>
              <input
                type="datetime-local"
                value={newDateTime}
                onChange={e => setNewDateTime(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                style={{ borderColor: "#E5E7EB", color: "#27295C" }}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={onClose}
                className="flex-1 py-3 rounded-xl text-sm border font-medium"
                style={{ borderColor: "#E5E7EB", color: "#6B7280" }}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving || !newDateTime}
                className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                style={{ background: "#27295C", color: "white" }}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reagendar →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
