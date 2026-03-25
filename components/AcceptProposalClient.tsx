"use client";
import { useState } from "react";
import Image from "next/image";

const LABELS: Record<string, Record<string, string>> = {"es": {"title": "Tu propuesta de FastForward", "subtitle": "Revisá los servicios incluidos y confirmá para proceder", "service": "Servicio", "price": "Precio", "subtotal": "Subtotal", "discount": "Descuento", "total": "Total", "confirm": "Confirmar y aceptar propuesta", "accepted": "¡Propuesta aceptada!", "acceptedMsg": "Recibimos tu confirmación. Nos pondremos en contacto para los próximos pasos.", "validity": "Esta propuesta es válida por 15 días.", "payment": "Pago: 100% al confirmar. Tarjeta, Zelle, Wire Transfer o PayPal."}, "en": {"title": "Your FastForward Proposal", "subtitle": "Review the included services and confirm to proceed", "service": "Service", "price": "Price", "subtotal": "Subtotal", "discount": "Discount", "total": "Total", "confirm": "Confirm and accept proposal", "accepted": "Proposal Accepted!", "acceptedMsg": "We received your confirmation. We will contact you for next steps.", "validity": "This proposal is valid for 15 days.", "payment": "Payment: 100% upon confirmation. Card, Zelle, Wire Transfer or PayPal."}, "pt": {"title": "Sua Proposta FastForward", "subtitle": "Revise os serviços incluídos e confirme para prosseguir", "service": "Serviço", "price": "Preço", "subtotal": "Subtotal", "discount": "Desconto", "total": "Total", "confirm": "Confirmar e aceitar proposta", "accepted": "Proposta Aceita!", "acceptedMsg": "Recebemos sua confirmação. Entraremos em contato para os próximos passos.", "validity": "Esta proposta é válida por 15 dias.", "payment": "Pagamento: 100% ao confirmar. Cartão, Zelle, Wire Transfer ou PayPal."}};

export default function AcceptProposalClient({ proposal, client }: {
  proposal: { id: string; proposalNum: string; services: string; discount: number | null; total: number; lang: string | null; status: string | null };
  client: { clientName: string; clientCompany: string; clientEmail: string } | undefined;
}) {
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(proposal.status === "accepted");
  const lang = (proposal.lang || "es") as "es" | "en" | "pt";
  const t = LABELS[lang] || LABELS.es;

  const services: { name: string; price: number }[] = JSON.parse(proposal.services || "[]");
  const discount = proposal.discount || 0;

  async function handleAccept() {
    setAccepting(true);
    await fetch(`/api/proposals/${proposal.id}/accept`, { method: "POST" });
    setAccepted(true);
    setAccepting(false);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ background: "#F8F9FB" }}>
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-8">
          <Image src="https://fastfwdus.com/wp-content/uploads/2025/05/logoR.png"
            alt="FastForward" width={160} height={40} className="object-contain" unoptimized />
        </div>

        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E5E7EB", boxShadow: "0 4px 24px rgba(39,41,92,0.08)" }}>
          <div style={{ background: "#27295C", padding: "24px 28px" }}>
            <p className="text-white font-bold text-lg mb-1">{t.title}</p>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px" }}>{t.subtitle}</p>
          </div>

          <div className="p-6">
            {client && (
              <div className="mb-5 p-4 rounded-xl" style={{ background: "#F8F9FB", border: "1px solid #E5E7EB" }}>
                <p className="font-bold text-sm" style={{ color: "#27295C" }}>{client.clientName}</p>
                <p className="text-xs" style={{ color: "#6B7280" }}>{client.clientCompany}</p>
                <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>{proposal.proposalNum}</p>
              </div>
            )}

            <table className="w-full mb-4">
              <thead>
                <tr style={{ borderBottom: "1px solid #E5E7EB" }}>
                  <th className="text-left pb-2 text-xs uppercase tracking-widest" style={{ color: "#9CA3AF" }}>{t.service}</th>
                  <th className="text-right pb-2 text-xs uppercase tracking-widest" style={{ color: "#9CA3AF" }}>{t.price}</th>
                </tr>
              </thead>
              <tbody>
                {services.map((svc, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F0F0F0" }}>
                    <td className="py-3 text-sm" style={{ color: "#374151" }}>{svc.name}</td>
                    <td className="py-3 text-sm text-right font-semibold" style={{ color: "#27295C" }}>
                      USD ${svc.price.toLocaleString("en-US")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {discount > 0 && (
              <div className="flex justify-between mb-1">
                <span className="text-sm" style={{ color: "#22C55E" }}>{t.discount}</span>
                <span className="text-sm font-semibold" style={{ color: "#22C55E" }}>-${discount.toLocaleString("en-US")}</span>
              </div>
            )}
            <div className="flex justify-between py-3 border-t" style={{ borderColor: "#E5E7EB" }}>
              <span className="font-bold" style={{ color: "#27295C" }}>{t.total}</span>
              <span className="text-xl font-bold" style={{ color: "#C9A84C" }}>USD ${proposal.total.toLocaleString("en-US")}</span>
            </div>

            <div className="mt-4 p-3 rounded-xl text-xs" style={{ background: "#F8F9FB", color: "#6B7280" }}>
              <p className="mb-1">{t.validity}</p>
              <p>{t.payment}</p>
            </div>

            {accepted ? (
              <div className="mt-6 text-center p-6 rounded-xl" style={{ background: "#DCFCE7" }}>
                <p className="text-2xl mb-2">✅</p>
                <p className="font-bold text-lg mb-1" style={{ color: "#166534" }}>{t.accepted}</p>
                <p className="text-sm" style={{ color: "#166534" }}>{t.acceptedMsg}</p>
              </div>
            ) : (
              <button onClick={handleAccept} disabled={accepting}
                className="w-full mt-6 py-4 rounded-xl font-bold text-base"
                style={{ background: "#27295C", color: "white" }}>
                {accepting ? "..." : t.confirm}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "#9CA3AF" }}>
          FastForward Trading Company LLC · Miami, FL · fastfwdus.com
        </p>
      </div>
    </div>
  );
}
