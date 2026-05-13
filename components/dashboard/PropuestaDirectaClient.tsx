"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Send, Loader2, Check, X, ArrowLeft, Plus, Trash2 } from "lucide-react";

const CATALOG = [
  // ALIMENTOS Y BEBIDAS
  { category: "Alimentos y Bebidas", name: "Registro Establecimiento FDA", price: 595, description: "Registro oficial ante la FDA. Obligatorio para exportar alimentos a EE.UU. Incluye DUNS sin cargo." },
  { category: "Alimentos y Bebidas", name: "Registro Estab. enlatados / bajos en ácidos / acidificados", price: 950, description: "Registro especializado para productos enlatados, de bajo ácido y acidificados." },
  { category: "Alimentos y Bebidas", name: "Renovación anual establecimiento FDA", price: 499, description: "Renovación bianual obligatoria del registro FDA de su establecimiento." },
  { category: "Alimentos y Bebidas", name: "Registro por producto enlatados / bajos en ácidos / acidificados", price: 195, description: "Registro individual por producto para enlatados y productos de bajo ácido." },
  { category: "Alimentos y Bebidas", name: "Revisión de etiquetas (1ra etiqueta)", price: 595, description: "Revisión y aprobación de etiqueta conforme lineamientos FDA." },
  { category: "Alimentos y Bebidas", name: "Revisión de etiquetas (etiquetas adicionales)", price: 185, description: "Revisión de cada etiqueta adicional luego de la primera." },
  { category: "Alimentos y Bebidas", name: "FSVP", price: 395, description: "Foreign Supplier Verification Program. Requerido para importadores de alimentos en EE.UU." },
  // BEBIDAS ALCOHÓLICAS
  { category: "Bebidas Alcohólicas", name: "Licencia en Florida para vino y cerveza", price: 6000, description: "Licencia en Florida para importación y distribución de vinos y cervezas." },
  { category: "Bebidas Alcohólicas", name: "Licencia en Florida para otras bebidas alcohólicas", price: 7500, description: "Licencia para importación y distribución de bebidas destiladas en Florida." },
  // USDA
  { category: "USDA", name: "Registro en USDA Frutas y verduras", price: 1500, description: "Registro USDA para exportación de frutas y verduras frescas." },
  { category: "USDA", name: "Registro en USDA VS Permit", price: 1500, description: "Permiso veterinario USDA para productos de origen animal." },
  // COSMÉTICOS
  { category: "Cosméticos", name: "Registro Establecimiento FDA (Cosméticos)", price: 595, description: "Registro FDA para establecimientos productores de cosméticos." },
  { category: "Cosméticos", name: "Registro por producto (Cosméticos)", price: 195, description: "Registro individual de producto cosmético ante la FDA." },
  { category: "Cosméticos", name: "Revisión de etiquetas (1ra etiqueta) — Cosméticos", price: 595, description: "Revisión del primer rótulo para cosméticos conforme FDA." },
  { category: "Cosméticos", name: "Revisión de etiquetas (etiquetas adicionales) — Cosméticos", price: 185, description: "Revisión de rótulo adicional para cosméticos." },
  // MEDICAMENTOS
  { category: "Medicamentos", name: "Registro Establecimiento FDA (Medicamentos)", price: 595, description: "Registro FDA para establecimientos de medicamentos." },
  { category: "Medicamentos", name: "Registro por producto (Medicamentos)", price: 195, description: "Registro individual de producto medicinal ante la FDA." },
  { category: "Medicamentos", name: "Revisión de etiquetas (1ra etiqueta) — Medicamentos", price: 595, description: "Revisión del primer rótulo para medicamentos conforme FDA." },
  { category: "Medicamentos", name: "Revisión de etiquetas (etiquetas adicionales) — Medicamentos", price: 185, description: "Revisión de rótulo adicional para medicamentos." },
  // MEDICAL DEVICES
  { category: "Medical Devices", name: "Registro Establecimiento FDA (Medical Devices)", price: 595, description: "Registro FDA para fabricantes y distribuidores de dispositivos médicos." },
  { category: "Medical Devices", name: "Registro por producto (Medical Device)", price: 195, description: "Registro individual de cada dispositivo médico ante la FDA." },
  { category: "Medical Devices", name: "Revisión de etiquetas (1ra etiqueta) — Medical Devices", price: 595, description: "Revisión del primer rótulo para devices conforme FDA." },
  { category: "Medical Devices", name: "Revisión de etiquetas (etiquetas adicionales) — Medical Devices", price: 185, description: "Revisión de rótulo adicional para medical devices." },
  // APERTURA DE EMPRESA
  { category: "Apertura de Empresa", name: "Registro de Empresa LLC en Miami", price: 1100, description: "Constitución completa de LLC en Miami, Florida." },
  { category: "Apertura de Empresa", name: "Operating Agreement", price: 450, description: "Redacción del acuerdo operacional para su LLC." },
  // NOAA & US FISHERIES
  { category: "NOAA & US Fisheries", name: "NOAA Fisheries", price: 1500, description: "Registro ante NOAA para productos pesqueros de exportación a EE.UU." },
  { category: "NOAA & US Fisheries", name: "USFWS (US Fish & Wildlife Service)", price: 950, description: "Permiso US Fish & Wildlife Service para productos de fauna silvestre." },
  // MARCAS USPTO
  { category: "Registro de Marca USPTO", name: "Registro de Marca — Paquete Básico (LLC mandatory)", price: 2000, description: "Registro de marca en USPTO — Paquete Básico. Requiere LLC." },
  { category: "Registro de Marca USPTO", name: "Registro de Marca — Paquete Premium (LLC mandatory)", price: 3000, description: "Registro de marca USPTO con cobertura ampliada. Requiere LLC." },
  // CURSOS
  { category: "Cursos", name: "Buenas Prácticas de Manufactura (BPM)", price: 299, description: "Alimentos, Suplementos dietarios, Cosméticos y Medicamentos." },
  // OTROS
  { category: "Otros", name: "US Agent Inbox (Monthly Fee)", price: 99, description: "Servicio mensual de US Agent Inbox para notificaciones FDA." },
];

const CATEGORIES = [...new Set(CATALOG.map(s => s.category))];

interface SelectedService { name: string; description: string; price: number; qty: number; }
interface User { id: string; fullName: string; email: string; role: string; }

export default function PropuestaDirectaClient({ user }: { user: User }) {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [clientEmails, setClientEmails] = useState<string[]>([""]);
  const [lang, setLang] = useState<"es" | "en" | "pt">("es");
  const [selected, setSelected] = useState<SelectedService[]>([]);
  const [discount, setDiscount] = useState(0);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [emailText, setEmailText] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientTaxId, setClientTaxId] = useState("");
  const [customName, setCustomName] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const subtotal = selected.reduce((s, svc) => s + svc.price * svc.qty, 0);
  const total = subtotal - discount;
  const validEmails = clientEmails.filter(e => e.trim() && e.includes("@"));
  const filteredCatalog = CATALOG.filter(s =>
    (!selectedCat || s.category === selectedCat) &&
    (!searchQ || s.name.toLowerCase().includes(searchQ.toLowerCase()) || s.category.toLowerCase().includes(searchQ.toLowerCase()))
  );

  function toggleService(svc: typeof CATALOG[0]) {
    const exists = selected.find(s => s.name === svc.name);
    if (exists) setSelected(prev => prev.filter(s => s.name !== svc.name));
    else setSelected(prev => [...prev, { name: svc.name, description: svc.description, price: svc.price, qty: 1 }]);
  }

  function updateQty(name: string, qty: number) {
    if (qty < 1) return;
    setSelected(prev => prev.map(s => s.name === name ? { ...s, qty } : s));
  }

  function updatePrice(name: string, price: number) {
    if (isNaN(price) || price < 0) return;
    setSelected(prev => prev.map(s => s.name === name ? { ...s, price } : s));
  }

  function addEmail() { setClientEmails(prev => [...prev, ""]); }
  function removeEmail(i: number) { setClientEmails(prev => prev.filter((_, idx) => idx !== i)); }
  function updateEmail(i: number, val: string) { setClientEmails(prev => prev.map((e, idx) => idx === i ? val : e)); }

  function addCustomService() {
    if (!customName || !customPrice || isNaN(Number(customPrice))) return;
    const name = customName.trim();
    if (selected.find(s => s.name === name)) return;
    setSelected(prev => [...prev, { name, description: customDesc.trim(), price: Number(customPrice), qty: 1 }]);
    setCustomName("");
    setCustomDesc("");
    setCustomPrice("");
  }

  async function handleSend() {
    setError("");
    if (!clientName || validEmails.length === 0 || !selected.length) {
      setError("Completá nombre, al menos un email válido y un servicio.");
      return;
    }
    setSending(true);
    try {
      // Send to each email
      for (const email of validEmails) {
        await fetch("/api/proposals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            services: selected.map(s => ({ name: s.name, description: s.description, price: s.price * s.qty })),
            discount,
            lang,
            directClientName: clientName,
            directClientCompany: clientCompany || clientName,
            directClientEmail: email.trim(),
            emailText: emailText || undefined,
            clientAddress: clientAddress || undefined,
          }),
        });
      }
      setSent(true);
    } catch { setError("Error de conexión"); }
    setSending(false);
  }

  if (sent) return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#F8F9FB" }}>
      <div className="bg-white rounded-2xl p-10 text-center shadow-sm border max-w-md w-full" style={{ borderColor: "#E5E7EB" }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#DCFCE7" }}>
          <Check className="w-8 h-8" style={{ color: "#22C55E" }} />
        </div>
        <p className="text-xl font-bold mb-2" style={{ color: "#27295C" }}>Propuesta enviada</p>
        <p className="text-sm mb-1" style={{ color: "#6B7280" }}>
          Enviada a {validEmails.length} {validEmails.length === 1 ? "destinatario" : "destinatarios"}.
        </p>
        <p className="text-sm mb-6" style={{ color: "#6B7280" }}>El cliente recibió el PDF por email con el botón de aceptación.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => { setSent(false); setClientName(""); setClientCompany(""); setClientEmails([""]); setSelected([]); setDiscount(0); setEmailText(""); setClientAddress(""); }}
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
                    style={{ borderColor: "#E5E7EB", color: "#27295C" }} placeholder="Juan García" />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest font-semibold mb-1.5" style={{ color: "#9CA3AF" }}>Empresa</label>
                  <input value={clientCompany} onChange={e => setClientCompany(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
                    style={{ borderColor: "#E5E7EB", color: "#27295C" }} placeholder="Empresa S.A." />
                </div>

                {/* Multiple emails */}
                <div className="sm:col-span-2">
                  <label className="block text-xs uppercase tracking-widest font-semibold mb-1.5" style={{ color: "#9CA3AF" }}>
                    Email(s) *
                    <span className="ml-2 font-normal normal-case" style={{ color: "#C9A84C" }}>— se envía a cada dirección</span>
                  </label>
                  <div className="space-y-2">
                    {clientEmails.map((email, i) => (
                      <div key={i} className="flex gap-2">
                        <input type="email" value={email} onChange={e => updateEmail(i, e.target.value)}
                          className="flex-1 px-4 py-2.5 rounded-xl border text-sm outline-none"
                          style={{ borderColor: "#E5E7EB", color: "#27295C" }}
                          placeholder="email@empresa.com" />
                        {clientEmails.length > 1 && (
                          <button onClick={() => removeEmail(i)} className="p-2.5 rounded-xl border hover:bg-red-50"
                            style={{ borderColor: "#E5E7EB", color: "#EF4444" }}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button onClick={addEmail}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border"
                      style={{ borderColor: "#C9A84C", color: "#C9A84C" }}>
                      <Plus className="w-3.5 h-3.5" /> Agregar email
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs uppercase tracking-widest font-semibold mb-1.5" style={{ color: "#9CA3AF" }}>
                    Dirección <span style={{ color: "#C9A84C", fontWeight: 400, textTransform: "none" }}>(opcional)</span>
                  </label>
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
                {(["es", "en", "pt"] as const).map(l => (
                  <button key={l} onClick={() => setLang(l)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold uppercase"
                    style={{ background: lang === l ? "#27295C" : "#F3F4F6", color: lang === l ? "white" : "#6B7280" }}>
                    {l === "es" ? "🇪🇸 ES" : l === "en" ? "🇺🇸 EN" : "🇧🇷 PT"}
                  </button>
                ))}
              </div>
            </div>

            {/* Email body */}
            <div className="bg-white rounded-2xl p-5 border" style={{ borderColor: "#E5E7EB" }}>
              <p className="text-sm font-semibold mb-2" style={{ color: "#27295C" }}>
                Mensaje del email <span className="font-normal text-xs" style={{ color: "#9CA3AF" }}>(opcional)</span>
              </p>
              <textarea value={emailText} onChange={e => setEmailText(e.target.value)} rows={3}
                className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none"
                style={{ borderColor: "#E5E7EB", color: "#27295C" }}
                placeholder="Texto personalizado para el cuerpo del email..." />
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
              <div className="divide-y overflow-y-auto" style={{ maxHeight: 360, borderColor: "#F8F9FB" }}>
                {filteredCatalog.map((svc, i) => {
                  const isSelected = !!selected.find(s => s.name === svc.name);
                  const selectedItem = selected.find(s => s.name === svc.name);
                  return (
                    <div key={i} className="flex items-center px-5 py-3 hover:bg-gray-50"
                      style={{ cursor: "pointer" }} onClick={() => toggleService(svc)}>
                      <div className="flex-1 pr-4" onClick={e => isSelected && e.stopPropagation()}>
                        <p className="text-sm font-medium" style={{ color: "#27295C" }}>{svc.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{svc.description}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-sm font-bold" style={{ color: "#C9A84C" }}>${svc.price.toLocaleString("en-US")}</span>
                        {isSelected && (
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <button onClick={() => updateQty(svc.name, (selectedItem?.qty || 1) - 1)}
                              className="w-6 h-6 rounded-lg flex items-center justify-center text-sm font-bold"
                              style={{ background: "#F3F4F6", color: "#27295C" }}>−</button>
                            <span className="w-6 text-center text-sm font-semibold" style={{ color: "#27295C" }}>
                              {selectedItem?.qty || 1}
                            </span>
                            <button onClick={() => updateQty(svc.name, (selectedItem?.qty || 1) + 1)}
                              className="w-6 h-6 rounded-lg flex items-center justify-center text-sm font-bold"
                              style={{ background: "#F3F4F6", color: "#27295C" }}>+</button>
                          </div>
                        )}
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

            {/* Custom service */}
            <div className="bg-white rounded-2xl border p-5" style={{ borderColor: "#E5E7EB" }}>
              <p className="text-sm font-semibold mb-3" style={{ color: "#27295C" }}>
                Servicio personalizado <span className="font-normal text-xs" style={{ color: "#9CA3AF" }}>(no está en el catálogo)</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs uppercase tracking-widest font-semibold mb-1.5" style={{ color: "#9CA3AF" }}>Nombre del servicio</label>
                  <input value={customName} onChange={e => setCustomName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
                    style={{ borderColor: "#E5E7EB", color: "#27295C" }} placeholder="Ej: Consultoría especial" />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest font-semibold mb-1.5" style={{ color: "#9CA3AF" }}>Precio USD</label>
                  <input type="number" value={customPrice} onChange={e => setCustomPrice(e.target.value)} min={0}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
                    style={{ borderColor: "#E5E7EB", color: "#27295C" }} placeholder="0" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs uppercase tracking-widest font-semibold mb-1.5" style={{ color: "#9CA3AF" }}>Descripción <span style={{ fontWeight: 400, textTransform: "none" as const, color: "#C9A84C" }}>(opcional)</span></label>
                  <input value={customDesc} onChange={e => setCustomDesc(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
                    style={{ borderColor: "#E5E7EB", color: "#27295C" }} placeholder="Descripción del servicio..." />
                </div>
                <div className="flex items-end">
                  <button onClick={addCustomService} disabled={!customName || !customPrice}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={{ background: (!customName || !customPrice) ? "#F3F4F6" : "#27295C", color: (!customName || !customPrice) ? "#9CA3AF" : "white" }}>
                    <Plus className="w-4 h-4" /> Agregar
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border p-5 sticky top-6" style={{ borderColor: "#E5E7EB" }}>
              <p className="text-sm font-semibold mb-4" style={{ color: "#27295C" }}>Resumen</p>
              {selected.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: "#9CA3AF" }}>Seleccioná servicios del catálogo</p>
              ) : (
                <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                  {selected.map((svc, i) => (
                    <div key={i} className="space-y-1.5 pb-2 border-b" style={{ borderColor: "#F0F0F0" }}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs flex-1" style={{ color: "#374151" }}>{svc.name}</p>
                        <button onClick={() => setSelected(prev => prev.filter(s => s.name !== svc.name))}>
                          <X className="w-3.5 h-3.5" style={{ color: "#9CA3AF" }} />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs" style={{ color: "#9CA3AF" }}>$</span>
                        <input type="number" value={svc.price} onChange={e => updatePrice(svc.name, Number(e.target.value))} min={0}
                          className="w-20 px-2 py-1 rounded-md border text-xs text-right outline-none"
                          style={{ borderColor: "#E5E7EB", color: "#27295C" }} />
                        <span className="text-xs" style={{ color: "#9CA3AF" }}>x</span>
                        <input type="number" value={svc.qty} onChange={e => updateQty(svc.name, Number(e.target.value))} min={1}
                          className="w-12 px-2 py-1 rounded-md border text-xs text-right outline-none"
                          style={{ borderColor: "#E5E7EB", color: "#27295C" }} />
                        <span className="text-xs font-semibold ml-auto" style={{ color: "#27295C" }}>${(svc.price * svc.qty).toLocaleString("en-US")}</span>
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
                {validEmails.length > 1 && (
                  <p className="text-xs" style={{ color: "#6B7280" }}>
                    Se enviará a {validEmails.length} destinatarios
                  </p>
                )}
              </div>
              {error && <p className="text-xs mt-3" style={{ color: "#EF4444" }}>{error}</p>}
              <button onClick={handleSend}
                disabled={sending || !clientName || validEmails.length === 0 || selected.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm mt-4 transition-all"
                style={{
                  background: (!clientName || validEmails.length === 0 || selected.length === 0) ? "#F3F4F6" : "#C9A84C",
                  color: (!clientName || validEmails.length === 0 || selected.length === 0) ? "#9CA3AF" : "#1A1C3E"
                }}>
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
