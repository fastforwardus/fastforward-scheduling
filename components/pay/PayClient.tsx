"use client";
import { useEffect, useState } from "react";

const T = {
  es: {
    loading: "Cargando factura...",
    notFound: "Factura no encontrada",
    invoice: "Factura",
    ref: "Referencia",
    client: "Cliente",
    company: "Empresa",
    due: "Vencimiento",
    services: "Servicios",
    subtotal: "Subtotal",
    total: "Total a pagar",
    balance: "Balance pendiente",
    payNow: "Pagar ahora",
    payCard: "Tarjeta de crédito / débito",
    payACH: "ACH / Transferencia bancaria",
    payContact: "Para pagar por transferencia bancaria contactanos a",
    paid: "Factura pagada",
    paidMsg: "Esta factura ya ha sido pagada. Gracias.",
    secure: "Pago 100% seguro procesado por Stripe",
    lang: "EN",
  },
  en: {
    loading: "Loading invoice...",
    notFound: "Invoice not found",
    invoice: "Invoice",
    ref: "Reference",
    client: "Client",
    company: "Company",
    due: "Due Date",
    services: "Services",
    subtotal: "Subtotal",
    total: "Amount Due",
    balance: "Pending Balance",
    payNow: "Pay Now",
    payCard: "Credit / Debit Card",
    payACH: "ACH / Bank Transfer",
    payContact: "For bank transfer please contact us at",
    paid: "Invoice Paid",
    paidMsg: "This invoice has already been paid. Thank you.",
    secure: "100% secure payment processed by Stripe",
    lang: "ES",
  },
};

interface InvoiceData {
  invoiceNumber: string;
  referenceNumber: string;
  clientName: string;
  clientEmail: string;
  clientCompany: string;
  total: number;
  balance: number;
  status: string;
  paymentLink: string;
  services: { name: string; price: number }[];
  lang: string;
  dueDate: string;
}

export default function PayClient({ token }: { token: string }) {
  const [data, setData] = useState<InvoiceData | null>(null);
  const [error, setError] = useState(false);
  const [lang, setLang] = useState<"es" | "en">("es");

  useEffect(() => {
    fetch(`/api/pay/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(true); return; }
        setData(d);
        setLang((d.lang === "en" ? "en" : "es") as "es" | "en");
      })
      .catch(() => setError(true));
  }, [token]);

  const t = T[lang];
  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2 });

  if (error) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a" }}>
      <div style={{ textAlign: "center", color: "#fff" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
        <p style={{ fontFamily: "Georgia, serif", fontSize: 20 }}>{t.notFound}</p>
      </div>
    </div>
  );

  if (!data) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 40, height: 40, border: "3px solid #C9A84C", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
        <p style={{ color: "#94a3b8", fontFamily: "Georgia, serif" }}>{t.loading}</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  const isPaid = data.status === "paid";

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", fontFamily: "'Georgia', serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .fade1 { animation: fadeUp 0.5s ease both; }
        .fade2 { animation: fadeUp 0.5s 0.1s ease both; }
        .fade3 { animation: fadeUp 0.5s 0.2s ease both; }
        .fade4 { animation: fadeUp 0.5s 0.3s ease both; }
        .pay-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(201,168,76,0.4); }
        .pay-btn { transition: all 0.2s ease; }
        .lang-btn:hover { color: #C9A84C; }
      `}</style>

      {/* Header */}
      <div style={{ background: "#1e293b", borderBottom: "1px solid #334155", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" alt="FastForward" height={32} />
        <button className="lang-btn" onClick={() => setLang(lang === "es" ? "en" : "es")}
          style={{ background: "none", border: "1px solid #334155", color: "#94a3b8", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontFamily: "DM Sans, sans-serif", fontSize: 13, letterSpacing: 1 }}>
          {t.lang}
        </button>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "40px 20px 60px" }}>

        {/* Invoice Number */}
        <div className="fade1" style={{ textAlign: "center", marginBottom: 32 }}>
          <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", marginBottom: 8 }}>{t.invoice}</p>
          <h1 style={{ fontFamily: "Playfair Display, serif", fontSize: 36, color: "#ffffff", fontWeight: 600 }}>{data.invoiceNumber}</h1>
          <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: "#475569", marginTop: 6 }}>{t.ref}: {data.referenceNumber}</p>
        </div>

        {/* Amount Card */}
        <div className="fade2" style={{ background: isPaid ? "#064e3b" : "linear-gradient(135deg, #1C1F3E 0%, #27295C 100%)", border: `1px solid ${isPaid ? "#065f46" : "#3b4070"}`, borderRadius: 16, padding: "32px 28px", marginBottom: 20, textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(201,168,76,0.06)" }} />
          <div style={{ position: "absolute", bottom: -60, left: -30, width: 200, height: 200, borderRadius: "50%", background: "rgba(201,168,76,0.04)" }} />
          {isPaid ? (
            <>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <h2 style={{ fontFamily: "Playfair Display, serif", color: "#34d399", fontSize: 24, marginBottom: 8 }}>{t.paid}</h2>
              <p style={{ fontFamily: "DM Sans, sans-serif", color: "#6ee7b7", fontSize: 15 }}>{t.paidMsg}</p>
            </>
          ) : (
            <>
              <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, letterSpacing: 2, color: "#94a3b8", textTransform: "uppercase", marginBottom: 10 }}>{t.balance}</p>
              <div style={{ fontFamily: "Playfair Display, serif", fontSize: 52, color: "#C9A84C", fontWeight: 700, letterSpacing: -1 }}>
                ${fmt(data.balance)}
              </div>
              {data.dueDate && (
                <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: "#64748b", marginTop: 10 }}>
                  {t.due}: <span style={{ color: "#94a3b8" }}>{data.dueDate}</span>
                </p>
              )}
            </>
          )}
        </div>

        {/* Client Info */}
        <div className="fade2" style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "20px 24px", marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div>
              <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, letterSpacing: 1.5, color: "#475569", textTransform: "uppercase", marginBottom: 4 }}>{t.client}</p>
              <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 15, color: "#e2e8f0" }}>{data.clientName}</p>
            </div>
            {data.clientCompany && (
              <div>
                <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, letterSpacing: 1.5, color: "#475569", textTransform: "uppercase", marginBottom: 4 }}>{t.company}</p>
                <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 15, color: "#e2e8f0" }}>{data.clientCompany}</p>
              </div>
            )}
          </div>
        </div>

        {/* Services */}
        <div className="fade3" style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "20px 24px", marginBottom: 20 }}>
          <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, letterSpacing: 1.5, color: "#475569", textTransform: "uppercase", marginBottom: 16 }}>{t.services}</p>
          {data.services.map((s, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: i < data.services.length - 1 ? 14 : 0, marginBottom: i < data.services.length - 1 ? 14 : 0, borderBottom: i < data.services.length - 1 ? "1px solid #1e293b" : "none" }}>
              <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 15, color: "#cbd5e1", flex: 1, paddingRight: 16 }}>{s.name}</p>
              <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 15, color: "#e2e8f0", fontWeight: 500, whiteSpace: "nowrap" }}>${fmt(s.price)}</p>
            </div>
          ))}
          <div style={{ borderTop: "1px solid #334155", marginTop: 16, paddingTop: 16, display: "flex", justifyContent: "space-between" }}>
            <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 15, color: "#94a3b8" }}>{t.total}</p>
            <p style={{ fontFamily: "Playfair Display, serif", fontSize: 18, color: "#C9A84C", fontWeight: 600 }}>${fmt(data.total)}</p>
          </div>
        </div>

        {/* Pay Button */}
        {!isPaid && data.paymentLink && (
          <div className="fade4">
            <a href={data.paymentLink} target="_blank" rel="noopener noreferrer"
              className="pay-btn"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, background: "#C9A84C", color: "#0f172a", textDecoration: "none", padding: "18px 32px", borderRadius: 12, fontSize: 18, fontFamily: "Playfair Display, serif", fontWeight: 700, marginBottom: 16, width: "100%" }}>
              <span>💳</span> {t.payNow} — ${fmt(data.balance)}
            </a>
            <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "16px 24px", marginBottom: 16 }}>
              <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, letterSpacing: 1.5, color: "#475569", textTransform: "uppercase", marginBottom: 8 }}>{t.payCard}</p>
              <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: "#64748b" }}>Visa · Mastercard · American Express · ACH</p>
            </div>
            <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "16px 24px" }}>
              <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, letterSpacing: 1.5, color: "#475569", textTransform: "uppercase", marginBottom: 8 }}>{t.payACH}</p>
              <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: "#64748b" }}>{t.payContact} <a href="mailto:info@fastfwdus.com" style={{ color: "#C9A84C", textDecoration: "none" }}>info@fastfwdus.com</a></p>
            </div>
            <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: "#334155", textAlign: "center", marginTop: 20 }}>🔒 {t.secure}</p>
          </div>
        )}
      </div>
    </div>
  );
}
