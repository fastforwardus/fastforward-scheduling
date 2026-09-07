"use client";
import { useEffect, useState } from "react";

type Prop = {
  id: string; proposal_num: string; total: number; discount: number;
  services: string; client_name: string | null; client_email: string | null;
  client_address: string | null; client_tax_id: string | null;
  rep_name: string | null; zoho_invoice_missing_at: string | null;
};

export default function FacturarPage() {
  const [items, setItems] = useState<Prop[]>([]);
  const [sel, setSel] = useState<Prop | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = () => {
    setCargando(true);
    fetch("/api/facturar")
      .then((r) => r.json())
      .then((d) => setItems(d.propuestas ?? []))
      .catch(() => setItems([]))
      .finally(() => setCargando(false));
  };
  useEffect(cargar, []);

  const servicios = (p: Prop) => {
    try { return JSON.parse(p.services) as { name: string; price: number }[]; } catch { return []; }
  };

  const emitir = async () => {
    if (!sel || !confirmado) return;
    setEnviando(true); setMsg(null);
    try {
      const r = await fetch("/api/facturar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: sel.id, confirmado: true }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg({ tipo: "error", texto: d.error || "Error al emitir" }); }
      else {
        setMsg({ tipo: "ok", texto: `Factura ${d.invoice.invoice_number} emitida y enviada al cliente.` });
        setSel(null); setConfirmado(false); cargar();
      }
    } catch (e) {
      setMsg({ tipo: "error", texto: String(e) });
    } finally { setEnviando(false); }
  };

  const sub = sel ? servicios(sel).reduce((a, s) => a + s.price, 0) : 0;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-1">Emitir factura</h1>
      <p className="text-sm text-gray-500 mb-6">
        Solo aparecen las propuestas que todavia no tienen factura en Zoho Books.
      </p>

      {msg && (
        <div className={`mb-4 rounded-lg p-3 text-sm ${msg.tipo === "ok" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {msg.texto}
        </div>
      )}

      {!sel && (
        <div className="space-y-2">
          {cargando && <p className="text-sm text-gray-500">Cargando...</p>}
          {!cargando && items.length === 0 && (
            <p className="text-sm text-gray-500">No hay propuestas pendientes de facturar.</p>
          )}
          {items.map((p) => (
            <button key={p.id}
              onClick={() => { setSel(p); setConfirmado(false); setMsg(null); }}
              className="w-full text-left border rounded-xl p-4 hover:bg-gray-50 flex justify-between items-center">
              <div>
                <div className="font-semibold">{p.client_name || "Sin nombre"}</div>
                <div className="text-xs text-gray-500">
                  {p.proposal_num} · {p.rep_name || "sin owner"}
                  {p.zoho_invoice_missing_at && <span className="ml-2 text-red-600 font-medium">factura automatica fallida</span>}
                </div>
              </div>
              <div className="text-lg font-bold">USD {p.total}</div>
            </button>
          ))}
        </div>
      )}

      {sel && (
        <div>
          {/* Vista previa: replica la factura tal como la recibe el cliente */}
          <div className="border-2 rounded-xl bg-white p-8 shadow-sm">
            <div className="flex justify-between items-start border-b pb-4 mb-6">
              <div>
                <div className="text-xl font-bold">FastForward Trading Company LLC</div>
                <div className="text-xs text-gray-500 mt-1">
                  33 SW 2nd Ave, Suite 702<br />Miami, FL 33130-1501<br />info@fastfwdus.com
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold tracking-tight">FACTURA</div>
                <div className="text-xs text-gray-500 mt-1">Ref: {sel.proposal_num}</div>
              </div>
            </div>

            <div className="mb-6">
              <div className="text-xs uppercase text-gray-400 mb-1">Facturar a</div>
              <div className="font-semibold">{sel.client_name || "—"}</div>
              <div className="text-sm text-gray-600">{sel.client_email || "sin email"}</div>
              {sel.client_address && <div className="text-sm text-gray-600">{sel.client_address}</div>}
              {sel.client_tax_id && <div className="text-sm text-gray-600">Tax ID: {sel.client_tax_id}</div>}
            </div>

            <table className="w-full text-sm mb-6">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-gray-400">
                  <th className="py-2">Servicio</th>
                  <th className="py-2 text-right">Importe</th>
                </tr>
              </thead>
              <tbody>
                {servicios(sel).map((s, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2">{s.name}</td>
                    <td className="py-2 text-right">USD {s.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end">
              <div className="w-64 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>USD {sub}</span></div>
                {!!sel.discount && (
                  <div className="flex justify-between"><span className="text-gray-500">Descuento</span><span>- USD {sel.discount}</span></div>
                )}
                <div className="flex justify-between border-t pt-2 text-lg font-bold">
                  <span>Total</span><span>USD {sel.total}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
            <p className="text-sm text-amber-900 font-medium mb-3">
              Al confirmar, la factura se emite y se envia al cliente de inmediato. No se puede deshacer desde aqui.
            </p>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={confirmado}
                onChange={(e) => setConfirmado(e.target.checked)}
                className="w-4 h-4" />
              Revise los datos y confirmo la emision
            </label>
          </div>

          <div className="mt-4 flex gap-3">
            <button onClick={() => { setSel(null); setConfirmado(false); }}
              className="px-4 py-2 rounded-lg border text-sm">Volver</button>
            <button onClick={emitir} disabled={!confirmado || enviando}
              className="px-6 py-2 rounded-lg bg-black text-white text-sm font-semibold disabled:opacity-40">
              {enviando ? "Emitiendo..." : "Emitir factura"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
