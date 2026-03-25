"use client";

import { useState } from "react";
import Image from "next/image";
import { CheckCircle, Loader2 } from "lucide-react";

const T = {
  es: {
    title: "Propuesta Comercial",
    from: "Preparada por",
    for: "Para",
    services: "Servicios incluidos",
    subtotal: "Subtotal",
    discount: "Descuento",
    total: "Total",
    currency: "USD",
    pending_title: "Revisá tu propuesta",
    pending_sub: "Al confirmar, generaremos tu factura automáticamente.",
    confirm_btn: "✅ Confirmo y acepto la propuesta",
    accepted_title: "¡Propuesta aceptada!",
    accepted_sub: "Recibirás tu factura por email en los próximos minutos. Nuestro equipo se pondrá en contacto contigo para coordinar los próximos pasos.",
    already_title: "Propuesta ya aceptada",
    already_sub: "Esta propuesta ya fue confirmada anteriormente.",
    loading: "Procesando...",
    footer: "FastForward Trading Company LLC · Miami, Florida · info@fastfwdus.com",
  },
  en: {
    title: "Commercial Proposal",
    from: "Prepared by",
    for: "For",
    services: "Included services",
    subtotal: "Subtotal",
    discount: "Discount",
    total: "Total",
    currency: "USD",
    pending_title: "Review your proposal",
    pending_sub: "Upon confirmation, we will automatically generate your invoice.",
    confirm_btn: "✅ I confirm and accept the proposal",
    accepted_title: "Proposal accepted!",
    accepted_sub: "You will receive your invoice by email within the next few minutes. Our team will contact you to coordinate next steps.",
    already_title: "Proposal already accepted",
    already_sub: "This proposal has already been confirmed.",
    loading: "Processing...",
    footer: "FastForward Trading Company LLC · Miami, Florida · info@fastfwdus.com",
  },
  pt: {
    title: "Proposta Comercial",
    from: "Preparada por",
    for: "Para",
    services: "Serviços incluídos",
    subtotal: "Subtotal",
    discount: "Desconto",
    total: "Total",
    currency: "USD",
    pending_title: "Revise sua proposta",
    pending_sub: "Ao confirmar, geraremos sua fatura automaticamente.",
    confirm_btn: "✅ Confirmo e aceito a proposta",
    accepted_title: "Proposta aceita!",
    accepted_sub: "Você receberá sua fatura por email nos próximos minutos. Nossa equipe entrará em contato para coordenar os próximos passos.",
    already_title: "Proposta já aceita",
    already_sub: "Esta proposta já foi confirmada anteriormente.",
    loading: "Processando...",
    footer: "FastForward Trading Company LLC · Miami, Florida · info@fastfwdus.com",
  },
};

interface ProposalConfirmClientProps {
  token: string;
  proposalNum: string;
  clientName: string;
  clientCompany: string;
  services: { name: string; description: string; price: number }[];
  discount: number;
  total: number;
  lang: "es" | "en" | "pt";
  status: string;
  repName: string;
}

export default function ProposalConfirmClient({
  token, proposalNum, clientName, clientCompany,
  services, discount, total, lang, status, repName,
}: ProposalConfirmClientProps) {
  const t = T[lang] || T.es;
  const [confirming, setConfirming] = useState(false);
  const [accepted, setAccepted] = useState(status === "accepted");
  const subtotal = services.reduce((s, svc) => s + svc.price, 0);

  async function handleConfirm() {
    setConfirming(true);
    const res = await fetch("/api/proposals/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (data.ok) setAccepted(true);
    setConfirming(false);
  }

  return (
    <div className="min-h-screen" style={{ background: "#F8F9FB" }}>
      {/* Header */}
      <div style={{ background: "#27295C" }}>
        <div className="max-w-2xl mx-auto px-6 py-5 flex items-center justify-between">
          <Image src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png"
            alt="FastForward" width={140} height={32} className="object-contain" unoptimized />
          <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: "rgba(201,168,76,0.2)", color: "#C9A84C" }}>
            {proposalNum}
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">

        {accepted ? (
          <div className="bg-white rounded-2xl p-10 text-center" style={{ border: "1px solid #E5E7EB", boxShadow: "0 4px 24px rgba(39,41,92,0.08)" }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#DCFCE7" }}>
              <CheckCircle className="w-9 h-9" style={{ color: "#22C55E" }} />
            </div>
            <h1 className="text-2xl font-bold mb-3" style={{ color: "#27295C" }}>{status === "accepted" && !confirming ? t.already_title : t.accepted_title}</h1>
            <p className="text-sm leading-relaxed" style={{ color: "#6B7280", maxWidth: 400, margin: "0 auto" }}>
              {status === "accepted" && !confirming ? t.already_sub : t.accepted_sub}
            </p>
          </div>
        ) : (
          <>
            {/* Client info */}
            <div className="bg-white rounded-2xl p-6 mb-4" style={{ border: "1px solid #E5E7EB" }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#9CA3AF" }}>{t.for}</p>
                  <p className="text-lg font-bold" style={{ color: "#27295C" }}>{clientName}</p>
                  <p className="text-sm" style={{ color: "#6B7280" }}>{clientCompany}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#9CA3AF" }}>{t.from}</p>
                  <p className="text-sm font-semibold" style={{ color: "#27295C" }}>{repName}</p>
                  <p className="text-xs" style={{ color: "#9CA3AF" }}>FastForward FDA Experts</p>
                </div>
              </div>
            </div>

            {/* Services */}
            <div className="bg-white rounded-2xl overflow-hidden mb-4" style={{ border: "1px solid #E5E7EB" }}>
              <div className="px-5 py-3 border-b" style={{ background: "#27295C", borderColor: "#1e2050" }}>
                <p className="text-xs font-bold uppercase tracking-widest text-white">{t.services}</p>
              </div>
              {services.map((svc, i) => (
                <div key={i} className="flex items-start justify-between px-5 py-4 border-b last:border-b-0"
                     style={{ borderColor: "#F0F0F0", background: i % 2 === 0 ? "white" : "#F8F9FB" }}>
                  <div className="flex-1 pr-4">
                    <p className="text-sm font-semibold" style={{ color: "#27295C" }}>{svc.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{svc.description}</p>
                  </div>
                  <p className="text-sm font-bold flex-shrink-0" style={{ color: "#27295C" }}>${svc.price.toLocaleString("en-US")}</p>
                </div>
              ))}
              {/* Totals */}
              <div className="px-5 py-3 border-t" style={{ borderColor: "#E5E7EB" }}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs" style={{ color: "#9CA3AF" }}>{t.subtotal}</span>
                  <span className="text-xs" style={{ color: "#9CA3AF" }}>${subtotal.toLocaleString("en-US")}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between mb-1">
                    <span className="text-xs" style={{ color: "#22C55E" }}>{t.discount}</span>
                    <span className="text-xs" style={{ color: "#22C55E" }}>-${discount.toLocaleString("en-US")}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t" style={{ borderColor: "#E5E7EB" }}>
                  <span className="font-bold text-sm" style={{ color: "#27295C" }}>{t.total}</span>
                  <span className="font-bold text-xl" style={{ color: "#C9A84C" }}>{t.currency} ${total.toLocaleString("en-US")}</span>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E5E7EB" }}>
              <h2 className="font-bold text-lg mb-2" style={{ color: "#27295C" }}>{t.pending_title}</h2>
              <p className="text-sm mb-5" style={{ color: "#6B7280" }}>{t.pending_sub}</p>
              <button onClick={handleConfirm} disabled={confirming}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-base transition-all"
                style={{ background: confirming ? "#E5E7EB" : "#22C55E", color: confirming ? "#9CA3AF" : "white" }}>
                {confirming ? <><Loader2 className="w-5 h-5 animate-spin" /> {t.loading}</> : t.confirm_btn}
              </button>
            </div>
          </>
        )}

        <p className="text-center text-xs mt-6" style={{ color: "#9CA3AF" }}>{t.footer}</p>
      </div>
    </div>
  );
}
