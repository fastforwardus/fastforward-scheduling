"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { CATALOGS, Service } from "../../lib/catalog";

type Linea = { name: string; price: number };

export default function FacturaNuevaClient({ user }: { user: { id: string; email: string; fullName: string; role: string; slug: string; canRecovery?: boolean } }) {
  const router = useRouter();
  const [lang, setLang] = useState<"es" | "en" | "pt">("es");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientTaxId, setClientTaxId] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [discount, setDiscount] = useState(0);
  const [buscar, setBuscar] = useState("");
  const [revisando, setRevisando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const catalogo = (CATALOGS[lang] as Service[]).filter(s =>
    !buscar || s.name.toLowerCase().includes(buscar.toLowerCase()) || s.category.toLowerCase().includes(buscar.toLowerCase()));

  const sub = lineas.reduce((a, l) => a + (Number(l.price) || 0), 0);
  const total = sub - (Number(discount) || 0);
  const inp = "border rounded px-2 py-1 text-sm w-full";

  const setLinea = (i: number, campo: "name" | "price", valor: string) => {
    const copia = [...lineas];
    copia[i] = { ...copia[i], [campo]: campo === "price" ? Number(valor) || 0 : valor };
    setLineas(copia);
  };

  const emitir = async () => {
    if (!confirmado) return;
    setEnviando(true); setMsg(null);
    try {
      const r = await fetch("/api/facturar/directa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName, clientEmail, clientAddress, clientTaxId, servicios: lineas, discount, confirmado: true, lang }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg({ tipo: "error", texto: d.error || "Error al emitir" }); }
      else {
        setMsg({
          tipo: "ok",
          texto: d.enviada
            ? `Factura ${d.invoice.invoice_number} emitida y enviada a ${clientEmail}.`
            : `Factura ${d.invoice.invoice_number} emitida, pero NO se pudo enviar el correo: ${d.errorEnvio}`,
        });
        setClientName(""); setClientEmail(""); setClientAddress(""); setClientTaxId("");
        setLineas([]); setDiscount(0); setRevisando(false); setConfirmado(false);
      }
    } catch (e) { setMsg({ tipo: "error", texto: String(e) }); }
    finally { setEnviando(false); }
  };

  const listo = clientName.trim() && clientEmail.trim() && lineas.length > 0 && total > 0;

  return (
    <div className="flex min-h-screen" style={{ background: "#F8F9FB" }}>
      <Sidebar user={user} />
      <main className="flex-1 lg:ml-0 pt-14 lg:pt-0 overflow-auto">
        <div className="max-w-4xl mx-auto p-6">
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => router.push("/dashboard/facturar")} className="text-sm text-gray-500">&larr; Volver</button>
          </div>
          <h1 className="text-2xl font-bold mb-1">Factura sin propuesta</h1>
          <p className="text-sm text-gray-500 mb-6">Para clientes que no tienen una propuesta previa en el sistema.</p>

          {msg && (
            <div className={`mb-4 rounded-lg p-3 text-sm ${msg.tipo === "ok" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
              {msg.texto}
            </div>
          )}

          {!revisando ? (
            <>
              <div className="border rounded-xl bg-white p-5 mb-4">
                <p className="text-xs uppercase text-gray-400 mb-3">Datos del cliente</p>
                <div className="space-y-3 max-w-md">
                  <div>
                    <label className="block text-xs uppercase text-gray-400 mb-1">Nombre o empresa *</label>
                    <input className={inp} value={clientName} onChange={e => setClientName(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs uppercase text-gray-400 mb-1">Email (recibe la factura) *</label>
                    <input className={inp} value={clientEmail} onChange={e => setClientEmail(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs uppercase text-gray-400 mb-1">Direccion</label>
                    <input className={inp} value={clientAddress} onChange={e => setClientAddress(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs uppercase text-gray-400 mb-1">Tax ID (opcional)</label>
                    <input className={inp} value={clientTaxId} onChange={e => setClientTaxId(e.target.value)} />
                  </div>
                  <div className="flex gap-2 pt-1">
                    {(["es", "en", "pt"] as const).map(l => (
                      <button key={l} onClick={() => setLang(l)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border ${lang === l ? "bg-black text-white border-black" : "bg-white"}`}>
                        {l.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border rounded-xl bg-white p-5 mb-4">
                <p className="text-xs uppercase text-gray-400 mb-3">Servicios</p>
                <input className={inp + " mb-3"} placeholder="Buscar en el catalogo..." value={buscar} onChange={e => setBuscar(e.target.value)} />
                <div className="max-h-56 overflow-auto border rounded-lg mb-4">
                  {catalogo.map((s, i) => (
                    <button key={i} onClick={() => setLineas([...lineas, { name: s.name, price: s.price }])}
                      className="w-full text-left px-3 py-2 border-b last:border-0 hover:bg-gray-50 flex justify-between items-center text-sm">
                      <span className="min-w-0 pr-2 truncate">{s.name}</span>
                      <span className="font-semibold whitespace-nowrap">${s.price}</span>
                    </button>
                  ))}
                </div>
                <button onClick={() => setLineas([...lineas, { name: "", price: 0 }])}
                  className="text-sm border rounded-lg px-3 py-1.5">+ Agregar linea libre</button>
              </div>

              {lineas.length > 0 && (
                <div className="border rounded-xl bg-white p-5 mb-4">
                  <p className="text-xs uppercase text-gray-400 mb-3">Lineas de la factura</p>
                  <table className="w-full text-sm">
                    <tbody>
                      {lineas.map((l, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 pr-2">
                            <input className={inp} value={l.name} placeholder="Concepto"
                              onChange={e => setLinea(i, "name", e.target.value)} />
                          </td>
                          <td className="py-2 text-right whitespace-nowrap">
                            <span className="inline-flex items-center gap-2">
                              <input type="number" className="border rounded px-2 py-1 text-sm w-28 text-right"
                                value={l.price} onChange={e => setLinea(i, "price", e.target.value)} />
                              <button onClick={() => setLineas(lineas.filter((_, j) => j !== i))}
                                className="text-red-600 text-lg leading-none px-1" title="Borrar">&times;</button>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex justify-end mt-4">
                    <div className="w-72 text-sm space-y-1">
                      <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>USD {sub}</span></div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Descuento</span>
                        <input type="number" className="border rounded px-2 py-1 text-sm w-28 text-right"
                          value={discount} onChange={e => setDiscount(Number(e.target.value) || 0)} />
                      </div>
                      <div className="flex justify-between border-t pt-2 text-lg font-bold">
                        <span>Total</span><span>USD {total}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button onClick={() => { setRevisando(true); setMsg(null); }} disabled={!listo}
                className="px-6 py-2 rounded-lg bg-black text-white text-sm font-semibold disabled:opacity-40">
                Revisar factura
              </button>
            </>
          ) : (
            <>
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
                  </div>
                </div>
                <div className="mb-6">
                  <div className="text-xs uppercase text-gray-400 mb-1">Facturar a</div>
                  <div className="font-semibold">{clientName}</div>
                  <div className="text-sm text-gray-600">{clientEmail}</div>
                  {clientAddress && <div className="text-sm text-gray-600">{clientAddress}</div>}
                  {clientTaxId && <div className="text-sm text-gray-600">Tax ID: {clientTaxId}</div>}
                </div>
                <table className="w-full text-sm mb-6">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-gray-400">
                      <th className="py-2">Servicio</th><th className="py-2 text-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map((l, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-2">{l.name}</td>
                        <td className="py-2 text-right">USD {l.price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-end">
                  <div className="w-64 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>USD {sub}</span></div>
                    {!!discount && <div className="flex justify-between"><span className="text-gray-500">Descuento</span><span>- USD {discount}</span></div>}
                    <div className="flex justify-between border-t pt-2 text-lg font-bold"><span>Total</span><span>USD {total}</span></div>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
                <p className="text-sm text-amber-900 font-medium mb-3">
                  Al confirmar, la factura se emite y se envia al cliente de inmediato. No se puede deshacer desde aqui.
                </p>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} className="w-4 h-4" />
                  Revise los datos y confirmo la emision
                </label>
              </div>

              <div className="mt-4 flex gap-3">
                <button onClick={() => { setRevisando(false); setConfirmado(false); }}
                  className="px-4 py-2 rounded-lg border text-sm">Volver a editar</button>
                <button onClick={emitir} disabled={!confirmado || enviando}
                  className="px-6 py-2 rounded-lg bg-black text-white text-sm font-semibold disabled:opacity-40">
                  {enviando ? "Emitiendo..." : "Emitir factura"}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
