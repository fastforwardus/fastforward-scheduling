"use client";
import { useEffect, useState } from "react";

type Prop = {
  id: string; proposal_num: string; total: number; discount: number;
  services: unknown; client_name: string | null; client_email: string | null;
  client_address: string | null; client_tax_id: string | null;
  rep_name: string | null; zoho_invoice_missing_at: string | null;
};

export default function FacturarPage() {
  const [items, setItems] = useState<Prop[]>([]);
  const [sel, setSel] = useState<Prop | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [editando, setEditando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [ed, setEd] = useState<{
    clientName: string; clientEmail: string; clientAddress: string; clientTaxId: string;
    discount: number; servicios: { name: string; price: number }[];
  } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState<"pendientes" | "emitidas">("pendientes");

  const cargar = () => {
    setCargando(true);
    const url = tab === "pendientes" ? "/api/facturar" : "/api/facturar/editar";
    fetch(url)
      .then((r) => r.json())
      .then((d) => setItems(d.propuestas ?? d.facturas ?? []))
      .catch(() => setItems([]))
      .finally(() => setCargando(false));
  };
  useEffect(() => { setSel(null); setEditando(false); setMsg(null); cargar(); }, [tab]);

  const servicios = (p: Prop) => {
    const raw = p.services as unknown;
    if (Array.isArray(raw)) return raw as { name: string; price: number }[];
    if (typeof raw === "string") { try { return JSON.parse(raw) as { name: string; price: number }[]; } catch { return []; } }
    return [];
  };

  const emitir = async () => {
    if (!sel || !confirmado) return;
    setEnviando(true); setMsg(null);
    try {
      const r = await fetch(tab === "pendientes" ? "/api/facturar" : "/api/facturar/editar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: sel.id, confirmado: true, edits: ed, motivo }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg({ tipo: "error", texto: d.error || "Error al emitir" }); }
      else {
        setMsg({
          tipo: "ok",
          texto: tab === "pendientes"
            ? `Factura ${d.invoice.invoice_number} emitida y enviada al cliente.`
            : d.reenviada
              ? `Factura ${d.invoice.invoice_number} corregida y reenviada al cliente.`
              : `Factura ${d.invoice.invoice_number} corregida, pero NO se pudo reenviar: ${d.errorEnvio}`,
        });
        setSel(null); setConfirmado(false); setMotivo(""); cargar();
      }
    } catch (e) {
      setMsg({ tipo: "error", texto: String(e) });
    } finally { setEnviando(false); }
  };

  const lineas = ed?.servicios ?? [];
  const sub = lineas.reduce((a, s) => a + (Number(s.price) || 0), 0);
  const desc = Number(ed?.discount) || 0;
  const totalCalc = sub - desc;
  const setLinea = (i: number, campo: "name" | "price", valor: string) => {
    if (!ed) return;
    const copia = [...ed.servicios];
    copia[i] = { ...copia[i], [campo]: campo === "price" ? Number(valor) || 0 : valor };
    setEd({ ...ed, servicios: copia });
  };
  const inp = "border rounded px-2 py-1 text-sm w-full";

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-1">Emitir factura</h1>
      <p className="text-sm text-gray-500 mb-4">
        {tab === "pendientes"
          ? "Propuestas que todavia no tienen factura en Zoho Books."
          : "Facturas ya emitidas. Editarlas corrige el documento en Zoho y se lo reenvia al cliente."}
      </p>

      <div className="flex gap-2 mb-6">
        {(["pendientes", "emitidas"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${tab === t ? "bg-black text-white border-black" : "bg-white"}`}>
            {t === "pendientes" ? "Sin facturar" : "Ya emitidas"}
          </button>
        ))}
      </div>

      {msg && (
        <div className={`mb-4 rounded-lg p-3 text-sm ${msg.tipo === "ok" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {msg.texto}
        </div>
      )}

      {!sel && (
        <div className="space-y-2">
          {cargando && <p className="text-sm text-gray-500">Cargando...</p>}
          {!cargando && items.length === 0 && (
            <p className="text-sm text-gray-500">{tab === "pendientes" ? "No hay propuestas pendientes de facturar." : "No hay facturas emitidas."}</p>
          )}
          {items.map((p) => (
            <button key={p.id}
              onClick={() => {
                setSel(p); setConfirmado(false); setMsg(null); setEditando(false);
                setEd({
                  clientName: p.client_name || "", clientEmail: p.client_email || "",
                  clientAddress: p.client_address || "", clientTaxId: p.client_tax_id || "",
                  discount: p.discount || 0, servicios: servicios(p),
                });
              }}
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
              {!editando ? (
                <>
                  <div className="font-semibold">{ed?.clientName || "—"}</div>
                  <div className="text-sm text-gray-600">{ed?.clientEmail || "sin email"}</div>
                  {ed?.clientAddress && <div className="text-sm text-gray-600">{ed.clientAddress}</div>}
                  {ed?.clientTaxId && <div className="text-sm text-gray-600">Tax ID: {ed.clientTaxId}</div>}
                </>
              ) : (
                <div className="space-y-3 max-w-md">
                  <div>
                    <label className="block text-xs uppercase text-gray-400 mb-1">Nombre del cliente</label>
                    <input className={inp} value={ed?.clientName ?? ""}
                      onChange={(e) => ed && setEd({ ...ed, clientName: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs uppercase text-gray-400 mb-1">Email (recibe la factura)</label>
                    <input className={inp} value={ed?.clientEmail ?? ""}
                      onChange={(e) => ed && setEd({ ...ed, clientEmail: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs uppercase text-gray-400 mb-1">Direccion</label>
                    <input className={inp} value={ed?.clientAddress ?? ""}
                      onChange={(e) => ed && setEd({ ...ed, clientAddress: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs uppercase text-gray-400 mb-1">Tax ID (opcional)</label>
                    <input className={inp} value={ed?.clientTaxId ?? ""}
                      onChange={(e) => ed && setEd({ ...ed, clientTaxId: e.target.value })} />
                  </div>
                </div>
              )}
            </div>

            <table className="w-full text-sm mb-6">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-gray-400">
                  <th className="py-2">Servicio</th>
                  <th className="py-2 text-right">Importe</th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((s, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 pr-2">
                      {editando
                        ? <input className={inp} value={s.name} onChange={(e) => setLinea(i, "name", e.target.value)} />
                        : s.name}
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {editando ? (
                        <span className="inline-flex items-center gap-2">
                          <input type="number" className="border rounded px-2 py-1 text-sm w-28 text-right"
                            value={s.price} onChange={(e) => setLinea(i, "price", e.target.value)} />
                          <button onClick={() => ed && setEd({ ...ed, servicios: ed.servicios.filter((_, j) => j !== i) })}
                            className="text-red-600 text-lg leading-none px-1" title="Borrar">×</button>
                        </span>
                      ) : `USD ${s.price}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {editando && (
              <button onClick={() => ed && setEd({ ...ed, servicios: [...ed.servicios, { name: "", price: 0 }] })}
                className="mb-4 text-sm border rounded-lg px-3 py-1">+ Agregar servicio</button>
            )}

            <div className="flex justify-end">
              <div className="w-72 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>USD {sub}</span></div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Descuento</span>
                  {editando
                    ? <input type="number" className="border rounded px-2 py-1 text-sm w-28 text-right"
                        value={ed?.discount ?? 0}
                        onChange={(e) => ed && setEd({ ...ed, discount: Number(e.target.value) || 0 })} />
                    : <span>{desc ? `- USD ${desc}` : "—"}</span>}
                </div>
                <div className="flex justify-between border-t pt-2 text-lg font-bold">
                  <span>Total</span><span>USD {totalCalc}</span>
                </div>
                {totalCalc !== sel.total && (
                  <div className="text-xs text-amber-700 pt-1">
                    La propuesta original decia USD {sel.total}.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
            <p className="text-sm text-amber-900 font-medium mb-3">
              {tab === "pendientes"
                ? "Al confirmar, la factura se emite y se envia al cliente de inmediato. No se puede deshacer desde aqui."
                : "Esta factura ya la recibio el cliente. Al confirmar se corrige en Zoho y se le reenvia la version nueva."}
            </p>
            {tab === "emitidas" && (
              <div className="mb-3">
                <label className="block text-xs uppercase text-amber-900 mb-1">
                  Motivo del cambio (lo exige Zoho y queda registrado)
                </label>
                <input className="border border-amber-300 rounded px-2 py-1 text-sm w-full bg-white"
                  placeholder="Ej: importe mal cargado, servicio agregado a pedido del cliente"
                  value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </div>
            )}
            <label className={`flex items-center gap-2 text-sm font-medium ${editando ? "opacity-40" : ""}`}>
              <input type="checkbox" checked={confirmado} disabled={editando}
                onChange={(e) => setConfirmado(e.target.checked)}
                className="w-4 h-4" />
              Revise los datos y confirmo la emision
            </label>
          </div>

          <div className="mt-4 flex gap-3">
            <button onClick={() => { setSel(null); setConfirmado(false); setEditando(false); }}
              className="px-4 py-2 rounded-lg border text-sm">Volver</button>
            <button onClick={() => { setEditando(!editando); setConfirmado(false); }}
              className="px-4 py-2 rounded-lg border text-sm font-medium">
              {editando ? "Listo, revisar" : "Editar"}
            </button>
            <button onClick={emitir} disabled={!confirmado || enviando || editando || (tab === "emitidas" && motivo.trim().length < 5)}
              className="px-6 py-2 rounded-lg bg-black text-white text-sm font-semibold disabled:opacity-40">
              {enviando ? "Guardando..." : tab === "pendientes" ? "Emitir factura" : "Corregir y reenviar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
