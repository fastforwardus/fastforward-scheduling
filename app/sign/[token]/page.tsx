"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check, FileText, Loader2 } from "lucide-react";

const T = {
  es: {
    loading: "Cargando propuesta...",
    title: "Firma de Propuesta",
    subtitle: "Por favor revisá los detalles antes de firmar",
    proposalNum: "Propuesta N°",
    client: "Cliente",
    total: "Total",
    consent: "He revisado y acepto los términos de esta propuesta comercial de FastForward Trading Company LLC. Entiendo que al firmar digitalmente estoy confirmando mi intención de contratar los servicios indicados.",
    sign: "Firmar propuesta",
    signing: "Firmando...",
    signed: "¡Propuesta firmada!",
    signedSub: "Recibirás una copia por email. Nuestro equipo se pondrá en contacto contigo pronto.",
    invalid: "Este link de firma no es válido o ya fue utilizado.",
  },
  en: {
    loading: "Loading proposal...",
    title: "Proposal Signature",
    subtitle: "Please review the details before signing",
    proposalNum: "Proposal No.",
    client: "Client",
    total: "Total",
    consent: "I have reviewed and accept the terms of this commercial proposal from FastForward Trading Company LLC. I understand that by signing digitally I am confirming my intention to hire the indicated services.",
    sign: "Sign proposal",
    signing: "Signing...",
    signed: "Proposal signed!",
    signedSub: "You will receive a copy by email. Our team will contact you soon.",
    invalid: "This signature link is invalid or has already been used.",
  },
  pt: {
    loading: "Carregando proposta...",
    title: "Assinatura de Proposta",
    subtitle: "Por favor revise os detalhes antes de assinar",
    proposalNum: "Proposta N°",
    client: "Cliente",
    total: "Total",
    consent: "Revisei e aceito os termos desta proposta comercial da FastForward Trading Company LLC. Entendo que ao assinar digitalmente estou confirmando minha intenção de contratar os serviços indicados.",
    sign: "Assinar proposta",
    signing: "Assinando...",
    signed: "Proposta assinada!",
    signedSub: "Você receberá uma cópia por email. Nossa equipe entrará em contato em breve.",
    invalid: "Este link de assinatura é inválido ou já foi utilizado.",
  },
};

export default function SignPage({ params }: { params: { token: string } }) {
  const [proposal, setProposal] = useState<{
    clientName: string; proposalNum: string; total: number; lang: string;
    repName: string; signedAt: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/proposals/sign/${params.token}`)
      .then(r => r.json())
      .then(d => {
        if (d.proposal) {
          setProposal(d.proposal);
          if (d.proposal.signedAt) setSigned(true);
        } else {
          setError("invalid");
        }
        setLoading(false);
      })
      .catch(() => { setError("invalid"); setLoading(false); });
  }, [params.token]);

  const lang = (proposal?.lang || "es") as keyof typeof T;
  const t = T[lang] || T.es;

  async function handleSign() {
    if (!accepted) return;
    setSigning(true);
    const res = await fetch(`/api/proposals/sign/${params.token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (data.ok) setSigned(true);
    setSigning(false);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#F8F9FB" }}>
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#27295C" }} />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#F8F9FB" }}>
      <div className="text-center">
        <p className="text-lg font-semibold" style={{ color: "#27295C" }}>{t.invalid}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ background: "#F8F9FB" }}>
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-8">
          <Image src="https://fastfwdus.com/wp-content/uploads/2025/05/logoR.png"
            alt="FastForward" width={160} height={36} className="object-contain" unoptimized />
        </div>

        {signed ? (
          <div className="bg-white rounded-2xl p-10 text-center" style={{ border: "1px solid #E5E7EB", boxShadow: "0 4px 24px rgba(39,41,92,0.08)" }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#DCFCE7" }}>
              <Check className="w-8 h-8" style={{ color: "#22C55E" }} />
            </div>
            <p className="text-xl font-bold mb-2" style={{ color: "#27295C" }}>{t.signed}</p>
            <p className="text-sm" style={{ color: "#6B7280" }}>{t.signedSub}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E5E7EB", boxShadow: "0 4px 24px rgba(39,41,92,0.08)" }}>
            <div style={{ background: "#27295C", padding: "20px 24px" }}>
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5" style={{ color: GOLD }} />
                <div>
                  <p className="font-bold text-white">{t.title}</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{t.subtitle}</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="rounded-xl p-4 mb-6" style={{ background: "#F8F9FB", border: "1px solid #E5E7EB" }}>
                <div className="flex justify-between mb-2">
                  <span className="text-xs" style={{ color: "#9CA3AF" }}>{t.proposalNum}</span>
                  <span className="text-xs font-semibold" style={{ color: "#27295C" }}>{proposal?.proposalNum}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-xs" style={{ color: "#9CA3AF" }}>{t.client}</span>
                  <span className="text-xs font-semibold" style={{ color: "#27295C" }}>{proposal?.clientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs" style={{ color: "#9CA3AF" }}>{t.total}</span>
                  <span className="text-sm font-bold" style={{ color: "#C9A84C" }}>USD ${proposal?.total.toLocaleString("en-US")}</span>
                </div>
              </div>

              <label className="flex items-start gap-3 cursor-pointer mb-6">
                <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 flex-shrink-0" />
                <span className="text-xs leading-relaxed" style={{ color: "#374151" }}>{t.consent}</span>
              </label>

              <button onClick={handleSign} disabled={!accepted || signing}
                className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                style={{ background: accepted ? "#27295C" : "#E5E7EB", color: accepted ? "white" : "#9CA3AF" }}>
                {signing ? <><Loader2 className="w-4 h-4 animate-spin" /> {t.signing}</> : t.sign}
              </button>
            </div>
          </div>
        )}
        <p className="text-center text-xs mt-6" style={{ color: "#9CA3AF" }}>FastForward Trading Company LLC · Miami, FL</p>
      </div>
    </div>
  );
}

const GOLD = "#C9A84C";
