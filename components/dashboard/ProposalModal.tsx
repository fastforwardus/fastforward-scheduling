"use client";

import { useState } from "react";
import { X, FileText, Send, Plus, Minus, Loader2, Check } from "lucide-react";

interface Service {
  name: string;
  price: number;
  description: string;
  category: string;
}

const CATALOG: Service[] = [{"category": "Alimentos y Bebidas", "name": "Registro Establecimiento FDA", "price": 595, "description": "Registro oficial ante la FDA. Obligatorio para exportar alimentos a EE.UU. Incluye DUNS sin cargo."}, {"category": "Alimentos y Bebidas", "name": "Registro Establec. enlatados/acidificados", "price": 950, "description": "Registro especializado para productos enlatados, bajos en acidos y acidificados."}, {"category": "Alimentos y Bebidas", "name": "Renovacion anual FDA", "price": 499, "description": "Renovacion bianual obligatoria del registro FDA de tu establecimiento."}, {"category": "Alimentos y Bebidas", "name": "Registro por producto enlatados", "price": 195, "description": "Registro individual por producto para lineas enlatadas y acidificadas."}, {"category": "Alimentos y Bebidas", "name": "Revision de etiquetas (etiqueta 1)", "price": 595, "description": "Revision y aprobacion de etiqueta conforme lineamientos FDA. Primera etiqueta."}, {"category": "Alimentos y Bebidas", "name": "Revision de etiquetas (adicionales)", "price": 185, "description": "Revision de etiqueta adicional despues de la primera."}, {"category": "Alimentos y Bebidas", "name": "FSVP", "price": 395, "description": "Foreign Supplier Verification Program. Requerido para importadores de alimentos a EE.UU."}, {"category": "Bebidas Alcoholicas", "name": "Licencia Florida vino y cerveza", "price": 6000, "description": "Licencia en Florida para importacion y distribucion de vinos y cervezas."}, {"category": "Bebidas Alcoholicas", "name": "Licencia Florida otras bebidas", "price": 7500, "description": "Licencia para importacion y distribucion de bebidas alcoholicas destiladas en Florida."}, {"category": "USDA", "name": "Registro USDA Frutas y verduras", "price": 1500, "description": "Registro ante el USDA para exportacion de frutas y verduras frescas al mercado americano."}, {"category": "USDA", "name": "Registro USDA VS Permit", "price": 1500, "description": "Permiso veterinario USDA para productos de origen animal."}, {"category": "Cosmeticos", "name": "Registro Establecimiento FDA Cosmeticos", "price": 595, "description": "Registro FDA para establecimientos productores de cosmeticos."}, {"category": "Cosmeticos", "name": "Registro por producto Cosmeticos", "price": 195, "description": "Registro individual de cada producto cosmetico ante la FDA."}, {"category": "Cosmeticos", "name": "Revision de etiquetas Cosmeticos (1)", "price": 595, "description": "Revision de primera etiqueta para cosmeticos conforme FDA."}, {"category": "Cosmeticos", "name": "Revision de etiquetas Cosmeticos (adicional)", "price": 185, "description": "Revision de etiqueta adicional para cosmeticos."}, {"category": "Medicamentos", "name": "Registro Establecimiento FDA Medicamentos", "price": 595, "description": "Registro FDA para laboratorios y establecimientos farmaceuticos."}, {"category": "Medicamentos", "name": "Registro por producto Medicamentos", "price": 195, "description": "Registro individual de cada medicamento o suplemento ante la FDA."}, {"category": "Medicamentos", "name": "Revision de etiquetas Medicamentos (1)", "price": 595, "description": "Revision de primera etiqueta para medicamentos conforme FDA."}, {"category": "Medicamentos", "name": "Revision de etiquetas Medicamentos (adicional)", "price": 185, "description": "Revision de etiqueta adicional para medicamentos."}, {"category": "Medical Devices", "name": "Registro Establecimiento FDA Devices", "price": 595, "description": "Registro FDA para fabricantes y distribuidores de dispositivos medicos."}, {"category": "Medical Devices", "name": "Registro por producto Medical Device", "price": 195, "description": "Registro individual de cada dispositivo medico ante la FDA."}, {"category": "Medical Devices", "name": "Revision de etiquetas Devices (1)", "price": 595, "description": "Revision de primera etiqueta para devices conforme FDA."}, {"category": "Medical Devices", "name": "Revision de etiquetas Devices (adicional)", "price": 185, "description": "Revision de etiqueta adicional para medical devices."}, {"category": "Apertura de Empresa", "name": "Registro LLC en Miami", "price": 1100, "description": "Constitucion completa de empresa LLC en Miami, Florida. Incluye todos los tramites estatales."}, {"category": "Apertura de Empresa", "name": "Operating Agreement", "price": 450, "description": "Redaccion del acuerdo operativo para tu LLC."}, {"category": "NOAA & Wildlife", "name": "NOAA Fisheries", "price": 1500, "description": "Registro ante NOAA para importacion y comercializacion de productos pesqueros."}, {"category": "NOAA & Wildlife", "name": "USFWS", "price": 950, "description": "Registro ante US Fish & Wildlife Service para productos de fauna silvestre."}, {"category": "Registro de Marca", "name": "Marca USPTO Basico", "price": 2000, "description": "Registro de marca ante la USPTO — Paquete Basico. Requiere LLC."}, {"category": "Registro de Marca", "name": "Marca USPTO Premium", "price": 3000, "description": "Registro de marca USPTO con cobertura ampliada. Requiere LLC."}];

const CATALOG_EN: Service[] = [{"category": "Food & Beverage", "name": "FDA Establishment Registration", "price": 595, "description": "Official registration with the FDA. Mandatory to export food to the US. Includes DUNS number at no cost."}, {"category": "Food & Beverage", "name": "Canned/Acidified Food Establishment Registration", "price": 950, "description": "Specialized registration for canned, low-acid and acidified food products."}, {"category": "Food & Beverage", "name": "Annual FDA Renewal", "price": 499, "description": "Biennial mandatory renewal of your FDA establishment registration."}, {"category": "Food & Beverage", "name": "Product Registration - Canned", "price": 195, "description": "Individual product registration for canned and acidified product lines."}, {"category": "Food & Beverage", "name": "Label Review (1st label)", "price": 595, "description": "Label review and approval per FDA guidelines. First label."}, {"category": "Food & Beverage", "name": "Label Review (additional)", "price": 185, "description": "Additional label review after the first one."}, {"category": "Food & Beverage", "name": "FSVP", "price": 395, "description": "Foreign Supplier Verification Program. Required for US food importers."}, {"category": "Alcoholic Beverages", "name": "Florida Wine & Beer License", "price": 6000, "description": "Florida license for importation and distribution of wines and beers."}, {"category": "Alcoholic Beverages", "name": "Florida Other Alcoholic Beverages License", "price": 7500, "description": "License for importation and distribution of distilled spirits in Florida."}, {"category": "USDA", "name": "USDA Fruits & Vegetables Registration", "price": 1500, "description": "USDA registration for fresh fruit and vegetable exports to the US market."}, {"category": "USDA", "name": "USDA VS Permit", "price": 1500, "description": "USDA veterinary permit for animal-origin products."}, {"category": "Cosmetics", "name": "FDA Cosmetics Establishment Registration", "price": 595, "description": "FDA registration for cosmetic product manufacturers."}, {"category": "Cosmetics", "name": "Product Registration - Cosmetics", "price": 195, "description": "Individual FDA registration for each cosmetic product."}, {"category": "Cosmetics", "name": "Label Review - Cosmetics (1st)", "price": 595, "description": "First cosmetics label review per FDA guidelines."}, {"category": "Cosmetics", "name": "Label Review - Cosmetics (additional)", "price": 185, "description": "Additional cosmetics label review."}, {"category": "Pharmaceuticals", "name": "FDA Pharmaceutical Establishment Registration", "price": 595, "description": "FDA registration for pharmaceutical labs and establishments."}, {"category": "Pharmaceuticals", "name": "Product Registration - Pharmaceuticals", "price": 195, "description": "Individual FDA registration for each drug or supplement."}, {"category": "Pharmaceuticals", "name": "Label Review - Pharmaceuticals (1st)", "price": 595, "description": "First pharmaceutical label review per FDA guidelines."}, {"category": "Pharmaceuticals", "name": "Label Review - Pharmaceuticals (additional)", "price": 185, "description": "Additional pharmaceutical label review."}, {"category": "Medical Devices", "name": "FDA Medical Devices Establishment Registration", "price": 595, "description": "FDA registration for medical device manufacturers and distributors."}, {"category": "Medical Devices", "name": "Product Registration - Medical Device", "price": 195, "description": "Individual FDA registration for each medical device."}, {"category": "Medical Devices", "name": "Label Review - Devices (1st)", "price": 595, "description": "First medical device label review per FDA guidelines."}, {"category": "Medical Devices", "name": "Label Review - Devices (additional)", "price": 185, "description": "Additional medical device label review."}, {"category": "Company Formation", "name": "LLC Registration in Miami", "price": 1100, "description": "Complete LLC formation in Miami, Florida. Includes all state filings."}, {"category": "Company Formation", "name": "Operating Agreement", "price": 450, "description": "Drafting of the Operating Agreement for your LLC."}, {"category": "NOAA & Wildlife", "name": "NOAA Fisheries", "price": 1500, "description": "NOAA registration for seafood product importation and commercialization."}, {"category": "NOAA & Wildlife", "name": "USFWS", "price": 950, "description": "US Fish & Wildlife Service registration for wildlife products."}, {"category": "Trademark Registration", "name": "USPTO Trademark - Basic", "price": 2000, "description": "USPTO trademark registration - Basic package. LLC required."}, {"category": "Trademark Registration", "name": "USPTO Trademark - Premium", "price": 3000, "description": "USPTO trademark registration with extended coverage. LLC required."}];
const CATALOG_PT: Service[] = [{"category": "Alimentos e Bebidas", "name": "Registro de Estabelecimento FDA", "price": 595, "description": "Registro oficial perante a FDA. Obrigatório para exportar alimentos aos EUA. Inclui DUNS sem custo."}, {"category": "Alimentos e Bebidas", "name": "Registro Estab. enlatados/acidificados", "price": 950, "description": "Registro especializado para produtos enlatados, de baixa acidez e acidificados."}, {"category": "Alimentos e Bebidas", "name": "Renovação anual FDA", "price": 499, "description": "Renovação bianual obrigatória do registro FDA do seu estabelecimento."}, {"category": "Alimentos e Bebidas", "name": "Registro por produto enlatados", "price": 195, "description": "Registro individual por produto para linhas enlatadas e acidificadas."}, {"category": "Alimentos e Bebidas", "name": "Revisão de rótulos (1º rótulo)", "price": 595, "description": "Revisão e aprovação de rótulo conforme diretrizes FDA. Primeiro rótulo."}, {"category": "Alimentos e Bebidas", "name": "Revisão de rótulos (adicionais)", "price": 185, "description": "Revisão de rótulo adicional após o primeiro."}, {"category": "Alimentos e Bebidas", "name": "FSVP", "price": 395, "description": "Foreign Supplier Verification Program. Obrigatório para importadores de alimentos nos EUA."}, {"category": "Bebidas Alcoólicas", "name": "Licença Florida vinho e cerveja", "price": 6000, "description": "Licença na Flórida para importação e distribuição de vinhos e cervejas."}, {"category": "Bebidas Alcoólicas", "name": "Licença Florida outras bebidas", "price": 7500, "description": "Licença para importação e distribuição de bebidas destiladas na Flórida."}, {"category": "USDA", "name": "Registro USDA Frutas e legumes", "price": 1500, "description": "Registro no USDA para exportação de frutas e legumes frescos ao mercado americano."}, {"category": "USDA", "name": "Registro USDA VS Permit", "price": 1500, "description": "Permissão veterinária USDA para produtos de origem animal."}, {"category": "Cosméticos", "name": "Registro Estabelecimento FDA Cosméticos", "price": 595, "description": "Registro FDA para estabelecimentos produtores de cosméticos."}, {"category": "Cosméticos", "name": "Registro por produto Cosméticos", "price": 195, "description": "Registro individual de cada produto cosmético perante a FDA."}, {"category": "Cosméticos", "name": "Revisão de rótulos Cosméticos (1º)", "price": 595, "description": "Revisão do primeiro rótulo para cosméticos conforme FDA."}, {"category": "Cosméticos", "name": "Revisão de rótulos Cosméticos (adicional)", "price": 185, "description": "Revisão de rótulo adicional para cosméticos."}, {"category": "Medicamentos", "name": "Registro Estabelecimento FDA Medicamentos", "price": 595, "description": "Registro FDA para laboratórios e estabelecimentos farmacêuticos."}, {"category": "Medicamentos", "name": "Registro por produto Medicamentos", "price": 195, "description": "Registro individual de cada medicamento ou suplemento perante a FDA."}, {"category": "Medicamentos", "name": "Revisão de rótulos Medicamentos (1º)", "price": 595, "description": "Revisão do primeiro rótulo para medicamentos conforme FDA."}, {"category": "Medicamentos", "name": "Revisão de rótulos Medicamentos (adicional)", "price": 185, "description": "Revisão de rótulo adicional para medicamentos."}, {"category": "Medical Devices", "name": "Registro Estabelecimento FDA Devices", "price": 595, "description": "Registro FDA para fabricantes e distribuidores de dispositivos médicos."}, {"category": "Medical Devices", "name": "Registro por produto Medical Device", "price": 195, "description": "Registro individual de cada dispositivo médico perante a FDA."}, {"category": "Medical Devices", "name": "Revisão de rótulos Devices (1º)", "price": 595, "description": "Revisão do primeiro rótulo para devices conforme FDA."}, {"category": "Medical Devices", "name": "Revisão de rótulos Devices (adicional)", "price": 185, "description": "Revisão de rótulo adicional para medical devices."}, {"category": "Abertura de Empresa", "name": "Registro LLC em Miami", "price": 1100, "description": "Constituição completa de empresa LLC em Miami, Florida."}, {"category": "Abertura de Empresa", "name": "Operating Agreement", "price": 450, "description": "Redação do acordo operacional para sua LLC."}, {"category": "NOAA & Wildlife", "name": "NOAA Fisheries", "price": 1500, "description": "Registro no NOAA para importação e comercialização de produtos pesqueiros."}, {"category": "NOAA & Wildlife", "name": "USFWS", "price": 950, "description": "Registro no US Fish & Wildlife Service para produtos de fauna silvestre."}, {"category": "Registro de Marca", "name": "Marca USPTO Básico", "price": 2000, "description": "Registro de marca no USPTO — Pacote Básico. Requer LLC."}, {"category": "Registro de Marca", "name": "Marca USPTO Premium", "price": 3000, "description": "Registro de marca USPTO com cobertura ampliada. Requer LLC."}];

const CATALOGS: Record<string, Service[]> = { es: CATALOG, en: CATALOG_EN, pt: CATALOG_PT };

const CATEGORIES = [...new Set(CATALOG.map(s => s.category))];

const CAT_COLORS: Record<string, string> = {
  "Alimentos y Bebidas": "#6366F1",
  "Bebidas Alcoholicas": "#A855F7",
  "USDA": "#22C55E",
  "Cosmeticos": "#F43F5E",
  "Medicamentos": "#3B82F6",
  "Medical Devices": "#0EA5E9",
  "Apertura de Empresa": "#F59E0B",
  "NOAA & Wildlife": "#14B8A6",
  "Registro de Marca": "#D97706",
};

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
  repSlug?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ProposalModal({ appointmentId, clientName, clientCompany, onClose, onSuccess }: ProposalModalProps) {
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
  const [sent, setSent] = useState(false);
  const [searchQ, setSearchQ] = useState("");

  const activeCatalog = CATALOGS[lang] || CATALOG;
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
    // Remap selected services to new language by index position
    if (selected.length > 0) {
      const newCatalog = CATALOGS[l] || CATALOG;
      setSelected(prev => prev.map(sel => {
        const oldIdx = CATALOG.findIndex(s => s.name === sel.name) !== -1
          ? CATALOG.findIndex(s => s.name === sel.name)
          : (CATALOG_EN.findIndex(s => s.name === sel.name) !== -1
            ? CATALOG_EN.findIndex(s => s.name === sel.name)
            : CATALOG_PT.findIndex(s => s.name === sel.name));
        const newSvc = oldIdx >= 0 && oldIdx < newCatalog.length ? newCatalog[oldIdx] : sel;
        return { ...sel, name: newSvc.name, description: newSvc.description };
      }));
    }
  }

  function updateQty(name: string, delta: number) {
    setSelected(prev => prev.map(s => s.name === name ? { ...s, qty: Math.max(1, s.qty + delta) } : s));
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
                  {CATEGORIES.map(cat => (
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
