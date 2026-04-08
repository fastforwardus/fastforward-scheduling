"use client";
import { useEffect, useState } from "react";

type Lang = "es" | "en" | "pt";

const T: Record<Lang, Record<string, string>> = {
  es: {
    invoice: "Factura", ref: "Ref", client: "Cliente", company: "Empresa",
    due: "Vence", services: "Servicios", total: "Total",
    balance: "Saldo pendiente",
    payNow: "Pagar con tarjeta",
    payNote: "Se abrirá una nueva ventana. Hacé click en \"Pay Now\" para completar el pago.",
    bankTitle: "Transferencia bancaria",
    bankBody: "Escribinos a info@fastfwdus.com para recibir los datos.",
    paid: "Factura pagada", paidMsg: "Esta factura ya fue pagada. ¡Gracias!",
    secure: "Pago seguro procesado por Stripe",
    notFound: "Factura no encontrada", loading: "Cargando...",
  },
  en: {
    invoice: "Invoice", ref: "Ref", client: "Client", company: "Company",
    due: "Due", services: "Services", total: "Total",
    balance: "Balance due",
    payNow: "Pay with card",
    payNote: "A secure window will open. Click \"Pay Now\" to complete your payment.",
    bankTitle: "Bank transfer",
    bankBody: "Email us at info@fastfwdus.com for wire transfer details.",
    paid: "Invoice paid", paidMsg: "This invoice has already been paid. Thank you!",
    secure: "Secure payment processed by Stripe",
    notFound: "Invoice not found", loading: "Loading...",
  },
  pt: {
    invoice: "Fatura", ref: "Ref", client: "Cliente", company: "Empresa",
    due: "Vence", services: "Serviços", total: "Total",
    balance: "Saldo pendente",
    payNow: "Pagar com cartão",
    payNote: "Uma janela segura será aberta. Clique em \"Pay Now\" para concluir o pagamento.",
    bankTitle: "Transferência bancária",
    bankBody: "Entre em contato em info@fastfwdus.com para os dados bancários.",
    paid: "Fatura paga", paidMsg: "Esta fatura já foi paga. Obrigado!",
    secure: "Pagamento seguro processado pelo Stripe",
    notFound: "Fatura não encontrada", loading: "Carregando...",
  },
};

interface InvoiceData {
  invoiceNumber: string; referenceNumber: string; clientName: string;
  clientEmail: string; clientCompany: string; total: number; balance: number;
  status: string; paymentLink: string; services: { name: string; price: number }[];
  lang: string; dueDate: string;
}

const fmt = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2 });
const GOLD = "#B8952A";
const DARK = "#1A1A1A";

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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 20 }}>✕</div>
        <p style={{ fontFamily: "system-ui", color: "#6b7280", fontSize: 15 }}>{t.notFound}</p>
      </div>
    </div>
  );

  if (!data) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa" }}>
      <div style={{ width: 32, height: 32, border: `2px solid ${GOLD}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Cormorant+Garamond:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .fade { animation: fadeUp 0.4s ease both; }
        .fade2 { animation: fadeUp 0.4s 0.08s ease both; }
        .fade3 { animation: fadeUp 0.4s 0.16s ease both; }
        .fade4 { animation: fadeUp 0.4s 0.24s ease both; }
        .pay-btn { display:block; width:100%; background:${DARK}; color:#fff; border:none; padding:17px; border-radius:10px; font-size:15px; font-weight:600; cursor:pointer; text-decoration:none; text-align:center; letter-spacing:0.2px; transition:background 0.15s, transform 0.15s; font-family:inherit; }
        .pay-btn:hover { background:#333; transform:translateY(-1px); }
        .lang-btn { background:none; border:none; cursor:pointer; font-family:inherit; font-size:12px; font-weight:500; padding:5px 10px; border-radius:6px; letter-spacing:0.5px; transition:all 0.15s; }
        .lang-btn.active { background:${DARK}; color:#fff; }
        .lang-btn.inactive { color:#9ca3af; }
        .lang-btn.inactive:hover { color:${DARK}; }
        .card { background:#fff; border:1px solid #f0f0f0; border-radius:14px; padding:24px; box-shadow:0 1px 3px rgba(0,0,0,0.04); }
      `}</style>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://fastfwdus.com/wp-content/uploads/2025/03/FF-Logo-Horizontal.png" alt="FastForward" height={26} style={{ objectFit: "contain" }} />
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          {(["es","en","pt"] as Lang[]).map(l => (
            <button key={l} className={`lang-btn ${lang === l ? "active" : "inactive"}`} onClick={() => setLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 500, margin: "0 auto", padding: "36px 20px 60px" }}>

        {/* Invoice header */}
        <div className="fade" style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, color: "#9ca3af", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
            {t.invoice} · {data.referenceNumber}
          </p>
          <h1 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 32, fontWeight: 500, color: DARK, letterSpacing: -0.5 }}>
            {data.invoiceNumber}
          </h1>
          {data.dueDate && (
            <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>{t.due}: {data.dueDate}</p>
          )}
        </div>

        {/* Balance */}
        <div className={`card fade2`} style={{ marginBottom: 12, borderLeft: `3px solid ${GOLD}` }}>
          {isPaid ? (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <p style={{ fontSize: 20, fontWeight: 600, color: "#059669" }}>{t.paid}</p>
              <p style={{ fontSize: 14, color: "#6b7280", marginTop: 6 }}>{t.paidMsg}</p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 11, color: "#9ca3af", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>{t.balance}</p>
              <p style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 44, fontWeight: 500, color: DARK, letterSpacing: -1 }}>{fmt(data.balance)}</p>
            </>
          )}
        </div>

        {/* Client */}
        <div className={`card fade2`} style={{ marginBottom: 12, display: "grid", gridTemplateColumns: data.clientCompany ? "1fr 1fr" : "1fr", gap: 16 }}>
          <div>
            <p style={{ fontSize: 11, color: "#9ca3af", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>{t.client}</p>
            <p style={{ fontSize: 15, fontWeight: 500, color: DARK }}>{data.clientName}</p>
          </div>
          {data.clientCompany && (
            <div>
              <p style={{ fontSize: 11, color: "#9ca3af", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>{t.company}</p>
              <p style={{ fontSize: 15, fontWeight: 500, color: DARK }}>{data.clientCompany}</p>
            </div>
          )}
        </div>

        {/* Services */}
        <div className={`card fade3`} style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, color: "#9ca3af", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>{t.services}</p>
          {data.services.map((s, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 10, marginBottom: 10, borderBottom: i < data.services.length - 1 ? "1px solid #f5f5f5" : "none" }}>
              <p style={{ fontSize: 14, color: "#374151", flex: 1, paddingRight: 16 }}>{s.name}</p>
              <p style={{ fontSize: 14, fontWeight: 500, color: DARK, whiteSpace: "nowrap" }}>{fmt(s.price)}</p>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12, borderTop: `1px solid #f0f0f0` }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: DARK }}>{t.total}</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: GOLD }}>{fmt(data.total)}</p>
          </div>
        </div>

        {/* Pay */}
        {!isPaid && (
          <div className="fade4">
            {data.paymentLink && (
              <>
                <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", marginBottom: 12, lineHeight: 1.6 }}>
                  {t.payNote}
                </p>
                <a href={data.paymentLink} target="_blank" rel="noopener noreferrer" className="pay-btn" style={{ marginBottom: 12 }}>
                  {t.payNow} — {fmt(data.balance)}
                </a>
              </>
            )}
            <div className="card" style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: DARK, marginBottom: 4 }}>{t.bankTitle}</p>
              <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>{t.bankBody}</p>
            </div>
            <p style={{ fontSize: 12, color: "#d1d5db", textAlign: "center" }}>🔒 {t.secure}</p>
          </div>
        )}
      </div>
    </div>
  );
}
