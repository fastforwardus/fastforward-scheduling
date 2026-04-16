"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Send, Loader2, Check, X, ArrowLeft } from "lucide-react";

const CATALOG = [
  { category: "Alimentos y Bebidas", name: "Registro Establecimiento FDA", price: 595, description: "Registro oficial ante la FDA. Obligatorio para exportar alimentos a EE.UU. Incluye DUNS sin cargo." },
  { category: "Alimentos y Bebidas", name: "Registro Estab. enlatados/acidificados", price: 950, description: "Registro especializado para productos enlatados, de bajo ácido y acidificados." },
  { category: "Alimentos y Bebidas", name: "Renovacion anual FDA", price: 499, description: "Renovación bianual obligatoria del registro FDA de su establecimiento." },
  { category: "Alimentos y Bebidas", name: "Revision de etiquetas (1er etiqueta)", price: 595, description: "Revisión y aprobación de etiqueta conforme lineamientos FDA." },
  { category: "Alimentos y Bebidas", name: "Revision de etiquetas (adicional)", price: 185, description: "Revisión de etiqueta adicional." },
  { category: "Alimentos y Bebidas", name: "FSVP", price: 395, description: "Foreign Supplier Verification Program. Requerido para importadores de alimentos en EE.UU." },
  { category: "Bebidas Alcoholicas", name: "Licencia Florida vino y cerveza", price: 6000, description: "Licencia en Florida para importacion y distribucion de vinos y cervezas." },
  { category: "Bebidas Alcoholicas", name: "Licencia Florida otras bebidas", price: 7500, description: "Licencia para importacion y distribucion de bebidas destiladas en Florida." },
  { category: "USDA", name: "Registro USDA Frutas y legumbres", price: 1500, description: "Registro USDA para exportacion de frutas y verduras frescas." },
  { category: "USDA", name: "Registro USDA VS Permit", price: 1500, description: "Permiso veterinario USDA para productos de origen animal." },
  { category: "Cosmeticos", name: "Registro Establecimiento FDA Cosmeticos", price: 595, description: "Registro FDA para establecimientos productores de cosmeticos." },
  { category: "Cosmeticos", name: "Revision de etiquetas Cosmeticos (1ra)", price: 595, description: "Revision del primer rotulo para cosmeticos conforme FDA." },
  { category: "Cosmeticos", name: "Revision de etiquetas Cosmeticos (adicional)", price: 185, description: "Revision de rotulo adicional para cosmeticos." },
  { category: "Medical Devices", name: "Registro Establecimiento FDA Devices", price: 595, description: "Registro FDA para fabricantes y distribuidores de dispositivos medicos." },
  { category: "Medical Devices", name: "Registro por producto Medical Device", price: 195, description: "Registro individual de cada dispositivo medico ante la FDA." },
  { category: "Medical Devices", name: "Revision de etiquetas Devices (1ra)", price: 595, description: "Revision del primer rotulo para devices conforme FDA." },
  { category: "Medical Devices", name: "Revision de etiquetas Devices (adicional)", price: 185, description: "Revision de rotulo adicional para medical devices." },
  { category: "Apertura de Empresa", name: "Registro LLC en Miami", price: 1100, description: "Constitucion completa de LLC en Miami, Florida." },
  { category: "Apertura de Empresa", name: "Operating Agreement", price: 450, description: "Redaccion del acuerdo operacional para su LLC." },
  { category: "Marcas", name: "Marca USPTO Basico", price: 2000, description: "Registro de marca en USPTO. Requiere LLC." },
  { category: "Marcas", name: "Marca USPTO Premium", price: 3000, description: "Registro de marca USPTO con cobertura ampliada. Requiere LLC." },
];

const CATEGORIES = [...new Set(CATALOG.map(s => s.category))];
interface SelectedService { name: string; description: string; price: number; qty: number; }

interface User { id: string; fullName: string; email: string; role: string; }

export default function PropuestaDirectaClient({ user }: { user: User }) {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [lang, setLang] = useState<"es" | "en" | "pt">("es");
  const [selected, setSelected] = useState<SelectedService[]>([]);
  const [discount, setDiscount] = useState(0);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [emailText, setEmailText] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientTaxId, setClientTaxId] = useState("");

  const subtotal = selected.reduce((s, svc) => s + svc.price * svc.qty, 0);
  const total = subtotal - discount;
  const filteredCatalog = CATALOG.filter(s => (!selectedCat || s.category === selectedCat) && (!searchQ || s.name.toLowerCase().includes(searchQ.toLowerCase())));

  function toggleService(svc: typeof CATALOG[0]) {
    const exists = selected.find(s => s.name === svc.name);
    if (exists) setSelected(prev => prev.filter(s => s.name !== svc.name));
    else setSelected(prev => [...prev, { name: svc.name, description: svc.description, price: svc.price, qty: 1 }]);
  }

  async function handleSend() {
    setError("");
    if (!clientName || !clientEmail || !selected.length) { setError("Completá nombre, email y al menos un servicio."); return; }
    setSending(true);
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ services: selected.map(s => ({ name: s.name, description: s.description, price: s.price * s.qty })), discount, lang, directClientName: clientName, directClientCompany: clientCompany || clientName, directClientEmail: clientEmail, emailText: emailText || undefined, clientAddress: clientAddress || undefined, clientTaxId: clientTaxId || undefined }),
      });
      const data = await res.json();
      if (data.ok) setSent(true);
      else setError(data.error || "Error al enviar");
    } catch { setError("Error de conexion"); }
    setSending(false);
  }

  if (sent) return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#F8F9FB" }}>
      <div className="bg-white rounded-2xl p-10 text-center shadow-sm border max-w-md w-full" style={{ borderColor: "#E5E7EB" }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#DCFCE7" }}>
          <Check className="w-8 h-8" style={{ color: "#22C55E" }} />
        </div>
        <p className="text-xl font-bold mb-2" style={{ color: "#27295C" }}>Propuesta enviada</p>
        <p className="text-sm mb-6" style={{ color: "#6B7280" }}>El cliente recibio el PDF por email con el boton de aceptacion.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => { setSent(false); setClientName(""); setClientCompany(""); setClientEmail(""); setSelected([]); setDiscount(0); }}
            className="px-5 py-2.5 rounded-xl border text-sm font-medium" style={{ borderColor: "#E5E7EB", color: "#6B7280" }}>
            Nueva propuesta
          </button>
          <button onClick={() => router.push("/dashboard")}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "#27295C", color: "white" }}>
            Ir al dashboard
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "#F8F9FB" }}>
      <div className="max-w-5xl mx-auto px-4 py-6">

        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push("/dashboard")} className="p-2 rounded-xl hover:bg-white border" style={{ borderColor: "#E5E7EB" }}>
            <ArrowLeft className="w-4 h-4" style={{ color: "#6B7280" }} />
          </button>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(39,41,92,0.08)" }}>
            <FileText className="w-5 h-5" style={{ color: "#27295C" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#27295C" }}>Enviar propuesta directa</h1>
            <p className="text-sm" style={{ color: "#9CA3AF" }}>Para clientes sin cita agendada · {user.fullName}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">

            {/* Client data */}
            <div className="bg-white rounded-2xl p-5 border" style={{ borderColor: "#E5E7EB" }}>
              <p className="text-sm font-semibold mb-4" style={{ color: "#27295C" }}>Datos del cliente</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase tracking-widest font-semibold mb-1.5" style={{ color: "#9CA3AF" }}>Nombre completo *</label>
                  <input value={clientName} onChange={e => setClientName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
                    style={{ borderColor: "#E5E7EB", color: "#27295C" }} placeholder="Juan Garcia" />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest font-semibold mb-1.5" style={{ color: "#9CA3AF" }}>Empresa</label>
                  <input value={clientCompany} onChange={e => setClientCompany(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
                    style={{ borderColor: "#E5E7EB", color: "#27295C" }} placeholder="Empresa S.A." />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs uppercase tracking-widest font-semibold mb-1.5" style={{ color: "#9CA3AF" }}>Email *</label>
                  <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
                    style={{ borderColor: "#E5E7EB", color: "#27295C" }} placeholder="email@empresa.com" />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest font-semibold mb-1.5" style={{ color: "#9CA3AF" }}>Dirección <span style={{ color: "#C9A84C", fontWeight: 400, textTransform: "none" }}>(opcional)</span></label>
                  <input type="text" value={clientAddress} onChange={e => setClientAddress(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
                    style={{ borderColor: "#E5E7EB", color: "#27295C" }} placeholder="Calle 123, Ciudad, País" />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest font-semibold mb-1.5" style={{ color: "#9CA3AF" }}>ID Tributario <span style={{ color: "#C9A84C", fontWeight: 400, textTransform: "none" }}>(opcional)</span></label>
                  <input type="text" value={clientTaxId} onChange={e => setClientTaxId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
                    style={{ borderColor: "#E5E7EB", color: "#27295C" }} placeholder="EIN, RFC, CUIT..." />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                {["es","en","pt"].map(l => (
                  <button key={l} onClick={() => setLang(l as "es"|"en"|"pt")}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold uppercase"
                    style={{ background: lang === l ? "#27295C" : "#F3F4F6", color: lang === l ? "white" : "#6B7280" }}>
                    {l === "es" ? "🇪🇸 ES" : l === "en" ? "🇺🇸 EN" : "🇧🇷 PT"}
                  </button>
                ))}
              </div>
            </div>

            {/* Email body */}
            <div className="bg-white rounded-2xl p-5 border" style={{ borderColor: "#E5E7EB" }}>
              <p className="text-sm font-semibold mb-2" style={{ color: "#27295C" }}>Mensaje del email <span className="font-normal text-xs" style={{ color: "#9CA3AF" }}>(opcional)</span></p>
              <textarea value={emailText} onChange={e => setEmailText(e.target.value)} rows={4}
                className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none"
                style={{ borderColor: "#E5E7EB", color: "#27295C" }}
                placeholder="Texto personalizado para el cuerpo del email. Si se deja en blanco se usa el texto por defecto." />
            </div>

            {/* Catalog */}
            <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
              <div className="px-5 py-3 border-b" style={{ borderColor: "#F0F0F0" }}>
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                  style={{ borderColor: "#E5E7EB", color: "#27295C" }} placeholder="Buscar servicio..." />
              </div>
              <div className="flex flex-wrap gap-1.5 px-4 py-2.5 border-b" style={{ borderColor: "#F0F0F0" }}>
                <button onClick={() => setSelectedCat(null)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ background: !selectedCat ? "#27295C" : "#F3F4F6", color: !selectedCat ? "white" : "#6B7280" }}>
                  Todos
                </button>
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setSelectedCat(selectedCat === cat ? null : cat)}
                    className="px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ background: selectedCat === cat ? "#27295C" : "#F3F4F6", color: selectedCat === cat ? "white" : "#6B7280" }}>
                    {cat}
                  </button>
                ))}
              </div>
              <div className="divide-y overflow-y-auto" style={{ maxHeight: 340, borderColor: "#F8F9FB" }}>
                {filteredCatalog.map((svc, i) => {
                  const isSelected = !!selected.find(s => s.name === svc.name);
                  return (
                    <div key={i} onClick={() => toggleService(svc)}
                      className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-gray-50">
                      <div className="flex-1 pr-4">
                        <p className="text-sm font-medium" style={{ color: "#27295C" }}>{svc.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{svc.description}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-sm font-bold" style={{ color: "#C9A84C" }}>${svc.price.toLocaleString("en-US")}</span>
                        <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                          style={{ borderColor: isSelected ? "#27295C" : "#E5E7EB", background: isSelected ? "#27295C" : "white" }}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border p-5 sticky top-6" style={{ borderColor: "#E5E7EB" }}>
              <p className="text-sm font-semibold mb-4" style={{ color: "#27295C" }}>Resumen</p>
              {selected.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: "#9CA3AF" }}>Selecciona servicios del catalogo</p>
              ) : (
                <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                  {selected.map((svc, i) => (
                    <div key={i} className="flex items-start justify-between gap-2">
                      <p className="text-xs flex-1" style={{ color: "#374151" }}>{svc.name}</p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-semibold" style={{ color: "#27295C" }}>${svc.price.toLocaleString("en-US")}</span>
                        <button onClick={() => setSelected(prev => prev.filter(s => s.name !== svc.name))}>
                          <X className="w-3.5 h-3.5" style={{ color: "#9CA3AF" }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t pt-3 space-y-3" style={{ borderColor: "#F0F0F0" }}>
                <div className="flex items-center gap-2">
                  <label className="text-xs whitespace-nowrap" style={{ color: "#9CA3AF" }}>Descuento USD</label>
                  <input type="number" value={discount} onChange={e => setDiscount(Number(e.target.value))} min={0}
                    className="flex-1 px-3 py-1.5 rounded-lg border text-sm text-right outline-none"
                    style={{ borderColor: "#E5E7EB", color: "#27295C" }} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold" style={{ color: "#27295C" }}>Total</span>
                  <span className="text-xl font-bold" style={{ color: "#C9A84C" }}>USD ${total.toLocaleString("en-US")}</span>
                </div>
              </div>
              {error && <p className="text-xs mt-3" style={{ color: "#EF4444" }}>{error}</p>}
              <button onClick={handleSend}
                disabled={sending || !clientName || !clientEmail || selected.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm mt-4 transition-all"
                style={{ background: (!clientName || !clientEmail || selected.length === 0) ? "#F3F4F6" : "#C9A84C", color: (!clientName || !clientEmail || selected.length === 0) ? "#9CA3AF" : "#1A1C3E" }}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? "Enviando..." : "Enviar propuesta →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
