"use client";

import { useState } from "react";
import { X, FileText, Send, Plus, Minus, Loader2, Check } from "lucide-react";
import { CATALOGS, CAT_COLORS, remapServices, Service } from "../../lib/catalog";


interface SelectedService {
  name: string;
  description: string;
  price: number;
  qty: number;
}

interface ProposalModalProps {
  appointmentId: string;
  clientName: string;
  clientCompany: string;
  clientEmail?: string;
  repSlug?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ProposalModal({ appointmentId, clientName, clientCompany, clientEmail: initialClientEmail = "", onClose, onSuccess }: ProposalModalProps) {
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedService[]>([]);
  const [discount, setDiscount] = useState(0);
  const [lang, setLang] = useState<"es" | "en" | "pt">("es");
  const [tab, setTab] = useState<"services" | "email" | "preview">("services");

  const DEFAULT_INTRO: Record<string, string> = {
    es: `Estimado/a ${clientName.split(" ")[0]}, es un placer presentarle esta propuesta para acompañarle en el proceso de ingreso al mercado estadounidense. Nuestro equipo ha preparado una solución personalizada basada en los requerimientos de ${clientCompany || "su empresa"}.`,
    en: `Dear ${clientName.split(" ")[0]}, it is our pleasure to present this proposal to accompany you in the process of entering the US market. Our team has prepared a personalized solution based on the requirements of ${clientCompany || "your company"}.`,
    pt: `Prezado/a ${clientName.split(" ")[0]}, é um prazer apresentar-lhe esta proposta para acompanhá-lo no processo de entrada no mercado americano. Nossa equipe preparou uma solução personalizada com base nos requisitos de ${clientCompany || "sua empresa"}.`,
  };

  const DEFAULT_EMAIL: Record<string, string> = {
    es: `Adjunto encontrará la propuesta comercial personalizada que preparamos para ${clientCompany || "su empresa"}. La misma incluye todos los servicios acordados. La propuesta es válida por 15 días. Para confirmarla y dar inicio a los trámites, simplemente responda este email.`,
    en: `Please find attached the personalized commercial proposal we prepared for ${clientCompany || "your company"}. It includes all agreed services. The proposal is valid for 15 days. To confirm it and start the process, simply reply to this email.`,
    pt: `Em anexo encontrará a proposta comercial personalizada que preparamos para ${clientCompany || "sua empresa"}. Ela inclui todos os serviços acordados. A proposta é válida por 15 dias. Para confirmá-la e iniciar os trâmites, basta responder a este email.`,
  };

  const [introText, setIntroText] = useState(DEFAULT_INTRO.es);
  const [emailText, setEmailText] = useState(DEFAULT_EMAIL.es);

  const [sending, setSending] = useState(false);
  const [clientEmail, setClientEmail] = useState(initialClientEmail || "");
  const [clientAddress, setClientAddress] = useState("");
  const [clientTaxId, setClientTaxId] = useState("");
  const [sent, setSent] = useState(false);
  const [searchQ, setSearchQ] = useState("");

  const activeCatalog = CATALOGS[lang];
  const categories = [...new Set(activeCatalog.map(s => s.category))];
  const filteredCatalog = activeCatalog.filter(s => {
    const matchCat = !selectedCat || s.category === selectedCat;
    const matchQ = !searchQ || s.name.toLowerCase().includes(searchQ.toLowerCase());
    return matchCat && matchQ;
  });

  const subtotal = selected.reduce((s, svc) => s + svc.price * svc.qty, 0);
  const total = subtotal - discount;

  function toggleService(svc: Service) {
    const exists = selected.find(s => s.name === svc.name);
    if (exists) {
      setSelected(prev => prev.filter(s => s.name !== svc.name));
    } else {
      setSelected(prev => [...prev, { name: svc.name, description: svc.description, price: svc.price, qty: 1 }]);
    }
  }

  // When language changes, re-map selected services to new language equivalents
  function handleLangChange(l: "es" | "en" | "pt") {
    setLang(l);
    setIntroText(DEFAULT_INTRO[l]);
    setEmailText(DEFAULT_EMAIL[l]);
    setSelected(prev => remapServices(prev, l));
    setSelectedCat(null);
  }

  function updateQty(name: string, delta: number) {
    setSelected(prev => prev.map(s => s.name === name ? { ...s, qty: Math.max(1, s.qty + delta) } : s));
  }

  function updatePrice(name: string, price: number) {
    if (isNaN(price) || price < 0) return;
    setSelected(prev => prev.map(s => s.name === name ? { ...s, price } : s));
  }

  async function handleSend() {
    if (!selected.length) return;
    setSending(true);
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          services: selected.map(s => ({ name: s.name, description: s.description, price: s.price * s.qty })),
          discount,
          introText,
          emailText,
          lang,
          clientEmail: clientEmail || undefined,
          clientAddress: clientAddress || undefined,
          clientTaxId: clientTaxId || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSent(true);
        setTimeout(() => { onSuccess(); onClose(); }, 2000);
      }
    } catch (err) { console.error("Proposal error:", err); alert("Error: " + String(err)); }
    setSending(false);
  }

  if (sent) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl p-10 text-center shadow-2xl">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#DCFCE7" }}>
          <Check className="w-8 h-8" style={{ color: "#22C55E" }} />
        </div>
        <p className="text-xl font-bold mb-2" style={{ color: "#27295C" }}>Propuesta enviada</p>
        <p className="text-sm" style={{ color: "#6B7280" }}>El cliente recibio el PDF por email y el lead fue actualizado en Zoho.</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full flex flex-col" style={{ maxWidth: 900, maxHeight: "92vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#E5E7EB" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(39,41,92,0.08)" }}>
              <FileText className="w-5 h-5" style={{ color: "#27295C" }} />
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: "#27295C" }}>Generar propuesta</p>
              <p className="text-xs" style={{ color: "#9CA3AF" }}>{clientName} · {clientCompany}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4" style={{ color: "#6B7280" }} />
          </button>
        </div>

        {/* Email del cliente editable */}
        <div className="px-6 py-3 border-b" style={{ borderColor: "#F0F0F0", background: "#F8F9FB" }}>
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold uppercase tracking-widest whitespace-nowrap" style={{ color: "#9CA3AF" }}>Email</label>
            <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg border text-sm outline-none"
              style={{ borderColor: "#E5E7EB", color: "#27295C", background: "white" }}
              placeholder="email@empresa.com" />
          </div>
          <div className="flex items-center gap-3 mt-2">
            <label className="text-xs font-semibold uppercase tracking-widest whitespace-nowrap" style={{ color: "#9CA3AF" }}>Dirección</label>
            <input type="text" value={clientAddress} onChange={e => setClientAddress(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg border text-sm outline-none"
              style={{ borderColor: "#E5E7EB", color: "#27295C", background: "white" }}
              placeholder="Calle 123, Ciudad, País (opcional)" />
          </div>
          <div className="flex items-center gap-3 mt-2">
            <label className="text-xs font-semibold uppercase tracking-widest whitespace-nowrap" style={{ color: "#9CA3AF" }}>ID Tributario</label>
            <input type="text" value={clientTaxId} onChange={e => setClientTaxId(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg border text-sm outline-none"
              style={{ borderColor: "#E5E7EB", color: "#27295C", background: "white" }}
              placeholder="EIN, RFC, CUIT... (opcional)" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6" style={{ borderColor: "#E5E7EB" }}>
          {[
            { key: "services", label: `Servicios${selected.length ? ` (${selected.length})` : ""}` },
            { key: "email", label: "Texto del email" },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
              className="px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-all"
              style={{ borderBottomColor: tab === t.key ? "#27295C" : "transparent", color: tab === t.key ? "#27295C" : "#9CA3AF" }}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-1 overflow-hidden">

          {/* LEFT: Catalog or Email */}
          <div className="flex-1 overflow-y-auto">

            {tab === "services" && (
              <div className="p-5">
                {/* Search */}
                <input
                  value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  placeholder="Buscar servicio..."
                  className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none mb-4"
                  style={{ borderColor: "#E5E7EB", color: "#27295C" }}
                />

                {/* Language selector */}
                <div className="flex gap-1.5 mb-4">
                  {([["es","Español"],["en","English"],["pt","Português"]] as const).map(([l, label]) => (
                    <button key={l} onClick={() => handleLangChange(l)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{ background: lang === l ? "#27295C" : "#F3F4F6", color: lang === l ? "white" : "#6B7280" }}>
                      {label}
                    </button>
                  ))}
                </div>
        {/* Category filter */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  <button onClick={() => setSelectedCat(null)}
                    className="px-3 py-1 rounded-full text-xs font-semibold"
                    style={{ background: !selectedCat ? "#27295C" : "#F3F4F6", color: !selectedCat ? "white" : "#6B7280" }}>
                    Todos
                  </button>
                  {categories.map(cat => (
                    <button key={cat} onClick={() => setSelectedCat(selectedCat === cat ? null : cat)}
                      className="px-3 py-1 rounded-full text-xs font-semibold"
                      style={{
                        background: selectedCat === cat ? (CAT_COLORS[cat] || "#6366F1") : "#F3F4F6",
                        color: selectedCat === cat ? "white" : "#6B7280",
                      }}>
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Service cards */}
                <div className="space-y-2">
                  {filteredCatalog.map(svc => {
                    const isSelected = selected.some(s => s.name === svc.name);
                    const catColor = CAT_COLORS[svc.category] || "#6366F1";
                    return (
                      <div key={svc.name}
                        onClick={() => toggleService(svc)}
                        className="flex items-center gap-3 p-3.5 rounded-xl cursor-pointer transition-all"
                        style={{
                          border: `1.5px solid ${isSelected ? catColor : "#E5E7EB"}`,
                          background: isSelected ? `${catColor}08` : "white",
                        }}>
                        <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                          style={{ background: isSelected ? catColor : "#F3F4F6", border: `1.5px solid ${isSelected ? catColor : "#E5E7EB"}` }}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: "#27295C" }}>{svc.name}</p>
                          <p className="text-xs truncate" style={{ color: "#9CA3AF" }}>{svc.description}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold" style={{ color: isSelected ? catColor : "#27295C" }}>${svc.price.toLocaleString("en-US")}</p>
                          <p className="text-xs" style={{ color: "#9CA3AF" }}>USD</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {tab === "email" && (
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest mb-2 font-semibold" style={{ color: "#9CA3AF" }}>
                    Intro de la propuesta PDF
                  </label>
                  <textarea value={introText} onChange={e => setIntroText(e.target.value)}
                    rows={4} className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none"
                    style={{ borderColor: "#E5E7EB", color: "#374151" }} />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest mb-2 font-semibold" style={{ color: "#9CA3AF" }}>
                    Cuerpo del email al cliente
                  </label>
                  <textarea value={emailText} onChange={e => setEmailText(e.target.value)}
                    rows={6} className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none"
                    style={{ borderColor: "#E5E7EB", color: "#374151" }} />
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Summary */}
          <div className="w-72 border-l flex flex-col" style={{ borderColor: "#E5E7EB", background: "#F8F9FB" }}>
            <div className="p-4 flex-1 overflow-y-auto">
              <p className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: "#9CA3AF" }}>
                Resumen — {selected.length} servicio{selected.length !== 1 ? "s" : ""}
              </p>

              {selected.length === 0 ? (
                <p className="text-xs text-center py-8" style={{ color: "#9CA3AF" }}>Selecciona servicios del catalogo</p>
              ) : (
                <div className="space-y-2 mb-4">
                  {selected.map(svc => (
                    <div key={svc.name} className="bg-white rounded-xl p-3" style={{ border: "1px solid #E5E7EB" }}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-xs font-semibold leading-tight flex-1" style={{ color: "#27295C" }}>{svc.name}</p>
                        <button onClick={e => { e.stopPropagation(); toggleService({ name: svc.name, price: svc.price, description: svc.description, category: "" }); }}
                          className="text-gray-400 hover:text-red-500 flex-shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-xs" style={{ color: "#9CA3AF" }}>$</span>
                        <input type="number" value={svc.price} onChange={e => updatePrice(svc.name, Number(e.target.value))} min={0}
                          className="flex-1 px-2 py-1 rounded border text-xs text-right outline-none"
                          style={{ borderColor: "#E5E7EB", color: "#27295C" }} />
                        <span className="text-xs" style={{ color: "#9CA3AF" }}>c/u</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => updateQty(svc.name, -1)}
                            className="w-5 h-5 rounded flex items-center justify-center"
                            style={{ background: "#F3F4F6" }}>
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <span className="text-xs font-semibold w-4 text-center">{svc.qty}</span>
                          <button onClick={() => updateQty(svc.name, 1)}
                            className="w-5 h-5 rounded flex items-center justify-center"
                            style={{ background: "#F3F4F6" }}>
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>
                        <p className="text-sm font-bold" style={{ color: "#27295C" }}>${(svc.price * svc.qty).toLocaleString("en-US")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Discount */}
              <div className="mt-3">
                <label className="block text-xs uppercase tracking-widest font-semibold mb-1.5" style={{ color: "#9CA3AF" }}>
                  Descuento (USD)
                </label>
                <input type="number" value={discount} onChange={e => setDiscount(Number(e.target.value))}
                  min={0} className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                  style={{ borderColor: "#E5E7EB", color: "#27295C" }} />
              </div>
            </div>

            {/* Totals + Send */}
            <div className="p-4 border-t" style={{ borderColor: "#E5E7EB" }}>
              <div className="flex justify-between mb-1">
                <span className="text-xs" style={{ color: "#9CA3AF" }}>Subtotal</span>
                <span className="text-xs font-semibold" style={{ color: "#27295C" }}>${subtotal.toLocaleString("en-US")}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between mb-1">
                  <span className="text-xs" style={{ color: "#22C55E" }}>Descuento</span>
                  <span className="text-xs font-semibold" style={{ color: "#22C55E" }}>-${discount.toLocaleString("en-US")}</span>
                </div>
              )}
              <div className="flex justify-between mb-4 pt-2 border-t" style={{ borderColor: "#E5E7EB" }}>
                <span className="text-sm font-bold" style={{ color: "#27295C" }}>Total</span>
                <span className="text-lg font-bold" style={{ color: "#C9A84C" }}>USD ${total.toLocaleString("en-US")}</span>
              </div>

              <button onClick={handleSend} disabled={sending || selected.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all"
                style={{
                  background: selected.length > 0 ? "#27295C" : "#E5E7EB",
                  color: selected.length > 0 ? "white" : "#9CA3AF",
                }}>
                {sending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando PDF...</>
                  : <><Send className="w-4 h-4" /> Enviar propuesta</>}
              </button>
              <p className="text-xs text-center mt-2" style={{ color: "#9CA3AF" }}>
                Se enviara el PDF al cliente y se actualizara Zoho
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
