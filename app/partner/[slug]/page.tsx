"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const TC: Record<string, string> = {
  es: `ACUERDO DE PARTNERSHIP Y TERMINOS Y CONDICIONES
FastForward Trading Company LLC y sus Subsidiarias
Version 2026.1

IMPORTANTE: AL HACER CLIC EN "ACEPTO", USTED CONFIRMA QUE HA LEIDO, COMPRENDIDO Y ACEPTADO TODOS LOS TERMINOS. ESTE ACUERDO ES LEGALMENTE VINCULANTE.

ARTICULO 1 — PARTES
Este Acuerdo se celebra entre FastForward Trading Company LLC, constituida bajo las leyes del Estado de Florida, EE.UU., junto con todas sus subsidiarias, afiliadas y marcas comerciales (colectivamente "FastForward"), y la persona que acepta estos terminos ("Partner").

ARTICULO 2 — NATURALEZA DE LA RELACION
2.1 El Partner actua exclusivamente como referidor independiente de clientes. Esta relacion NO constituye relacion laboral, sociedad, joint venture, franquicia, agencia ni representacion de ningun tipo.
2.2 El Partner NO esta autorizado para celebrar contratos ni hacer promesas en nombre de FastForward.
2.3 El Partner NO esta autorizado para recibir pagos de clientes en nombre de FastForward.
2.4 FastForward se reserva el derecho exclusivo de determinar precios, terminos y condiciones de sus servicios.

ARTICULO 3 — ACTIVIDADES PERMITIDAS Y PROHIBIDAS
3.1 PERMITIDAS: (a) Referir clientes a traves del sistema de agendamiento; (b) Compartir el link exclusivo asignado; (c) Informar sobre servicios de FastForward de manera veraz; (d) Acceder al portal de partners para ver sus referidos.
3.2 PROHIBIDAS: (a) Presentarse como empleado o representante de FastForward; (b) Usar marcas de FastForward sin autorizacion escrita; (c) Hacer promesas sobre resultados de servicios; (d) Prestar servicios similares a los de FastForward (registro FDA, LLC, marcas USPTO, asesoria de mercado USA); (e) Revelar informacion confidencial de clientes o de FastForward; (f) Interferir en la relacion entre FastForward y sus clientes.

ARTICULO 4 — NO COMPETENCIA
4.1 Durante la vigencia y por 24 meses tras la terminacion, el Partner se compromete a no: (a) Prestar servicios de registro ante la FDA; (b) Constituir empresas o LLCs en EE.UU.; (c) Registrar marcas ante la USPTO; (d) Asesorar sobre ingreso al mercado estadounidense; (e) Prestar cualquier servicio que compita con FastForward; (f) Captar como propios a clientes referidos a FastForward.
4.2 ALCANCE: Aplica en EE.UU., America Latina, Europa y cualquier mercado donde FastForward opere.
4.3 REMEDIOS: El incumplimiento causa danos irreparables. FastForward tendra derecho a medidas cautelares y danos y perjuicios sin necesidad de probar dano efectivo.

ARTICULO 5 — COMISIONES
5.1 El Partner solo tendra derecho a comision si: (a) fue acordada por escrito previamente; (b) el cliente pago efectivamente; (c) el cliente fue referido por el link exclusivo; (d) no hay disputas ni contracargos.
5.2 Sin acuerdo escrito previo, no se genera derecho a comision.
5.3 Pago dentro de 30 dias habiles tras recepcion del pago del cliente. FastForward puede retener comisiones ante disputas o incumplimiento.
5.4 El derecho a comision es personal e intransferible.

ARTICULO 6 — CONFIDENCIALIDAD
6.1 El Partner mantendra estricta confidencialidad sobre: listas de clientes, precios, estrategias, procesos internos e informacion tecnica de FastForward.
6.2 Esta obligacion es perpetua y subsiste tras la terminacion del Acuerdo.

ARTICULO 7 — PROPIEDAD INTELECTUAL
Todas las marcas, logos, software y activos intelectuales de FastForward son propiedad exclusiva de FastForward. Este Acuerdo no otorga ningun derecho de propiedad intelectual al Partner.

ARTICULO 8 — LIMITACION DE RESPONSABILIDAD
8.1 FastForward no garantiza resultados especificos de sus servicios.
8.2 La responsabilidad maxima de FastForward se limita a las comisiones pagadas en los ultimos 3 meses.
8.3 El Partner indemnizara a FastForward por cualquier reclamo derivado de sus actos, omisiones o declaraciones no autorizadas.

ARTICULO 9 — VIGENCIA Y TERMINACION
9.1 Vigencia indefinida desde la aceptacion.
9.2 Cualquiera puede terminar con 30 dias de preaviso. FastForward puede terminar de forma inmediata ante incumplimiento.
9.3 Tras la terminacion: el Partner cesa el uso del link y portal; las obligaciones de confidencialidad y no competencia continuan vigentes.

ARTICULO 10 — DISPOSICIONES GENERALES
10.1 Ley aplicable: Estado de Florida, EE.UU. Jurisdiccion: Tribunales del Condado de Miami-Dade.
10.2 FastForward puede modificar estos terminos con 30 dias de notificacion.
10.3 Este Acuerdo es el acuerdo completo entre las partes.

FastForward Trading Company LLC | Miami, Florida 33131 | info@fastfwdus.com | fastfwdus.com`,
  en: `PARTNERSHIP AGREEMENT AND TERMS & CONDITIONS
FastForward Trading Company LLC and its Subsidiaries
Version 2026.1

IMPORTANT: BY CLICKING "I AGREE", YOU CONFIRM YOU HAVE READ, UNDERSTOOD AND ACCEPTED ALL TERMS. THIS AGREEMENT IS LEGALLY BINDING.

ARTICLE 1 — PARTIES
This Agreement is between FastForward Trading Company LLC, incorporated under Florida law, USA, together with all subsidiaries, affiliates and trademarks (collectively "FastForward"), and the person accepting these terms ("Partner").

ARTICLE 2 — NATURE OF THE RELATIONSHIP
2.1 Partner acts exclusively as an independent client referrer. This does NOT constitute employment, partnership, joint venture, franchise, agency or representation of any kind.
2.2 Partner is NOT authorized to enter contracts or make promises on behalf of FastForward.
2.3 Partner is NOT authorized to collect payments from clients on behalf of FastForward.
2.4 FastForward reserves exclusive right to determine prices, terms and conditions of its services.

ARTICLE 3 — PERMITTED AND PROHIBITED ACTIVITIES
3.1 PERMITTED: (a) Refer clients through the scheduling system; (b) Share assigned exclusive link; (c) Provide general truthful information about FastForward services; (d) Access partner portal to view referrals.
3.2 PROHIBITED: (a) Present as FastForward employee or representative; (b) Use FastForward trademarks without written authorization; (c) Make promises about service results; (d) Provide services similar to FastForward (FDA registration, LLC formation, USPTO trademarks, US market advisory); (e) Disclose confidential client or FastForward information; (f) Interfere in relationship between FastForward and its clients.

ARTICLE 4 — NON-COMPETE
4.1 During term and 24 months after termination, Partner agrees not to: (a) Provide FDA registration services; (b) Form companies or LLCs in the US; (c) Register trademarks with USPTO; (d) Advise on US market entry; (e) Provide any service competing with FastForward; (f) Solicit referred clients for own services.
4.2 SCOPE: Applies in USA, Latin America, Europe and all markets where FastForward operates.
4.3 REMEDIES: Breach causes irreparable harm. FastForward entitled to injunctive relief and damages without proving actual harm.

ARTICLE 5 — COMMISSIONS
5.1 Partner entitled to commission only if: (a) agreed in writing beforehand; (b) client effectively paid; (c) client referred through exclusive link; (d) no disputes or chargebacks.
5.2 No prior written agreement means no commission right.
5.3 Payment within 30 business days of client payment receipt. FastForward may withhold for disputes or non-compliance.
5.4 Commission right is personal and non-transferable.

ARTICLE 6 — CONFIDENTIALITY
6.1 Partner shall maintain strict confidentiality of: client lists, prices, strategies, internal processes and technical information.
6.2 This obligation is perpetual and survives Agreement termination.

ARTICLE 7 — INTELLECTUAL PROPERTY
All FastForward trademarks, logos, software and intellectual assets are exclusively FastForward's property. This Agreement grants no IP rights to Partner.

ARTICLE 8 — LIMITATION OF LIABILITY
8.1 FastForward does not guarantee specific service results.
8.2 FastForward maximum liability limited to commissions paid in last 3 months.
8.3 Partner shall indemnify FastForward for claims arising from acts, omissions or unauthorized statements.

ARTICLE 9 — TERM AND TERMINATION
9.1 Indefinite term from acceptance date.
9.2 Either party may terminate with 30 days notice. FastForward may terminate immediately for non-compliance.
9.3 Upon termination: Partner ceases use of link and portal; confidentiality and non-compete obligations continue.

ARTICLE 10 — GENERAL PROVISIONS
10.1 Governing law: State of Florida, USA. Jurisdiction: Miami-Dade County courts.
10.2 FastForward may modify terms with 30 days notice.
10.3 This Agreement is the entire agreement between the parties.

FastForward Trading Company LLC | Miami, Florida 33131 | info@fastfwdus.com | fastfwdus.com`,
};

export default function PartnerPage({ params }: { params: { slug: string } }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [lang, setLang] = useState<"es" | "en">("es");
  const [accepted, setAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const router = useRouter();

  async function handleLogin() {
    setLoading(true); setError("");
    const res = await fetch("/api/auth/partner-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: params.slug, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.ok) {
      if (!data.termsAccepted) { setShowTerms(true); }
      else { router.push(`/partner/${params.slug}/dashboard`); }
    } else {
      setError(data.error || "Credenciales incorrectas");
    }
  }

  async function handleAcceptTerms() {
    if (!accepted) return;
    setAccepting(true);
    await fetch("/api/auth/partner-accept-terms", { method: "POST" });
    router.push(`/partner/${params.slug}/dashboard`);
  }

  if (showTerms) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#F8F9FB" }}>
        <div style={{ background: "#27295C" }} className="px-6 py-4 flex items-center justify-between">
          <Image src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png"
            alt="FastForward" width={140} height={32} className="object-contain" unoptimized />
          <div className="flex gap-2">
            {(["es","en"] as const).map(l => (
              <button key={l} onClick={() => setLang(l)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: lang === l ? "#C9A84C" : "rgba(255,255,255,0.1)", color: lang === l ? "#1A1C3E" : "white" }}>
                {l === "es" ? "Español" : "English"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E5E7EB", boxShadow: "0 4px 24px rgba(39,41,92,0.08)" }}>
            <div className="px-6 py-4 border-b" style={{ borderColor: "#E5E7EB", background: "#F8F9FB" }}>
              <h1 className="font-bold" style={{ color: "#27295C" }}>
                {lang === "es" ? "Acuerdo de Partnership — Terminos y Condiciones" : "Partnership Agreement — Terms & Conditions"}
              </h1>
              <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>
                {lang === "es" ? "Lea el acuerdo completo antes de continuar." : "Read the complete agreement before proceeding."}
              </p>
            </div>
            <div className="px-6 py-5 overflow-y-auto whitespace-pre-wrap"
                 style={{ maxHeight: "55vh", color: "#374151", fontSize: "11px", lineHeight: "1.7", fontFamily: "monospace" }}>
              {TC[lang]}
            </div>
            <div className="px-6 py-5 border-t" style={{ borderColor: "#E5E7EB" }}>
              <label className="flex items-start gap-3 cursor-pointer mb-5">
                <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-0.5 w-4 h-4 flex-shrink-0" />
                <span className="text-sm" style={{ color: "#374151" }}>
                  {lang === "es"
                    ? "He leido, comprendido y acepto en su totalidad el Acuerdo de Partnership y los Terminos y Condiciones de FastForward Trading Company LLC y sus subsidiarias. Entiendo que este acuerdo es legalmente vinculante."
                    : "I have read, understood, and fully accept the Partnership Agreement and Terms & Conditions of FastForward Trading Company LLC and its subsidiaries. I understand this agreement is legally binding."}
                </span>
              </label>
              <button onClick={handleAcceptTerms} disabled={!accepted || accepting}
                className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all"
                style={{ background: accepted ? "#27295C" : "#E5E7EB", color: accepted ? "white" : "#9CA3AF" }}>
                {accepting
                  ? (lang === "es" ? "Procesando..." : "Processing...")
                  : (lang === "es" ? "Acepto y continuar →" : "I Agree and Continue →")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "#F8F9FB" }}>
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Image src="https://fastfwdus.com/wp-content/uploads/2025/05/logoR.png"
            alt="FastForward" width={160} height={36} className="object-contain" unoptimized />
        </div>
        <div className="bg-white rounded-2xl p-8" style={{ border: "1px solid #E5E7EB", boxShadow: "0 4px 24px rgba(39,41,92,0.08)" }}>
          <h1 className="text-xl font-bold mb-2" style={{ color: "#27295C" }}>Portal de Partner</h1>
          <p className="text-sm mb-6" style={{ color: "#6B7280" }}>Ingresa tu contrasena para acceder</p>
          <div className="mb-4">
            <label className="block text-xs uppercase tracking-widest mb-1.5" style={{ color: "#9CA3AF" }}>Contrasena</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
              style={{ borderColor: "#E5E7EB", color: "#27295C" }}
              onFocus={e => e.currentTarget.style.borderColor = "#27295C"}
              onBlur={e => e.currentTarget.style.borderColor = "#E5E7EB"} />
          </div>
          {error && <p className="text-xs mb-4" style={{ color: "#EF4444" }}>{error}</p>}
          <button onClick={handleLogin} disabled={loading || !password}
            className="w-full py-3 rounded-xl font-semibold text-sm"
            style={{ background: password ? "#27295C" : "#E5E7EB", color: password ? "white" : "#9CA3AF" }}>
            {loading ? "Ingresando..." : "Ingresar →"}
          </button>
        </div>
        <p className="text-center text-xs mt-6" style={{ color: "#9CA3AF" }}>FastForward FDA Experts · Miami, FL</p>
      </div>
    </div>
  );
}
