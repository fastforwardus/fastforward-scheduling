"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

interface Appt {
  id: string; clientName: string; clientCompany: string;
  serviceInterest: string | null; scheduledAt: string;
  status: string; outcome: string | null; createdAt: string;
}

const SERVICES = [
  {
    "category": "Alimentos y Bebidas",
    "name": "Registro Establecimiento FDA",
    "price": 595,
    "description": "Registro oficial de tu establecimiento ante la FDA. Obligatorio para exportar alimentos a EE.UU."
  },
  {
    "category": "Alimentos y Bebidas",
    "name": "Registro Establec. enlatados/acidificados",
    "price": 950,
    "description": "Registro especializado para productos enlatados, bajos en acidos y acidificados."
  },
  {
    "category": "Alimentos y Bebidas",
    "name": "Renovacion anual establecimiento FDA",
    "price": 499,
    "description": "Renovacion bianual obligatoria del registro FDA de tu establecimiento."
  },
  {
    "category": "Alimentos y Bebidas",
    "name": "Registro por producto enlatados",
    "price": 195,
    "description": "Registro individual por producto para lineas enlatadas y acidificadas."
  },
  {
    "category": "Alimentos y Bebidas",
    "name": "Revision de etiquetas (primera etiqueta)",
    "price": 595,
    "description": "Revision y aprobacion de etiqueta para cumplimiento FDA. Primera etiqueta."
  },
  {
    "category": "Alimentos y Bebidas",
    "name": "Revision de etiquetas (etiquetas adicionales)",
    "price": 185,
    "description": "Revision de etiquetas adicionales despues de la primera."
  },
  {
    "category": "Alimentos y Bebidas",
    "name": "FSVP",
    "price": 395,
    "description": "Foreign Supplier Verification Program — requerido para importadores de alimentos a EE.UU."
  },
  {
    "category": "Bebidas Alcoholicas",
    "name": "Licencia Florida vino y cerveza",
    "price": 6000,
    "description": "Registro de licencia en Florida para importacion y distribucion de vinos y cervezas."
  },
  {
    "category": "Bebidas Alcoholicas",
    "name": "Licencia Florida otras bebidas alcoholicas",
    "price": 7500,
    "description": "Licencia para importacion y distribucion de bebidas alcoholicas destiladas en Florida."
  },
  {
    "category": "USDA",
    "name": "Registro USDA Frutas y verduras",
    "price": 1500,
    "description": "Registro ante el USDA para exportacion de frutas y verduras frescas al mercado americano."
  },
  {
    "category": "USDA",
    "name": "Registro USDA VS Permit",
    "price": 1500,
    "description": "Permiso veterinario USDA para productos de origen animal."
  },
  {
    "category": "Cosmeticos",
    "name": "Registro Establecimiento FDA Cosmeticos",
    "price": 595,
    "description": "Registro FDA para establecimientos productores de cosmeticos."
  },
  {
    "category": "Cosmeticos",
    "name": "Registro por producto Cosmeticos",
    "price": 195,
    "description": "Registro individual de cada producto cosmetico ante la FDA."
  },
  {
    "category": "Medicamentos",
    "name": "Registro Establecimiento FDA Medicamentos",
    "price": 595,
    "description": "Registro FDA para laboratorios y establecimientos farmaceuticos."
  },
  {
    "category": "Medicamentos",
    "name": "Registro por producto Medicamentos",
    "price": 195,
    "description": "Registro individual de cada medicamento o suplemento ante la FDA."
  },
  {
    "category": "Medical Devices",
    "name": "Registro Establecimiento FDA Devices",
    "price": 595,
    "description": "Registro FDA para fabricantes y distribuidores de dispositivos medicos."
  },
  {
    "category": "Medical Devices",
    "name": "Registro por producto Medical Device",
    "price": 195,
    "description": "Registro individual de cada dispositivo medico ante la FDA."
  },
  {
    "category": "Apertura de Empresa",
    "name": "Registro LLC en Miami",
    "price": 1100,
    "description": "Constitucion completa de empresa LLC en Miami, Florida. Incluye todos los tramites estatales."
  },
  {
    "category": "Apertura de Empresa",
    "name": "Operating Agreement",
    "price": 450,
    "description": "Redaccion del acuerdo operativo (Operating Agreement) para tu LLC."
  },
  {
    "category": "NOAA & Wildlife",
    "name": "NOAA Fisheries",
    "price": 1500,
    "description": "Registro ante NOAA para importacion y comercializacion de productos pesqueros."
  },
  {
    "category": "NOAA & Wildlife",
    "name": "USFWS",
    "price": 950,
    "description": "Registro ante US Fish & Wildlife Service para productos de fauna silvestre."
  },
  {
    "category": "Registro de Marca",
    "name": "Marca USPTO Basico",
    "price": 2000,
    "description": "Registro de marca ante la USPTO (Oficina de Patentes y Marcas de EE.UU.) — Paquete Basico. Requiere LLC."
  },
  {
    "category": "Registro de Marca",
    "name": "Marca USPTO Premium",
    "price": 3000,
    "description": "Registro de marca USPTO con cobertura ampliada y seguimiento prioritario. Requiere LLC."
  }
];

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {"Alimentos y Bebidas": {"bg": "EEF2FF", "border": "6366F1", "text": "4338CA", "icon": "🍎"}, "Bebidas Alcoholicas": {"bg": "FDF4FF", "border": "A855F7", "text": "7E22CE", "icon": "🍷"}, "USDA": {"bg": "F0FDF4", "border": "22C55E", "text": "166534", "icon": "🌿"}, "Cosmeticos": {"bg": "FFF1F2", "border": "F43F5E", "text": "9F1239", "icon": "💄"}, "Medicamentos": {"bg": "EFF6FF", "border": "3B82F6", "text": "1D4ED8", "icon": "💊"}, "Medical Devices": {"bg": "F0F9FF", "border": "0EA5E9", "text": "0C4A6E", "icon": "🩺"}, "Apertura de Empresa": {"bg": "FFFBEB", "border": "F59E0B", "text": "92400E", "icon": "🏢"}, "NOAA & Wildlife": {"bg": "F0FDFA", "border": "14B8A6", "text": "134E4A", "icon": "🐟"}, "Registro de Marca": {"bg": "FEF3C7", "border": "D97706", "text": "78350F", "icon": "™️"}};

const STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  pending_assignment: { label: "Recibida", bg: "FEF9C3", text: "854D0E" },
  scheduled:          { label: "Agendada", bg: "DBEAFE", text: "1E40AF" },
  confirmed:          { label: "Confirmada", bg: "DCFCE7", text: "166534" },
  completed:          { label: "Completada", bg: "EDE9FE", text: "4C1D95" },
  no_show:            { label: "No-show", bg: "FEE2E2", text: "991B1B" },
};

const OUTCOME_LABELS: Record<string, string> = {
  interested: "🔥 Interesado", needs_time: "🤔 Necesita tiempo",
  not_qualified: "❌ No califica", proposal_sent: "📄 Propuesta enviada", closed: "🏆 Cerrado",
};

const categories = [...new Set(SERVICES.map(s => s.category))];

export default function PartnerDashboardClient({ slug }: { slug: string }) {
  const [tab, setTab] = useState<"referrals" | "services">("referrals");
  const [appts, setAppts] = useState<Appt[]>([]);
  const [partnerName, setPartnerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/partners");
    if (res.status === 401) { router.push(`/partner/${slug}`); return; }
    const data = await res.json();
    setAppts(data.appointments || []);
    setPartnerName(data.partnerName || "");
    setLoading(false);
  }, [slug, router]);

  useEffect(() => { load(); }, [load]);

  const total = appts.length;
  const completed = appts.filter(a => a.status === "completed").length;
  const closed = appts.filter(a => a.outcome === "closed").length;
  const pending = appts.filter(a => ["pending_assignment","scheduled","confirmed"].includes(a.status)).length;

  const filteredServices = selectedCat ? SERVICES.filter(s => s.category === selectedCat) : SERVICES;
  const bookingUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/book/partner/${slug}`;

  return (
    <div className="min-h-screen" style={{ background: "#F8F9FB" }}>
      {/* Header */}
      <div style={{ background: "#27295C" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png"
              alt="FastForward" width={140} height={32} className="object-contain" unoptimized />
            <div className="hidden sm:block w-px h-8" style={{ background: "rgba(255,255,255,0.2)" }} />
            <div className="hidden sm:block">
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Portal de Partner</p>
              <p className="text-sm font-semibold text-white">{partnerName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href={bookingUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{ background: "#C9A84C", color: "#1A1C3E" }}>
              🔗 Mi link de referidos
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total referidos", value: total, color: "#27295C" },
            { label: "En proceso", value: pending, color: "#3B82F6" },
            { label: "Completadas", value: completed, color: "#8B5CF6" },
            { label: "Cerradas", value: closed, color: "#22C55E" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-5 border" style={{ borderColor: "#E5E7EB" }}>
              <p className="text-3xl font-bold mb-1" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs" style={{ color: "#6B7280" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Link box */}
        <div className="bg-white rounded-2xl p-5 border mb-6 flex items-center justify-between gap-4"
             style={{ borderColor: "#E5E7EB" }}>
          <div>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#9CA3AF" }}>Tu link exclusivo de referidos</p>
            <p className="text-sm font-mono font-semibold" style={{ color: "#27295C" }}>{bookingUrl}</p>
          </div>
          <button onClick={() => navigator.clipboard.writeText(bookingUrl)}
            className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold"
            style={{ background: "#27295C", color: "white" }}>
            Copiar
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b mb-0" style={{ borderColor: "#E5E7EB" }}>
          {[
            { key: "referrals", label: `Mis referidos (${total})` },
            { key: "services",  label: "Servicios y precios" },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
              className="flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-all"
              style={{ borderBottomColor: tab === t.key ? "#27295C" : "transparent", color: tab === t.key ? "#27295C" : "#9CA3AF" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Referrals tab */}
        {tab === "referrals" && (
          <div className="rounded-b-2xl overflow-hidden bg-white border border-t-0" style={{ borderColor: "#E5E7EB" }}>
            {loading ? (
              [1,2,3].map(i => (
                <div key={i} className="flex items-center gap-4 px-5 py-4 border-b" style={{ borderColor: "#F0F0F0" }}>
                  <div className="w-32 h-4 rounded animate-pulse" style={{ background: "#E5E7EB" }} />
                  <div className="flex-1 h-4 rounded animate-pulse" style={{ background: "#F3F4F6" }} />
                </div>
              ))
            ) : appts.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-3xl mb-3">📭</p>
                <p className="font-semibold text-sm" style={{ color: "#27295C" }}>Sin referidos aun</p>
                <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>Compartí tu link para empezar a recibir consultas</p>
              </div>
            ) : (
              appts.map(appt => {
                const st = STATUS_LABELS[appt.status] || STATUS_LABELS.scheduled;
                return (
                  <div key={appt.id} className="flex items-center gap-4 px-5 py-4 border-b hover:bg-gray-50"
                       style={{ borderColor: "#F0F0F0" }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: "#111827" }}>{appt.clientName}</p>
                      <p className="text-xs" style={{ color: "#6B7280" }}>{appt.clientCompany}
                        {appt.serviceInterest && ` · ${appt.serviceInterest.replace(/_/g," ")}`}
                      </p>
                    </div>
                    <div className="hidden sm:block text-xs" style={{ color: "#9CA3AF" }}>
                      {new Date(appt.scheduledAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "America/New_York" })}
                    </div>
                    {appt.outcome && (
                      <span className="hidden sm:block text-xs px-2 py-0.5 rounded-full" style={{ background: "#F3F4F6", color: "#374151" }}>
                        {OUTCOME_LABELS[appt.outcome]}
                      </span>
                    )}
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                          style={{ background: st.bg, color: st.text }}>{st.label}</span>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Services tab */}
        {tab === "services" && (
          <div className="pt-6">
            {/* Category filter */}
            <div className="flex flex-wrap gap-2 mb-6">
              <button onClick={() => setSelectedCat(null)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{ background: !selectedCat ? "#27295C" : "#F3F4F6", color: !selectedCat ? "white" : "#6B7280" }}>
                Todos
              </button>
              {categories.map(cat => {
                const colors = CATEGORY_COLORS[cat];
                return (
                  <button key={cat} onClick={() => setSelectedCat(selectedCat === cat ? null : cat)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                    style={{
                      background: selectedCat === cat ? `#${colors?.border || "27295C"}` : `#${colors?.bg || "F3F4F6"}`,
                      color: selectedCat === cat ? "white" : `#${colors?.text || "374151"}`,
                    }}>
                    {colors?.icon} {cat}
                  </button>
                );
              })}
            </div>

            {/* Service cards */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredServices.map((service, i) => {
                const colors = CATEGORY_COLORS[service.category] || { bg: "F3F4F6", border: "9CA3AF", text: "374151", icon: "📋" };
                return (
                  <div key={i} className="bg-white rounded-2xl p-5 border hover:shadow-md transition-all"
                       style={{ borderColor: "#E5E7EB", borderTop: `3px solid #${colors.border}` }}>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium mb-2 inline-block"
                              style={{ background: `#${colors.bg}`, color: `#${colors.text}` }}>
                          {colors.icon} {service.category}
                        </span>
                        <h3 className="text-sm font-semibold leading-snug" style={{ color: "#27295C" }}>{service.name}</h3>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-lg font-bold" style={{ color: "#C9A84C" }}>${service.price.toLocaleString()}</p>
                        <p className="text-xs" style={{ color: "#9CA3AF" }}>USD</p>
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "#6B7280" }}>{service.description}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 p-4 rounded-2xl text-center" style={{ background: "rgba(39,41,92,0.04)", border: "1px solid rgba(39,41,92,0.08)" }}>
              <p className="text-xs" style={{ color: "#6B7280" }}>
                Los precios son en USD e incluyen honorarios profesionales. No incluyen tasas gubernamentales.
                Para consultas especiales contacta a <a href="mailto:info@fastfwdus.com" style={{ color: "#C9A84C", fontWeight: 600 }}>info@fastfwdus.com</a>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
