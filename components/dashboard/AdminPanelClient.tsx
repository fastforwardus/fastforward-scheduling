"use client";

import { useEffect, useState, useCallback } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Users, BarChart2, Plus, Edit2, Check, X, Loader2, ChevronDown, ChevronUp, Clock, Trash2 } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface User {
  id: string; fullName: string; email: string; role: string;
  slug: string | null; isActive: boolean; whatsappPhone: string | null;
  googleRefreshToken: string | null;
}

interface AvailRule { dayOfWeek: number; startTime: string; endTime: string; isActive: boolean; }

interface Metrics {
  summary: {
    total: number; assigned: number; completed: number; noShow: number;
    proposalSent: number; closed: number; interested: number;
    showRate: number; conversionRate: number;
  };
  last30: { total: number };
  last7:  { total: number };
  byPlatform: { meet: number; zoom: number; whatsapp: number };
  bySource:   { general: number; personal: number };
  byScore:    { hot: number; warm: number; cold: number };
  byRep: {
    id: string; name: string; slug: string | null; role: string;
    total: number; completed: number; noShow: number;
    closed: number; proposal: number; showRate: number; convRate: number;
  }[];
  daily: { date: string; count: number }[];
  satisfaction: { total: number; avg: string | null; fiveStars: number; fourStars: number; lowRating: number };
}

const TIMEZONES = [
  { value: "America/New_York",    label: "Miami / New York (EST)" },
  { value: "America/Chicago",     label: "Chicago (CST)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PST)" },
  { value: "America/Mexico_City", label: "Mexico / Ciudad de Mexico" },
  { value: "America/Bogota",      label: "Colombia / Bogota" },
  { value: "America/Lima",        label: "Peru / Lima" },
  { value: "America/Santiago",    label: "Chile / Santiago" },
  { value: "America/Argentina/Buenos_Aires", label: "Argentina / Buenos Aires" },
  { value: "America/Sao_Paulo",   label: "Brasil / Sao Paulo" },
  { value: "Europe/Madrid",       label: "Espana / Madrid" },
  { value: "Europe/Rome",         label: "Italia / Roma" },
  { value: "Europe/London",       label: "Reino Unido / Londres" },
];

const DAYS = ["", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const ROLES: Record<string, string> = { admin: "Admin", sales_manager: "Manager", sales_rep: "Sales Rep" };
const ROLE_COLORS: Record<string, string> = { admin: "#6366F1", sales_manager: "#F97316", sales_rep: "#22C55E" };

// ─── Availability Editor ──────────────────────────────────────────────────────

function AvailabilityEditor({ userId }: { userId: string }) {
  const [rules, setRules] = useState<AvailRule[]>([]);
  const [saving, setSaving] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/availability?userId=${userId}`);
    const data = await res.json();
    const ruleMap: Record<number, AvailRule> = {};
    (data.rules || []).forEach((r: AvailRule) => { ruleMap[r.dayOfWeek] = r; });
    setRules([1,2,3,4,5].map(d => ruleMap[d] || { dayOfWeek: d, startTime: "10:30", endTime: "19:30", isActive: true }));
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  async function saveRule(rule: AvailRule) {
    setSaving(rule.dayOfWeek);
    await fetch("/api/admin/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...rule }),
    });
    setSaving(null);
  }

  if (loading) return <div className="py-4 text-center text-xs" style={{ color: "#9CA3AF" }}>Cargando...</div>;

  return (
    <div className="space-y-2">
      {rules.map(rule => (
        <div key={rule.dayOfWeek} className="flex items-center gap-3 p-3 rounded-xl"
             style={{ background: rule.isActive ? "#F8F9FB" : "#F3F4F6", border: "1px solid #E5E7EB" }}>
          <div className="w-10 text-xs font-bold" style={{ color: "#27295C" }}>{DAYS[rule.dayOfWeek]}</div>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={rule.isActive}
              onChange={e => setRules(prev => prev.map(r => r.dayOfWeek === rule.dayOfWeek ? { ...r, isActive: e.target.checked } : r))}
              className="rounded" />
            <span className="text-xs" style={{ color: "#6B7280" }}>Activo</span>
          </label>
          {rule.isActive && (
            <>
              <input type="time" value={rule.startTime}
                onChange={e => setRules(prev => prev.map(r => r.dayOfWeek === rule.dayOfWeek ? { ...r, startTime: e.target.value } : r))}
                className="px-2 py-1 rounded-lg border text-xs outline-none"
                style={{ borderColor: "#E5E7EB", color: "#27295C" }} />
              <span className="text-xs" style={{ color: "#9CA3AF" }}>a</span>
              <input type="time" value={rule.endTime}
                onChange={e => setRules(prev => prev.map(r => r.dayOfWeek === rule.dayOfWeek ? { ...r, endTime: e.target.value } : r))}
                className="px-2 py-1 rounded-lg border text-xs outline-none"
                style={{ borderColor: "#E5E7EB", color: "#27295C" }} />
            </>
          )}
          <button onClick={() => saveRule(rule)}
            className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: "#27295C", color: "white", opacity: saving === rule.dayOfWeek ? 0.7 : 1 }}>
            {saving === rule.dayOfWeek ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3" /> Guardar</>}
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── User Row ─────────────────────────────────────────────────────────────────

function UserRow({ user, onRefresh }: { user: User; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ fullName: user.fullName, email: user.email, role: user.role, slug: user.slug || "", whatsappPhone: user.whatsappPhone || "", timezone: (user as { timezone?: string }).timezone || "America/New_York", isActive: user.isActive, password: "" });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, ...form }),
    });
    setSaving(false);
    setEditing(false);
    onRefresh();
  }

  return (
    <div className="border-b last:border-b-0" style={{ borderColor: "#F0F0F0" }}>
      <div className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-gray-50"
           onClick={() => setExpanded(!expanded)}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
             style={{ background: ROLE_COLORS[user.role] || "#27295C" }}>
          {user.fullName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: "#111827" }}>{user.fullName}</p>
          <p className="text-xs" style={{ color: "#6B7280" }}>{user.email}</p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{ background: `${ROLE_COLORS[user.role]}18`, color: ROLE_COLORS[user.role] }}>
          {ROLES[user.role]}
        </span>
        {user.slug && <span className="hidden sm:block text-xs" style={{ color: "#9CA3AF" }}>/book/{user.slug}</span>}
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full`} style={{ background: user.isActive ? "#22C55E" : "#E5E7EB" }} />
          <span className="text-xs" style={{ color: "#9CA3AF" }}>{user.isActive ? "Activo" : "Inactivo"}</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4" style={{ color: "#9CA3AF" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "#9CA3AF" }} />}
      </div>

      {expanded && (
        <div className="px-5 pb-5 pt-1">
          <div className="ml-11 space-y-4">
            {/* Edit toggle */}
            <div className="flex gap-2">
              <button onClick={() => setEditing(!editing)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border"
                style={{ borderColor: "#27295C", color: "#27295C" }}>
                <Edit2 className="w-3 h-3" /> {editing ? "Cancelar" : "Editar usuario"}
              </button>
            </div>

            {/* Edit form */}
            {editing && (
              <div className="grid grid-cols-2 gap-3 p-4 rounded-xl" style={{ background: "#F8F9FB", border: "1px solid #E5E7EB" }}>
                {[
                  { label: "Nombre completo", key: "fullName", type: "text" },
                  { label: "Email", key: "email", type: "email" },
                  { label: "Slug (/book/xxx)", key: "slug", type: "text" },
                  { label: "WhatsApp", key: "whatsappPhone", type: "text" },
                  { label: "Nueva contraseña (opcional)", key: "password", type: "password" },
                ].map(field => (
                  <div key={field.key}>
                    <label className="block text-xs uppercase tracking-widest mb-1" style={{ color: "#9CA3AF" }}>{field.label}</label>
                    <input type={field.type} value={form[field.key as keyof typeof form] as string}
                      onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value } as typeof prev))}
                      className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                      style={{ borderColor: "#E5E7EB", color: "#27295C" }}
                      onFocus={e => e.currentTarget.style.borderColor = "#27295C"}
                      onBlur={e => e.currentTarget.style.borderColor = "#E5E7EB"} />
                  </div>
                ))}
                <div>
                  <label className="block text-xs uppercase tracking-widest mb-1" style={{ color: "#9CA3AF" }}>Rol</label>
                  <select value={form.role} onChange={e => setForm(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none bg-white"
                    style={{ borderColor: "#E5E7EB", color: "#27295C" }}>
                    <option value="sales_rep">Sales Rep</option>
                    <option value="sales_manager">Sales Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest mb-1" style={{ color: "#9CA3AF" }}>Zona horaria</label>
                  <select value={form.timezone} onChange={e => setForm(prev => ({ ...prev, timezone: e.target.value } as typeof prev))}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none bg-white"
                    style={{ borderColor: "#E5E7EB", color: "#27295C" }}>
                    {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <input type="checkbox" id={`active-${user.id}`} checked={form.isActive}
                    onChange={e => setForm(prev => ({ ...prev, isActive: e.target.checked }))} />
                  <label htmlFor={`active-${user.id}`} className="text-xs font-medium" style={{ color: "#27295C" }}>Usuario activo</label>
                </div>
                <div className="col-span-2">
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={{ background: "#C9A84C", color: "#1A1C3E" }}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Guardar cambios</>}
                  </button>
                </div>
              </div>
            )}

            {/* Availability */}
            <div>
              <p className="text-xs uppercase tracking-widest mb-3 font-semibold" style={{ color: "#9CA3AF" }}>
                Disponibilidad — horarios de atención (hora Miami)
              </p>
              <AvailabilityEditor userId={user.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Create User Modal ────────────────────────────────────────────────────────

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ fullName: "", email: "", role: "sales_rep", slug: "", whatsappPhone: "", timezone: "America/New_York", password: "FastForward2024!" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!form.fullName || !form.email || !form.password) { setError("Nombre, email y contraseña son obligatorios"); return; }
    setSaving(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (data.ok) { onCreated(); onClose(); }
    else setError(data.error || "Error al crear usuario");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: "white" }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ background: "#27295C" }}>
          <p className="text-white font-semibold">Nuevo usuario</p>
          <button onClick={onClose} style={{ color: "rgba(255,255,255,0.4)" }}><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {[
            { label: "Nombre completo *", key: "fullName", type: "text", placeholder: "Nombre Apellido" },
            { label: "Email *", key: "email", type: "email", placeholder: "nombre@fastfwdus.com" },
            { label: "Slug (/book/xxx)", key: "slug", type: "text", placeholder: "nombre" },
            { label: "WhatsApp", key: "whatsappPhone", type: "text", placeholder: "+1 305 000 0000" },
            { label: "Contraseña inicial *", key: "password", type: "text", placeholder: "FastForward2024!" },
          ].map(field => (
            <div key={field.key}>
              <label className="block text-xs uppercase tracking-widest mb-1.5" style={{ color: "#9CA3AF" }}>{field.label}</label>
              <input type={field.type} value={form[field.key as keyof typeof form] as string} placeholder={field.placeholder}
                onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                style={{ borderColor: "#E5E7EB", color: "#27295C" }}
                onFocus={e => e.currentTarget.style.borderColor = "#27295C"}
                onBlur={e => e.currentTarget.style.borderColor = "#E5E7EB"} />
            </div>
          ))}
          <div>
            <label className="block text-xs uppercase tracking-widest mb-1.5" style={{ color: "#9CA3AF" }}>Rol</label>
            <select value={form.role} onChange={e => setForm(prev => ({ ...prev, role: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none bg-white"
              style={{ borderColor: "#E5E7EB", color: "#27295C" }}>
              <option value="sales_rep">Sales Rep</option>
              <option value="sales_manager">Sales Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest mb-1.5" style={{ color: "#9CA3AF" }}>Zona horaria</label>
            <select value={form.timezone} onChange={e => setForm(prev => ({ ...prev, timezone: e.target.value } as typeof prev))}
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none bg-white"
              style={{ borderColor: "#E5E7EB", color: "#27295C" }}>
              {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
            </select>
          </div>
          {error && <p className="text-xs text-red-500 px-1">{error}</p>}
          <button onClick={handleCreate} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm"
            style={{ background: "#C9A84C", color: "#1A1C3E" }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Crear usuario</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Metrics View ─────────────────────────────────────────────────────────────

function MetricsView({ metrics }: { metrics: Metrics }) {
  const { summary, byRep, byPlatform, bySource, byScore, daily, last7, satisfaction } = metrics;
  const maxDaily = Math.max(...daily.map(d => d.count), 1);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total citas", value: summary.total, sub: `+${last7.total} esta semana`, color: "#27295C" },
          { label: "Show rate", value: `${summary.showRate}%`, sub: `${summary.completed} completadas`, color: "#22C55E" },
          { label: "Conversion", value: `${summary.conversionRate}%`, sub: `${summary.closed} cerradas`, color: "#C9A84C" },
          { label: "No-shows", value: summary.noShow, sub: `${summary.total - summary.noShow - summary.completed} pendientes`, color: "#EF4444" },
        { label: "Satisfaccion", value: satisfaction.avg ? `${satisfaction.avg}/5 ⭐` : "—", sub: `${satisfaction.total} encuestas`, color: "#F59E0B" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-5 border bg-white" style={{ borderColor: "#E5E7EB" }}>
            <p className="text-3xl font-bold mb-1" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs font-semibold" style={{ color: "#27295C" }}>{s.label}</p>
            <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Funnel */}
      <div className="rounded-2xl border bg-white p-5" style={{ borderColor: "#E5E7EB" }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: "#27295C" }}>Embudo de conversion</h3>
        <div className="space-y-2">
          {[
            { label: "Agendadas", value: summary.total, pct: 100 },
            { label: "Asignadas", value: summary.assigned, pct: Math.round((summary.assigned/Math.max(summary.total,1))*100) },
            { label: "Completadas", value: summary.completed, pct: Math.round((summary.completed/Math.max(summary.total,1))*100) },
            { label: "Interesados", value: summary.interested, pct: Math.round((summary.interested/Math.max(summary.total,1))*100) },
            { label: "Propuestas", value: summary.proposalSent, pct: Math.round((summary.proposalSent/Math.max(summary.total,1))*100) },
            { label: "Cerrados", value: summary.closed, pct: Math.round((summary.closed/Math.max(summary.total,1))*100) },
          ].map((step, i) => (
            <div key={step.label} className="flex items-center gap-3">
              <div className="w-24 text-xs font-medium text-right flex-shrink-0" style={{ color: "#6B7280" }}>{step.label}</div>
              <div className="flex-1 h-6 rounded-lg overflow-hidden" style={{ background: "#F3F4F6" }}>
                <div className="h-full rounded-lg flex items-center px-2 transition-all"
                     style={{ width: `${step.pct}%`, background: i === 5 ? "#22C55E" : i === 0 ? "#27295C" : "#C9A84C", minWidth: "32px" }}>
                  <span className="text-white text-xs font-bold">{step.value}</span>
                </div>
              </div>
              <div className="w-10 text-xs text-right" style={{ color: "#9CA3AF" }}>{step.pct}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily chart */}
      <div className="rounded-2xl border bg-white p-5" style={{ borderColor: "#E5E7EB" }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: "#27295C" }}>Citas ultimos 14 dias</h3>
        <div className="flex items-end gap-1 h-24">
          {daily.map(d => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-t-sm transition-all"
                   style={{ height: `${Math.round((d.count / maxDaily) * 80)}px`, background: "#27295C", minHeight: d.count > 0 ? "4px" : "0" }} />
              <span className="text-xs" style={{ color: "#9CA3AF", fontSize: "9px" }}>
                {new Date(d.date + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "numeric" })}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* By platform + source */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-white p-5" style={{ borderColor: "#E5E7EB" }}>
          <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#9CA3AF" }}>Por plataforma</h3>
          {[
            { label: "Google Meet", value: byPlatform.meet, color: "#4285F4" },
            { label: "Zoom", value: byPlatform.zoom, color: "#2D8CFF" },
            { label: "WhatsApp", value: byPlatform.whatsapp, color: "#25D366" },
          ].map(p => (
            <div key={p.label} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                <span className="text-xs" style={{ color: "#374151" }}>{p.label}</span>
              </div>
              <span className="text-xs font-bold" style={{ color: "#27295C" }}>{p.value}</span>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border bg-white p-5" style={{ borderColor: "#E5E7EB" }}>
          <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#9CA3AF" }}>Origen</h3>
          {[
            { label: "Link general", value: bySource.general, color: "#6366F1" },
            { label: "Link personal", value: bySource.personal, color: "#C9A84C" },
          ].map(p => (
            <div key={p.label} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                <span className="text-xs" style={{ color: "#374151" }}>{p.label}</span>
              </div>
              <span className="text-xs font-bold" style={{ color: "#27295C" }}>{p.value}</span>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border bg-white p-5" style={{ borderColor: "#E5E7EB" }}>
          <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#9CA3AF" }}>Lead Score</h3>
          {[
            { label: "🔥 Hot", value: byScore.hot, color: "#EF4444" },
            { label: "🟡 Warm", value: byScore.warm, color: "#F59E0B" },
            { label: "❄️ Cold", value: byScore.cold, color: "#3B82F6" },
          ].map(p => (
            <div key={p.label} className="flex items-center justify-between py-1.5">
              <span className="text-xs" style={{ color: "#374151" }}>{p.label}</span>
              <span className="text-xs font-bold" style={{ color: "#27295C" }}>{p.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* By rep */}
      <div className="rounded-2xl border bg-white overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
        <div className="px-5 py-3.5 border-b" style={{ borderColor: "#F0F0F0", background: "#F8F9FB" }}>
          <h3 className="text-sm font-semibold" style={{ color: "#27295C" }}>Performance por rep</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: "#F8F9FB" }}>
                {["Rep", "Total", "Completadas", "No-shows", "Show %", "Propuestas", "Cerradas", "Conv %"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold uppercase tracking-widest" style={{ color: "#9CA3AF", fontSize: "10px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "#F0F0F0" }}>
              {byRep.map(rep => (
                <tr key={rep.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold"
                           style={{ background: ROLE_COLORS[rep.role] || "#27295C", fontSize: "10px" }}>{rep.name[0]}</div>
                      <span className="font-medium" style={{ color: "#27295C" }}>{rep.name.split(" ")[0]}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold" style={{ color: "#27295C" }}>{rep.total}</td>
                  <td className="px-4 py-3" style={{ color: "#22C55E" }}>{rep.completed}</td>
                  <td className="px-4 py-3" style={{ color: "#EF4444" }}>{rep.noShow}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: rep.showRate >= 70 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: rep.showRate >= 70 ? "#166534" : "#991B1B" }}>
                      {rep.showRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: "#3B82F6" }}>{rep.proposal}</td>
                  <td className="px-4 py-3 font-bold" style={{ color: "#C9A84C" }}>{rep.closed}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: rep.convRate >= 20 ? "rgba(201,168,76,0.1)" : "rgba(156,163,175,0.1)", color: rep.convRate >= 20 ? "#92400E" : "#6B7280" }}>
                      {rep.convRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main AdminPanel ──────────────────────────────────────────────────────────

export default function AdminPanelClient({ user }: {
  user: { id?: string; fullName: string; email: string; role: string; slug?: string }
}) {
  const [tab, setTab] = useState<"users" | "metrics" | "holidays" | "partners" | "finanzas">("users");
  const [users, setUsers] = useState<User[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [holidays, setHolidays] = useState<{ id: string; date: string; reason: string | null }[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayReason, setNewHolidayReason] = useState("");
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [partnerReferrals, setPartnerReferrals] = useState<{id:string;clientName:string;clientCompany:string;scheduledAt:string;status:string;outcome:string|null}[]>([]);
  const [loadingReferrals, setLoadingReferrals] = useState(false);
  const [partnersList, setPartnersList] = useState<{ id: string; name: string; slug: string; email: string; company: string | null; isActive: boolean; commissionRate: string }[]>([]);
  const [showCreatePartner, setShowCreatePartner] = useState(false);
  const [invoices, setInvoices] = useState<{id:string;proposalNum:string;total:number;qbInvoiceId:string|null;customerName?:string;dueDate?:string;balance?:number;totalAmt?:number;invoiceSentAt:Date|null;appointmentId:string;lang:string|null}[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [sendingInvoice, setSendingInvoice] = useState<string|null>(null);
  const [partnerForm, setPartnerForm] = useState({ name: "", slug: "", email: "", company: "", password: "", commissionRate: "0" });
  const [savingPartner, setSavingPartner] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data.users || []);
    setLoadingUsers(false);
  }, []);

  const loadMetrics = useCallback(async () => {
    setLoadingMetrics(true);
    const res = await fetch("/api/admin/metrics");
    const data = await res.json();
    setMetrics(data);
    setLoadingMetrics(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const loadHolidays = useCallback(async () => {
    const res = await fetch("/api/admin/holidays");
    const data = await res.json();
    setHolidays(data.holidays || []);
  }, []);

  useEffect(() => { if (tab === "holidays") loadHolidays(); }, [tab, loadHolidays]);
  const loadPartners = useCallback(async () => {
    const res = await fetch("/api/admin/partners");
    const data = await res.json();
    setPartnersList(data.partners || []);
  }, []);

  useEffect(() => { if (tab === "partners") loadPartners(); }, [tab, loadPartners]);

  async function loadPartnerReferrals(slug: string) {
    setLoadingReferrals(true);
    setSelectedPartner(slug);
    const res = await fetch(`/api/admin/partners/${slug}/referrals`);
    const data = await res.json();
    setPartnerReferrals(data.appointments || []);
    setLoadingReferrals(false);
  }

  const loadInvoices = useCallback(async () => {
    setLoadingInvoices(true);
    const res = await fetch("/api/admin/invoices");
    const data = await res.json();
    setInvoices(data.invoices || []);
    setLoadingInvoices(false);
  }, []);

  useEffect(() => { if (tab === "finanzas") loadInvoices(); }, [tab, loadInvoices]);

  async function sendInvoice(proposalId: string) {
    setSendingInvoice(proposalId);
    await fetch("/api/admin/invoices/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proposalId }),
    });
    setSendingInvoice(null);
    loadInvoices();
  }

  async function createPartner() {
    if (!partnerForm.name || !partnerForm.slug || !partnerForm.email || !partnerForm.password) return;
    setSavingPartner(true);
    await fetch("/api/admin/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partnerForm),
    });
    setSavingPartner(false);
    setShowCreatePartner(false);
    setPartnerForm({ name: "", slug: "", email: "", company: "", password: "", commissionRate: "0" });
    loadPartners();
  }

  async function addHoliday() {
    if (!newHolidayDate) return;
    setSavingHoliday(true);
    await fetch("/api/admin/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: newHolidayDate, reason: newHolidayReason }),
    });
    setNewHolidayDate("");
    setNewHolidayReason("");
    setSavingHoliday(false);
    loadHolidays();
  }

  async function deleteHoliday(date: string) {
    await fetch("/api/admin/holidays", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    });
    loadHolidays();
  }
  useEffect(() => { if (tab === "metrics" && !metrics) loadMetrics(); }, [tab, metrics, loadMetrics]);

  return (
    <div className="flex min-h-screen" style={{ background: "#F8F9FB" }}>
      <Sidebar user={user} />
      <main className="flex-1 lg:ml-0 pt-14 lg:pt-0 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#9CA3AF" }}>Admin</p>
              <h1 className="text-2xl font-bold" style={{ color: "#27295C" }}>Panel de administracion</h1>
            </div>
            {tab === "users" && (
              <button onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5"
                style={{ background: "#C9A84C", color: "#1A1C3E" }}>
                <Plus className="w-4 h-4" /> Nuevo usuario
              </button>
            )}
            {tab === "metrics" && (
              <button onClick={loadMetrics}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm border"
                style={{ borderColor: "#E5E7EB", color: "#6B7280", background: "white" }}>
                Actualizar
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-0 border-b mb-6" style={{ borderColor: "#E5E7EB" }}>
            {[
              { key: "users",   label: "Usuarios y disponibilidad", icon: Users },
              { key: "metrics", label: "Metricas",                  icon: BarChart2 },
              { key: "holidays", label: "Feriados",                   icon: Clock },
              { key: "partners", label: "Partners",                   icon: Users },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
                className="flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-all"
                style={{ borderBottomColor: tab === t.key ? "#27295C" : "transparent", color: tab === t.key ? "#27295C" : "#9CA3AF" }}>
                <t.icon className="w-4 h-4" /> {t.label}
              </button>
            ))}
          </div>

          {/* Users tab */}
          {tab === "users" && (
            <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #E5E7EB" }}>
              {loadingUsers ? (
                [1,2,3].map(i => (
                  <div key={i} className="flex items-center gap-4 px-5 py-4 border-b" style={{ borderColor: "#F0F0F0" }}>
                    <div className="w-8 h-8 rounded-full animate-pulse" style={{ background: "#E5E7EB" }} />
                    <div className="flex-1">
                      <div className="w-32 h-4 rounded animate-pulse mb-1.5" style={{ background: "#E5E7EB" }} />
                      <div className="w-48 h-3 rounded animate-pulse" style={{ background: "#F3F4F6" }} />
                    </div>
                  </div>
                ))
              ) : (
                users.map(u => <UserRow key={u.id} user={u} onRefresh={loadUsers} />)
              )}
            </div>
          )}

          {/* Holidays tab */}
          {tab === "holidays" && (
            <div className="space-y-4">
              {/* Add holiday */}
              <div className="rounded-2xl bg-white border p-5" style={{ borderColor: "#E5E7EB" }}>
                <h3 className="text-sm font-semibold mb-4" style={{ color: "#27295C" }}>Agregar dia bloqueado</h3>
                <div className="flex gap-3 flex-wrap">
                  <div>
                    <label className="block text-xs uppercase tracking-widest mb-1.5" style={{ color: "#9CA3AF" }}>Fecha</label>
                    <input type="date" value={newHolidayDate} onChange={e => setNewHolidayDate(e.target.value)}
                      className="px-3 py-2.5 rounded-xl border text-sm outline-none"
                      style={{ borderColor: "#E5E7EB", color: "#27295C" }}
                      onFocus={e => e.currentTarget.style.borderColor = "#27295C"}
                      onBlur={e => e.currentTarget.style.borderColor = "#E5E7EB"} />
                  </div>
                  <div className="flex-1 min-w-48">
                    <label className="block text-xs uppercase tracking-widest mb-1.5" style={{ color: "#9CA3AF" }}>Motivo (opcional)</label>
                    <input type="text" value={newHolidayReason} onChange={e => setNewHolidayReason(e.target.value)}
                      placeholder="Ej: Feriado nacional, Evento interno..."
                      className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                      style={{ borderColor: "#E5E7EB", color: "#27295C" }}
                      onFocus={e => e.currentTarget.style.borderColor = "#27295C"}
                      onBlur={e => e.currentTarget.style.borderColor = "#E5E7EB"} />
                  </div>
                  <div className="flex items-end">
                    <button onClick={addHoliday} disabled={!newHolidayDate || savingHoliday}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                      style={{ background: newHolidayDate ? "#C9A84C" : "#E5E7EB", color: newHolidayDate ? "#1A1C3E" : "#9CA3AF" }}>
                      {savingHoliday ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Agregar</>}
                    </button>
                  </div>
                </div>
              </div>

              {/* List */}
              <div className="rounded-2xl bg-white border overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
                <div className="px-5 py-3.5 border-b" style={{ borderColor: "#F0F0F0", background: "#F8F9FB" }}>
                  <p className="text-sm font-semibold" style={{ color: "#27295C" }}>
                    Dias bloqueados ({holidays.length})
                  </p>
                </div>
                {holidays.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-2xl mb-2">📅</p>
                    <p className="text-sm" style={{ color: "#9CA3AF" }}>No hay dias bloqueados</p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: "#F0F0F0" }}>
                    {holidays.map(h => (
                      <div key={h.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#FEF9C3" }}>
                            <Clock className="w-4 h-4" style={{ color: "#EAB308" }} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold" style={{ color: "#27295C" }}>
                              {new Date(h.date + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                            </p>
                            {h.reason && <p className="text-xs" style={{ color: "#6B7280" }}>{h.reason}</p>}
                          </div>
                        </div>
                        <button onClick={() => deleteHoliday(h.date)}
                          className="p-2 rounded-lg transition-colors hover:bg-red-50"
                          style={{ color: "#9CA3AF" }}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Partners tab */}
          {tab === "partners" && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={() => setShowCreatePartner(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "#C9A84C", color: "#1A1C3E" }}>
                  <Plus className="w-4 h-4" /> Nuevo partner
                </button>
              </div>

              {showCreatePartner && (
                <div className="rounded-2xl bg-white border p-5" style={{ borderColor: "#E5E7EB" }}>
                  <h3 className="text-sm font-semibold mb-4" style={{ color: "#27295C" }}>Crear partner</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Nombre", key: "name", placeholder: "Nombre del partner" },
                      { label: "Slug (URL)", key: "slug", placeholder: "acme-foods" },
                      { label: "Email", key: "email", placeholder: "partner@empresa.com" },
                      { label: "Empresa", key: "company", placeholder: "Empresa del partner" },
                      { label: "Contrasena", key: "password", placeholder: "Minimo 8 caracteres" },
                      { label: "Comision %", key: "commissionRate", placeholder: "0" },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-xs uppercase tracking-widest mb-1" style={{ color: "#9CA3AF" }}>{f.label}</label>
                        <input value={partnerForm[f.key as keyof typeof partnerForm]}
                          onChange={e => setPartnerForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                          className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                          style={{ borderColor: "#E5E7EB", color: "#27295C" }} />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={createPartner} disabled={savingPartner}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                      style={{ background: "#C9A84C", color: "#1A1C3E" }}>
                      {savingPartner ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear"}
                    </button>
                    <button onClick={() => setShowCreatePartner(false)}
                      className="px-4 py-2.5 rounded-xl text-sm border"
                      style={{ borderColor: "#E5E7EB", color: "#6B7280" }}>Cancelar</button>
                  </div>
                </div>
              )}

              <div className="rounded-2xl bg-white border overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
                <div className="px-5 py-3.5 border-b" style={{ borderColor: "#F0F0F0", background: "#F8F9FB" }}>
                  <p className="text-sm font-semibold" style={{ color: "#27295C" }}>Partners ({partnersList.length})</p>
                </div>
                {partnersList.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-2xl mb-2">🤝</p>
                    <p className="text-sm" style={{ color: "#9CA3AF" }}>No hay partners todavia</p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: "#F0F0F0" }}>
                    {partnersList.map(partner => (
                      <div key={partner.id} className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => loadPartnerReferrals(partner.slug)}>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "#27295C" }}>{partner.name}</p>
                          <p className="text-xs" style={{ color: "#6B7280" }}>{partner.email} · scheduling.fastfwdus.com/partner/{partner.slug}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {partner.commissionRate && parseFloat(partner.commissionRate) > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#DCFCE7", color: "#166534" }}>
                              {partner.commissionRate}% comision
                            </span>
                          )}
                          <span className="w-2 h-2 rounded-full" style={{ background: partner.isActive ? "#22C55E" : "#E5E7EB" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedPartner && (
                <div className="rounded-2xl bg-white border overflow-hidden mt-4" style={{ borderColor: "#E5E7EB" }}>
                  <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: "#F0F0F0", background: "#F8F9FB" }}>
                    <p className="text-sm font-semibold" style={{ color: "#27295C" }}>
                      Referidos de: <span style={{ color: "#C9A84C" }}>{selectedPartner}</span>
                    </p>
                    <button onClick={() => { setSelectedPartner(null); setPartnerReferrals([]); }}
                      className="text-xs px-3 py-1 rounded-lg border" style={{ borderColor: "#E5E7EB", color: "#6B7280" }}>
                      Cerrar
                    </button>
                  </div>
                  {loadingReferrals ? (
                    <div className="text-center py-8 text-sm" style={{ color: "#9CA3AF" }}>Cargando...</div>
                  ) : partnerReferrals.length === 0 ? (
                    <div className="text-center py-8 text-sm" style={{ color: "#9CA3AF" }}>Sin referidos aún</div>
                  ) : (
                    <div className="divide-y" style={{ borderColor: "#F0F0F0" }}>
                      {partnerReferrals.map(appt => (
                        <div key={appt.id} className="flex items-center justify-between px-5 py-3">
                          <div>
                            <p className="text-sm font-semibold" style={{ color: "#27295C" }}>{appt.clientName}</p>
                            <p className="text-xs" style={{ color: "#6B7280" }}>{appt.clientCompany} · {new Date(appt.scheduledAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {appt.outcome && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#F3F4F6", color: "#374151" }}>{appt.outcome.replace(/_/g," ")}</span>}
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#DBEAFE", color: "#1E40AF" }}>{appt.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Finanzas tab */}
          {tab === "finanzas" && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl p-5 border" style={{ borderColor: "#E5E7EB" }}>
                  <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#9CA3AF" }}>Facturado</p>
                  <p className="text-2xl font-bold" style={{ color: "#27295C" }}>
                    USD ${invoices.reduce((s, inv) => s + (inv.totalAmt || inv.total || 0), 0).toLocaleString("en-US")}
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-5 border" style={{ borderColor: "#E5E7EB" }}>
                  <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#9CA3AF" }}>Pago recibido</p>
                  <p className="text-2xl font-bold" style={{ color: "#22C55E" }}>
                    USD ${invoices.reduce((s, inv) => s + ((inv.totalAmt || inv.total || 0) - (inv.balance || 0)), 0).toLocaleString("en-US")}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm" style={{ color: "#6B7280" }}>Invoices en QuickBooks</p>
                <button onClick={loadInvoices} className="px-3 py-1.5 rounded-lg text-xs border" style={{ borderColor: "#E5E7EB", color: "#6B7280" }}>↻ Actualizar</button>
              </div>
              <div className="rounded-2xl bg-white border overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
                <div className="px-5 py-3.5 border-b" style={{ borderColor: "#F0F0F0", background: "#F8F9FB" }}>
                  <p className="text-sm font-semibold" style={{ color: "#27295C" }}>Invoices ({invoices.length})</p>
                </div>
                {loadingInvoices ? (
                  <div className="text-center py-10"><Loader2 className="w-5 h-5 animate-spin mx-auto" style={{ color: "#C9A84C" }} /></div>
                ) : invoices.length === 0 ? (
                  <div className="text-center py-10"><p className="text-sm" style={{ color: "#9CA3AF" }}>No hay invoices pendientes</p></div>
                ) : (
                  <div className="divide-y" style={{ borderColor: "#F0F0F0" }}>
                    {invoices.map(inv => (
                      <div key={inv.id} className="flex items-center justify-between px-5 py-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <p className="text-sm font-semibold" style={{ color: "#27295C" }}>{inv.customerName || inv.proposalNum}</p>
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: inv.invoiceSentAt ? "#DCFCE7" : "#FEF9C3", color: inv.invoiceSentAt ? "#166534" : "#854D0E" }}>
                              {inv.invoiceSentAt ? "✅ Enviado" : "⏳ Pendiente"}
                            </span>
                          </div>
                          <p className="text-xs" style={{ color: "#9CA3AF" }}>
                            {inv.proposalNum} · USD ${inv.total.toLocaleString("en-US")}
                            {inv.dueDate ? ` · Vence: ${inv.dueDate}` : ""}
                          </p>
                        </div>
                        <button
                          onClick={() => sendInvoice(inv.id)}
                          disabled={sendingInvoice === inv.id}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold"
                          style={{ background: inv.invoiceSentAt ? "#F3F4F6" : "#C9A84C", color: inv.invoiceSentAt ? "#6B7280" : "#1A1C3E" }}>
                          {sendingInvoice === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : inv.invoiceSentAt ? "↻ Reenviar" : "📧 Enviar factura"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Metrics tab */}
          {tab === "metrics" && (
            loadingMetrics ? (
              <div className="text-center py-16">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" style={{ color: "#C9A84C" }} />
                <p className="text-sm" style={{ color: "#9CA3AF" }}>Cargando metricas...</p>
              </div>
            ) : metrics ? (
              <MetricsView metrics={metrics} />
            ) : null
          )}

        </div>
      </main>

      {showCreate && (
        <CreateUserModal onClose={() => setShowCreate(false)} onCreated={loadUsers} />
      )}
    </div>
  );
}
