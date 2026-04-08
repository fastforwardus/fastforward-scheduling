"use client";
import { useEffect, useState } from "react";

type Lang = "es" | "en" | "pt";

const T: Record<Lang, Record<string, string>> = {
  es: {
    invoice: "Factura", ref: "Ref", client: "Cliente", company: "Empresa",
    due: "Vence", services: "Detalle de servicios", total: "Total",
    balance: "Saldo pendiente", payNow: "Pagar con tarjeta",
    bankTitle: "Pago por transferencia bancaria",
    bankBody: "Escribinos a info@fastfwdus.com para recibir los datos bancarios.",
    paid: "Factura pagada ✓", paidMsg: "Esta factura ya fue pagada. Gracias.",
    secure: "Pago seguro via Stripe", notFound: "Factura no encontrada", loading: "Cargando...",
  },
  en: {
    invoice: "Invoice", ref: "Ref", client: "Client", company: "Company",
    due: "Due", services: "Service details", total: "Total",
    balance: "Balance due", payNow: "Pay with card",
    bankTitle: "Bank transfer",
    bankBody: "Email us at info@fastfwdus.com to receive wire transfer details.",
    paid: "Invoice paid ✓", paidMsg: "This invoice has already been paid. Thank you.",
    secure: "Secure payment via Stripe", notFound: "Invoice not found", loading: "Loading...",
  },
  pt: {
    invoice: "Fatura", ref: "Ref", client: "Cliente", company: "Empresa",
    due: "Vence", services: "Detalhes dos serviços", total: "Total",
    balance: "Saldo pendente", payNow: "Pagar com cartão",
    bankTitle: "Transferência bancária",
    bankBody: "Entre em contato em info@fastfwdus.com para receber os dados bancários.",
    paid: "Fatura paga ✓", paidMsg: "Esta fatura já foi paga. Obrigado.",
    secure: "Pagamento seguro via Stripe", notFound: "Fatura não encontrada", loading: "Carregando...",
  },
};

interface InvoiceData {
  invoiceNumber: string; referenceNumber: string; clientName: string;
  clientEmail: string; clientCompany: string; total: number; balance: number;
  status: string; paymentLink: string; services: { name: string; price: number }[];
  lang: string; dueDate: string;
}

const fmt = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2 });

export default function PayClient({ token }: { token: string }) {
  const [data, setData] = useState<InvoiceData | null>(null);
  const [error, setError] = useState(false);
  const [lang, setLang] = useState<Lang>("es");

  useEffect(() => {
    fetch(`/api/pay/${token}`).then(r => r.json()).then(d => {
      if (d.error) { setError(true); return; }
      setData(d);
      setLang(d.lang === "en" ? "en" : d.lang === "pt" ? "pt" : "es");
    }).catch(() => setError(true));
  }, [token]);

  const t = T[lang];
  const isPaid = data?.status === "paid";

  if (error) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb" }}>
      <p style={{ fontFamily: "system-ui", color: "#6b7280" }}>{T.es.notFound}</p>
    </div>
  );

  if (!data) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb" }}>
      <p style={{ fontFamily: "system-ui", color: "#9ca3af" }}>{t.loading}</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .pay-btn { background: #111827; color: #fff; border: none; width: 100%; padding: 16px; border-radius: 10px; font-size: 16px; font-weight: 600; cursor: pointer; letter-spacing: 0.3px; transition: background 0.15s; text-decoration: none; display: block; text-align: center; }
        .pay-btn:hover { background: #1f2937; }
        .lang { background: none; border: none; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 500; padding: 4px 8px; border-radius: 6px; }
        .lang.active { background: #111827; color: #fff; }
        .lang.inactive { color: #6b7280; }
        .lang.inactive:hover { color: #111827; }
      `}</style>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://fastfwdus.com/wp-content/uploads/2025/03/FF-Logo-Horizontal.png" alt="FastForward" height={28} style={{ objectFit: "contain" }} />
        <div style={{ display: "flex", gap: 4 }}>
          {(["es","en","pt"] as Lang[]).map(l => (
            <button key={l} className={`lang ${lang === l ? "active" : "inactive"}`} onClick={() => setLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "40px 20px 60px" }}>

        {/* Invoice header */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 12, color: "#9ca3af", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{t.invoice} · {data.referenceNumber}</p>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: "#111827", letterSpacing: -0.5 }}>{data.invoiceNumber}</h1>
          {data.dueDate && <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 6 }}>{t.due}: {data.dueDate}</p>}
        </div>

        {/* Amount */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "28px 24px", marginBottom: 16 }}>
          {isPaid ? (
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 22, fontWeight: 600, color: "#059669" }}>{t.paid}</p>
              <p style={{ fontSize: 14, color: "#6b7280", marginTop: 8 }}>{t.paidMsg}</p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 12, color: "#9ca3af", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>{t.balance}</p>
              <p style={{ fontSize: 44, fontWeight: 600, color: "#111827", letterSpacing: -2 }}>{fmt(data.balance)}</p>
            </>
          )}
        </div>

        {/* Client */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "20px 24px", marginBottom: 16, display: "grid", gridTemplateColumns: data.clientCompany ? "1fr 1fr" : "1fr", gap: 16 }}>
          <div>
            <p style={{ fontSize: 11, color: "#9ca3af", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{t.client}</p>
            <p style={{ fontSize: 15, fontWeight: 500, color: "#111827" }}>{data.clientName}</p>
          </div>
          {data.clientCompany && (
            <div>
              <p style={{ fontSize: 11, color: "#9ca3af", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{t.company}</p>
              <p style={{ fontSize: 15, fontWeight: 500, color: "#111827" }}>{data.clientCompany}</p>
            </div>
          )}
        </div>

        {/* Services */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "20px 24px", marginBottom: 24 }}>
          <p style={{ fontSize: 11, color: "#9ca3af", letterSpacing: 1, textTransform: "uppercase", marginBottom: 16 }}>{t.services}</p>
          {data.services.map((s, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", paddingBottom: 12, marginBottom: 12, borderBottom: i < data.services.length - 1 ? "1px solid #f3f4f6" : "none" }}>
              <p style={{ fontSize: 14, color: "#374151", flex: 1, paddingRight: 16 }}>{s.name}</p>
              <p style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>{fmt(s.price)}</p>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid #e5e7eb" }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{t.total}</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{fmt(data.total)}</p>
          </div>
        </div>

        {/* Pay buttons */}
        {!isPaid && (
          <>
            {data.paymentLink && (
              <a href={data.paymentLink} className="pay-btn" style={{ marginBottom: 12 }}>
                {t.payNow} — {fmt(data.balance)}
              </a>
            )}
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "18px 24px", marginBottom: 24 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 6 }}>{t.bankTitle}</p>
              <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>{t.bankBody}</p>
            </div>
            <p style={{ fontSize: 12, color: "#d1d5db", textAlign: "center" }}>🔒 {t.secure}</p>
          </>
        )}
      </div>
    </div>
  );
}
