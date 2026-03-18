"use client";

import { useState } from "react";
import { X, Loader2, CheckCircle } from "lucide-react";

const OUTCOMES = [
  { value: "interested",    label: "Interesado",        emoji: "🔥" },
  { value: "needs_time",    label: "Necesita pensar",   emoji: "🤔" },
  { value: "not_qualified", label: "No califica",       emoji: "❌" },
  { value: "proposal_sent", label: "Propuesta enviada", emoji: "📄" },
  { value: "closed",        label: "Cerrado",           emoji: "🏆" },
];

const NEXT_STEPS = [
  { value: "none",              label: "Ninguno" },
  { value: "send_proposal",     label: "Enviar propuesta" },
  { value: "schedule_followup", label: "Agendar seguimiento" },
  { value: "escalate",          label: "Escalar" },
];

const STATUS_OPTIONS = [
  { value: "completed", label: "Completada" },
  { value: "no_show",   label: "No-show" },
  { value: "cancelled", label: "Cancelada" },
];

interface Appointment {
  id: string; clientName: string; clientCompany: string;
  outcome: string | null; nextStep: string | null; notes: string | null; status: string;
}

export function OutcomeModal({ appointment, onClose, onSaved }: {
  appointment: Appointment; onClose: () => void; onSaved: () => void;
}) {
  const [outcome, setOutcome] = useState(appointment.outcome || "");
  const [nextStep, setNextStep] = useState(appointment.nextStep || "none");
  const [notes, setNotes] = useState(appointment.notes || "");
  const [status, setStatus] = useState(appointment.status === "no_show" ? "no_show" : "completed");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/appointments/outcome", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId: appointment.id, outcome, nextStep, notes, status }),
    });
    setSaving(false);
    if (res.ok) { setSaved(true); setTimeout(() => { onSaved(); onClose(); }, 1000); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden"
           style={{ background: "white", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}
           onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ background: "#27295C" }}>
          <div>
            <p className="text-white font-semibold text-sm">{appointment.clientName}</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{appointment.clientCompany}</p>
          </div>
          <button onClick={onClose} style={{ color: "rgba(255,255,255,0.4)" }}><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-5">
          {saved ? (
            <div className="text-center py-6">
              <CheckCircle className="w-12 h-12 mx-auto mb-3" style={{ color: "#22C55E" }} />
              <p className="font-semibold" style={{ color: "#27295C" }}>Guardado correctamente</p>
            </div>
          ) : (
            <>
              <div>
                <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "#9CA3AF" }}>Estado de la cita</p>
                <div className="flex gap-2">
                  {STATUS_OPTIONS.map(s => (
                    <button key={s.value} onClick={() => setStatus(s.value)}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-all"
                      style={{ borderColor: status === s.value ? "#27295C" : "#E5E7EB", background: status === s.value ? "#27295C" : "white", color: status === s.value ? "white" : "#6B7280" }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              {status === "completed" && (
                <div>
                  <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "#9CA3AF" }}>Resultado</p>
                  <div className="space-y-2">
                    {OUTCOMES.map(o => (
                      <button key={o.value} onClick={() => setOutcome(o.value)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all"
                        style={{ borderColor: outcome === o.value ? "#C9A84C" : "#E5E7EB", background: outcome === o.value ? "rgba(201,168,76,0.06)" : "white" }}>
                        <span className="text-lg">{o.emoji}</span>
                        <span className="text-sm font-medium" style={{ color: "#27295C" }}>{o.label}</span>
                        {outcome === o.value && <span className="ml-auto w-2 h-2 rounded-full" style={{ background: "#C9A84C" }} />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {status === "completed" && (
                <div>
                  <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "#9CA3AF" }}>Proximo paso</p>
                  <div className="grid grid-cols-2 gap-2">
                    {NEXT_STEPS.map(s => (
                      <button key={s.value} onClick={() => setNextStep(s.value)}
                        className="py-2.5 px-3 rounded-xl text-xs font-medium border-2 transition-all"
                        style={{ borderColor: nextStep === s.value ? "#C9A84C" : "#E5E7EB", background: nextStep === s.value ? "rgba(201,168,76,0.08)" : "white", color: nextStep === s.value ? "#92400E" : "#6B7280" }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "#9CA3AF" }}>Notas</p>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Observaciones, contexto, detalles..." rows={3} maxLength={500}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                  style={{ border: "1.5px solid #E5E7EB", color: "#111827", background: "#F8F9FB" }}
                  onFocus={e => e.currentTarget.style.borderColor = "#27295C"}
                  onBlur={e => e.currentTarget.style.borderColor = "#E5E7EB"} />
                <p className="text-xs mt-1 text-right" style={{ color: "#9CA3AF" }}>{notes.length}/500</p>
              </div>
              <button onClick={handleSave} disabled={saving || (status === "completed" && !outcome)}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all"
                style={{ background: (saving || (status === "completed" && !outcome)) ? "#E5E7EB" : "#C9A84C", color: (saving || (status === "completed" && !outcome)) ? "#9CA3AF" : "#1A1C3E" }}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar outcome →"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
