"use client";

import { useEffect, useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { useSearchParams } from "next/navigation";


function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!current || !next || !confirm) { setError("Todos los campos son obligatorios"); return; }
    if (next !== confirm) { setError("Las contrasenas no coinciden"); return; }
    if (next.length < 8) { setError("Minimo 8 caracteres"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.ok) { setSuccess(true); setCurrent(""); setNext(""); setConfirm(""); setTimeout(() => setSuccess(false), 3000); }
    else setError(data.error || "Error al cambiar la contrasena");
  }

  return (
    <div className="space-y-3">
      {[
        { label: "Contrasena actual", value: current, set: setCurrent },
        { label: "Nueva contrasena", value: next, set: setNext },
        { label: "Confirmar nueva contrasena", value: confirm, set: setConfirm },
      ].map(f => (
        <div key={f.label}>
          <label className="block text-xs uppercase tracking-widest mb-1.5" style={{ color: "#9CA3AF" }}>{f.label}</label>
          <input type="password" value={f.value} onChange={e => f.set(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
            style={{ borderColor: "#E5E7EB", color: "#27295C" }}
            onFocus={e => e.currentTarget.style.borderColor = "#27295C"}
            onBlur={e => e.currentTarget.style.borderColor = "#E5E7EB"} />
        </div>
      ))}
      {error && <p className="text-xs" style={{ color: "#EF4444" }}>{error}</p>}
      {success && <p className="text-xs font-semibold" style={{ color: "#22C55E" }}>✅ Contrasena actualizada correctamente</p>}
      <button onClick={handleSave} disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
        style={{ background: "#27295C", color: "white", opacity: saving ? 0.7 : 1 }}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Guardar contrasena</>}
      </button>
    </div>
  );
}

export default function SettingsClient({ user }: {
  user: { id?: string; fullName: string; email: string; role: string; slug?: string }
}) {
  const searchParams = useSearchParams();
  const googleStatus = searchParams.get("google");
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/integrations/google/status")
      .then(r => r.json())
      .then(d => { setConnected(d.connected); setLoading(false); });
  }, []);

  return (
    <div className="flex min-h-screen" style={{ background: "#F8F9FB" }}>
      <Sidebar user={user} />
      <main className="flex-1 lg:ml-0 pt-14 lg:pt-0 overflow-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#9CA3AF" }}>Dashboard</p>
            <h1 className="text-2xl font-bold" style={{ color: "#27295C" }}>Configuracion</h1>
          </div>

          <div className="rounded-2xl border bg-white p-6 mb-4"
               style={{ borderColor: "#E5E7EB", boxShadow: "0 2px 8px rgba(39,41,92,0.04)" }}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                     style={{ background: "#F8F9FB", border: "1px solid #E5E7EB" }}>📅</div>
                <div>
                  <h3 className="font-semibold" style={{ color: "#27295C" }}>Google Calendar & Meet</h3>
                  <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>
                    Genera links de Google Meet reales al asignar cada cita
                  </p>
                  {!loading && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {connected
                        ? <><CheckCircle className="w-3.5 h-3.5" style={{ color: "#22C55E" }} /><span className="text-xs font-medium" style={{ color: "#22C55E" }}>Conectado</span></>
                        : <><AlertCircle className="w-3.5 h-3.5" style={{ color: "#F59E0B" }} /><span className="text-xs font-medium" style={{ color: "#F59E0B" }}>No conectado</span></>
                      }
                    </div>
                  )}
                </div>
              </div>
              <a href="/api/integrations/google/auth"
                 className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold"
                 style={{ background: connected ? "rgba(34,197,94,0.08)" : "#27295C", color: connected ? "#166534" : "white", border: connected ? "1px solid rgba(34,197,94,0.3)" : "none" }}>
                {connected ? "Reconectar" : "Conectar"} <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            {googleStatus === "connected" && (
              <div className="mt-4 p-3 rounded-xl flex items-center gap-2"
                   style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                <CheckCircle className="w-4 h-4" style={{ color: "#22C55E" }} />
                <p className="text-sm font-medium" style={{ color: "#166534" }}>Google Calendar conectado correctamente</p>
              </div>
            )}
            {googleStatus === "error" && (
              <div className="mt-4 p-3 rounded-xl flex items-center gap-2"
                   style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <AlertCircle className="w-4 h-4" style={{ color: "#EF4444" }} />
                <p className="text-sm font-medium" style={{ color: "#991B1B" }}>Error al conectar. Intentá de nuevo.</p>
              </div>
            )}
          </div>

          <div className="rounded-xl p-4 mb-6" style={{ background: "rgba(39,41,92,0.04)", border: "1px solid rgba(39,41,92,0.08)" }}>
            <p className="text-xs" style={{ color: "#6B7280" }}>
              <strong style={{ color: "#27295C" }}>Como funciona:</strong> Cada sales rep conecta su cuenta de Google una sola vez.
              Al asignar una cita de Google Meet, se crea el evento en su calendario con el link real.
              El cliente recibe el link por email automaticamente.
            </p>
          </div>

          {/* Password change */}
          <div className="rounded-2xl border bg-white p-6"
               style={{ borderColor: "#E5E7EB", boxShadow: "0 2px 8px rgba(39,41,92,0.04)" }}>
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                   style={{ background: "#F8F9FB", border: "1px solid #E5E7EB" }}>🔒</div>
              <div>
                <h3 className="font-semibold" style={{ color: "#27295C" }}>Cambiar contrasena</h3>
                <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>Actualizá tu contrasena de acceso</p>
              </div>
            </div>
            <PasswordForm />
          </div>
        </div>
      </main>
    </div>
  );
}
