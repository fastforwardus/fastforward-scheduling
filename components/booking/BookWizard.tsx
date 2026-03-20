"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useWizard, type Lang, type ServiceType, type ExportVolume, type Platform } from "@/lib/wizard-store";
import { t } from "@/lib/wizard-i18n";
import { ArrowRight, ArrowLeft, CheckCircle, Calendar, MessageCircle, Loader2, Check } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { parseISO } from "date-fns";

// ── Country codes ──
const COUNTRIES = [
  { code: "+54", flag: "🇦🇷", name: "Argentina" },
  { code: "+55", flag: "🇧🇷", name: "Brasil" },
  { code: "+56", flag: "🇨🇱", name: "Chile" },
  { code: "+57", flag: "🇨🇴", name: "Colombia" },
  { code: "+52", flag: "🇲🇽", name: "México" },
  { code: "+51", flag: "🇵🇪", name: "Perú" },
  { code: "+598", flag: "🇺🇾", name: "Uruguay" },
  { code: "+58", flag: "🇻🇪", name: "Venezuela" },
  { code: "+593", flag: "🇪🇨", name: "Ecuador" },
  { code: "+595", flag: "🇵🇾", name: "Paraguay" },
  { code: "+591", flag: "🇧🇴", name: "Bolivia" },
  { code: "+506", flag: "🇨🇷", name: "Costa Rica" },
  { code: "+502", flag: "🇬🇹", name: "Guatemala" },
  { code: "+507", flag: "🇵🇦", name: "Panamá" },
  { code: "+1", flag: "🇺🇸", name: "United States" },
  { code: "+34", flag: "🇪🇸", name: "España" },
  { code: "+351", flag: "🇵🇹", name: "Portugal" },
];

const PERSONAL_DOMAINS = ["gmail.com","hotmail.com","yahoo.com","outlook.com","icloud.com","live.com","msn.com","protonmail.com","aol.com"];

const LANGS: { code: Lang; flag: string; label: string }[] = [
  { code: "es", flag: "🇪🇸", label: "ES" },
  { code: "en", flag: "🇺🇸", label: "EN" },
  { code: "pt", flag: "🇧🇷", label: "PT" },
];

interface RepInfo {
  fullName: string;
  slug: string;
  avatarUrl?: string;
}

interface SlotData {
  grouped: Record<string, { utc: string; label: string; date: string }[]>;
}

export default function BookWizard({
  repSlug,
  repInfo,
  prefilled,
}: {
  repSlug?: string;
  repInfo?: RepInfo;
  prefilled?: { name?: string; email?: string; company?: string; phone?: string };
}) {
  const w = useWizard();

  async function trackSession(updates: { email?: string; name?: string; company?: string; step?: number; service?: string; completed?: boolean }) {
    const email = updates.email || w.clientEmail;
    if (!email || !email.includes("@")) return;
    fetch("/api/wizard-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        name: updates.name || w.clientName,
        company: updates.company || w.clientCompany,
        stepReached: updates.step || w.step,
        serviceInterest: updates.service || w.serviceInterest,
        completed: updates.completed || false,
      }),
    }).catch(() => {});
  }
  const [mounted, setMounted] = useState(false);
  const [timezone, setTimezone] = useState("America/Argentina/Buenos_Aires");
  const [slotsData, setSlotsData] = useState<SlotData | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{ appointmentId: string; isPending: boolean } | null>(null);
  const [blocked, setBlocked] = useState(false);

  const tr = t[w.language];

  useEffect(() => {
    setMounted(true);
    // Detect language
    const bl = navigator.language.toLowerCase();
    if (bl.startsWith("pt")) w.setLanguage("pt");
    else if (bl.startsWith("en")) w.setLanguage("en");
    else w.setLanguage("es");
    // Detect timezone
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(tz);
    // Set repSlug
    if (repSlug) w.setRepSlug(repSlug);
    // Prefill
    if (prefilled?.name) w.setClientName(prefilled.name);
    if (prefilled?.email) w.setClientEmail(prefilled.email);
    if (prefilled?.company) w.setClientCompany(prefilled.company);
    if (prefilled?.phone) w.setClientWhatsapp(prefilled.phone);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load slots when reaching step 4
  useEffect(() => {
    if (w.step !== 4) return;
    setLoadingSlots(true);
    fetch(`/api/slots?timezone=${encodeURIComponent(timezone)}`)
      .then(r => r.json())
      .then(d => {
        setSlotsData(d);
        const dates = Object.keys(d.grouped || {});
        if (dates.length) setSelectedDate(dates[0]);
        setLoadingSlots(false);
      })
      .catch(() => setLoadingSlots(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.step, timezone]);

  const isPersonalEmail = (email: string) => {
    const domain = email.split("@")[1]?.toLowerCase();
    return domain ? PERSONAL_DOMAINS.includes(domain) : false;
  };

  const handleEmailBlur = () => {
    if (w.clientEmail && isPersonalEmail(w.clientEmail)) {
      w.setPersonalEmailWarning(true);
    } else {
      w.setPersonalEmailWarning(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      trackSession({ completed: true });
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: w.clientName,
          clientEmail: w.clientEmail,
          clientCompany: w.clientCompany,
          clientWhatsapp: `${w.clientCountryCode} ${w.clientWhatsapp}`,
          clientTimezone: timezone,
          clientLanguage: w.language,
          serviceInterest: w.serviceType,
          exportVolume: w.exportVolume,
          platform: w.platform,
          repSlug: repSlug || "general",
          utmSource: w.utmSource,
          scheduledAt: w.selectedSlot,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setConfirmed({ appointmentId: data.appointmentId, isPending: data.isPendingAssignment });
      }
    } catch (err) {
      console.error(err);
    }
    setSubmitting(false);
  };

  if (!mounted) return null;

  // ── BLOCKED ──
  if (blocked) {
    return (
      <WizardShell language={w.language} onLangChange={w.setLanguage} repInfo={repInfo}>
        <div className="text-center py-8">
          <div className="text-5xl mb-4">🚫</div>
          <h2 className="text-xl font-bold mb-3" style={{ color: "#27295C" }}>{tr.blockedTitle}</h2>
          <p className="text-gray-500 mb-6 text-sm leading-relaxed max-w-xs mx-auto">{tr.blockedText}</p>
          <a href="https://wa.me/13058974450"
             className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white text-sm"
             style={{ background: "#25D366" }}>
            <MessageCircle className="w-4 h-4" /> {tr.blockedCta}
          </a>
        </div>
      </WizardShell>
    );
  }

  // ── SUCCESS ──
  if (confirmed) {
    const slotDate = w.selectedSlot ? parseISO(w.selectedSlot) : null;
    const formattedSlot = slotDate
      ? formatInTimeZone(slotDate, timezone, "EEEE d MMMM · h:mm a")
      : "";

    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    const googleCalUrl = slotDate ? (() => {
      const details = encodeURIComponent("Consulta con FastForward ® | FDA Experts\n\nMiami, FL · fastfwdus.com");
      return `https://calendar.google.com/calendar/r/eventedit?text=Reuni%C3%B3n+FastForward&dates=${fmt(slotDate)}/${fmt(new Date(slotDate.getTime()+30*60000))}&details=${details}`;
    })() : "#";

    const icsContent = slotDate ? (() => {
      const end = new Date(slotDate.getTime() + 30 * 60 * 1000);
      return [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//FastForward LLC//Scheduling//EN",
        "BEGIN:VEVENT",
        `DTSTART:${fmt(slotDate)}`,
        `DTEND:${fmt(end)}`,
        "SUMMARY:Reunión FastForward ® | FDA Experts",
        "DESCRIPTION:Consulta con FastForward LLC · Miami FL · fastfwdus.com",
        "ORGANIZER:MAILTO:info@fastfwdus.com",
        "STATUS:CONFIRMED",
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n");
    })() : "";

    const downloadIcs = () => {
      const blob = new Blob([icsContent], { type: "text/calendar" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "consulta-fastforward.ics";
      a.click();
      URL.revokeObjectURL(url);
    };

    return (
      <WizardShell language={w.language} onLangChange={w.setLanguage} repInfo={repInfo}>
        <div className="text-center py-4">
          {/* Check icon */}
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
               style={{ background: "rgba(201,168,76,0.12)" }}>
            <CheckCircle className="w-8 h-8" style={{ color: "#C9A84C" }} />
          </div>

          <h2 className="text-2xl font-bold mb-2" style={{ color: "#27295C" }}>{tr.successTitle}</h2>
          <p className="text-gray-400 text-sm mb-6">{tr.successSub}</p>

          {/* Resumen cita */}
          <div className="p-5 rounded-xl mb-4 text-left"
               style={{ background: "#F8F9FB", border: "1px solid #E5E7EB" }}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                   style={{ background: "#27295C" }}>
                <Calendar className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm capitalize" style={{ color: "#27295C" }}>{formattedSlot}</p>
                <p className="text-xs text-gray-400 mt-0.5">{timezone}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                        style={{ background: "rgba(39,41,92,0.08)", color: "#27295C" }}>
                    {w.platform === "meet" ? "🎥 Google Meet" : w.platform === "zoom" ? "📹 Zoom" : "💬 WhatsApp"}
                  </span>
                  <span className="text-xs text-gray-400">30 min</span>
                </div>
                {w.platform !== "whatsapp" && (
                  <div className="mt-3 p-2.5 rounded-lg text-xs"
                       style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)" }}>
                    <p className="text-gray-400 mb-1">{w.language === "es" ? "El link de la reunión será enviado por email." : w.language === "en" ? "The meeting link will be sent by email." : "O link da reunião será enviado por email."}</p>
                  </div>
                )}
                {w.platform === "whatsapp" && (
                  <div className="mt-3 p-2.5 rounded-lg text-xs"
                       style={{ background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.2)", color: "#166534" }}>
                    {w.language === "es" ? "📞 Te llamaremos al " : w.language === "en" ? "📞 We'll call you at " : "📞 Ligaremos para "}{w.clientCountryCode} {w.clientWhatsapp}
                  </div>
                )}
              </div>
            </div>
          </div>

          {confirmed.isPending && (
            <div className="p-3 rounded-xl mb-4 text-xs text-left"
                 style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.25)", color: "#92640a" }}>
              ℹ️ {tr.pendingAssignment}
            </div>
          )}

          {/* Cliente info */}
          <div className="p-4 rounded-xl mb-6 text-left"
               style={{ background: "#F8F9FB", border: "1px solid #E5E7EB" }}>
            <p className="text-xs text-gray-400 mb-1">{w.language === "es" ? "Confirmación enviada a" : w.language === "en" ? "Confirmation sent to" : "Confirmação enviada para"}</p>
            <p className="text-sm font-medium" style={{ color: "#27295C" }}>{w.clientEmail}</p>
          </div>

          {/* Calendar buttons */}
          <div className="flex flex-col gap-2.5">
            <a href={googleCalUrl} target="_blank" rel="noreferrer"
               className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5"
               style={{ background: "#27295C", color: "white" }}>
              <Calendar className="w-4 h-4" /> {tr.addGoogle}
            </a>
            <button onClick={downloadIcs}
               className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border-2 transition-all hover:-translate-y-0.5"
               style={{ borderColor: "#E5E7EB", color: "#374151" }}>
              🍎 {tr.addApple}
            </button>
          </div>

          <button onClick={() => { w.reset(); window.location.href = "/"; }}
            className="mt-5 text-xs transition-colors" style={{ color: "#9CA3AF" }}>
            ← {w.language === "es" ? "Volver al inicio" : w.language === "en" ? "Back to home" : "Voltar ao início"}
          </button>
        </div>
      </WizardShell>
    );
  }

  const progress = ((w.step - 1) / 4) * 100;

  return (
    <WizardShell language={w.language} onLangChange={w.setLanguage} repInfo={repInfo}>

      {/* Progress bar */}
      <div className="h-0.5 rounded-full mb-8" style={{ background: "#F0F0F0" }}>
        <div className="h-full rounded-full transition-all duration-500"
             style={{ width: `${progress}%`, background: "linear-gradient(90deg, #27295C, #C9A84C)" }} />
      </div>

      {/* ── STEP 1: Servicio ── */}
      {w.step === 1 && (
        <div>
          <h2 className="text-xl font-bold mb-6" style={{ color: "#27295C" }}>{tr.step1Title}</h2>
          <div className="space-y-3">
            {(["fda_fsma","register_company","market_entry","not_sure"] as ServiceType[]).map((s) => (
              <button key={s} onClick={() => { w.setServiceType(s); w.next(); }}
                className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border-2 text-left transition-all duration-150 hover:-translate-y-0.5"
                style={{
                  borderColor: w.serviceType === s ? "#C9A84C" : "#E5E7EB",
                  background: w.serviceType === s ? "rgba(201,168,76,0.05)" : "white",
                  boxShadow: w.serviceType === s ? "0 4px 16px rgba(201,168,76,0.15)" : "none",
                }}>
                <span className="text-2xl">{
                  s === "fda_fsma" ? "📋" :
                  s === "register_company" ? "🏢" :
                  s === "market_entry" ? "🚀" : "❓"
                }</span>
                <span className="font-medium text-sm" style={{ color: "#27295C" }}>{tr.services[s]}</span>
                {w.serviceType === s && <Check className="w-4 h-4 ml-auto" style={{ color: "#C9A84C" }} />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── STEP 2: Volumen ── */}
      {w.step === 2 && (
        <div>
          <h2 className="text-xl font-bold mb-6" style={{ color: "#27295C" }}>{tr.step2Title}</h2>
          <div className="space-y-3 mb-8">
            {(["not_exporting","starting_under_100k","exporting_100k_1m","high_volume_over_1m"] as ExportVolume[]).map((v) => (
              <button key={v} onClick={() => w.setExportVolume(v)}
                className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border-2 text-left transition-all duration-150 hover:-translate-y-0.5"
                style={{
                  borderColor: w.exportVolume === v ? "#C9A84C" : "#E5E7EB",
                  background: w.exportVolume === v ? "rgba(201,168,76,0.05)" : "white",
                }}>
                <span className="text-2xl">{
                  v === "not_exporting" ? "📦" :
                  v === "starting_under_100k" ? "🚢" :
                  v === "exporting_100k_1m" ? "📈" : "🏭"
                }</span>
                <span className="font-medium text-sm" style={{ color: "#27295C" }}>{tr.volumes[v]}</span>
                {w.exportVolume === v && <Check className="w-4 h-4 ml-auto" style={{ color: "#C9A84C" }} />}
              </button>
            ))}
          </div>

          {/* B2B filter */}
          {w.exportVolume && (
            <div className="p-4 rounded-xl mb-6" style={{ background: "#F8F9FB", border: "1px solid #E5E7EB" }}>
              <p className="text-sm font-semibold mb-3" style={{ color: "#27295C" }}>{tr.b2bQuestion}</p>
              <div className="flex gap-3">
                <button onClick={() => { w.setIsB2b(true); w.next(); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border-2"
                  style={{ borderColor: "#27295C", background: "#27295C", color: "white" }}>
                  ✅ {tr.b2bYes}
                </button>
                <button onClick={() => { w.setIsB2b(false); setBlocked(true); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border-2"
                  style={{ borderColor: "#E5E7EB", color: "#9CA3AF" }}>
                  {tr.b2bNo}
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={w.prev}
              className="flex items-center gap-1.5 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all"
              style={{ borderColor: "#E5E7EB", color: "#6B7280" }}>
              <ArrowLeft className="w-4 h-4" /> {tr.back}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Datos del cliente ── */}
      {w.step === 3 && (
        <div>
          <h2 className="text-xl font-bold mb-6" style={{ color: "#27295C" }}>{tr.step3Title}</h2>
          <div className="space-y-4">
            {/* Nombre */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-widest" style={{ color: "#9CA3AF" }}>
                {tr.fields.name}
              </label>
              <input type="text" value={w.clientName} onChange={e => w.setClientName(e.target.value)}
                placeholder={tr.placeholders.name}
                className="w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all"
                style={{ borderColor: "#E5E7EB", color: "#111827" }}
                onFocus={e => e.currentTarget.style.borderColor = "#27295C"}
                onBlur={e => e.currentTarget.style.borderColor = "#E5E7EB"}
              />
            </div>
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-widest" style={{ color: "#9CA3AF" }}>
                {tr.fields.email}
              </label>
              <input type="email" value={w.clientEmail} onChange={e => { w.setClientEmail(e.target.value); w.setPersonalEmailWarning(false); }}
                placeholder={tr.placeholders.email}
                className="w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all"
                style={{ borderColor: "#E5E7EB", color: "#111827" }}
                onFocus={e => e.currentTarget.style.borderColor = "#27295C"}
                onBlur={e => { e.currentTarget.style.borderColor = "#E5E7EB"; handleEmailBlur(); }}
              />
              {w.personalEmailWarning && (
                <div className="mt-2 p-3 rounded-xl text-xs" style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.3)", color: "#92400e" }}>
                  ⚠️ {tr.personalEmailWarning}
                  <button onClick={() => w.setPersonalEmailWarning(false)} className="ml-2 underline font-medium">{tr.continueAnyway}</button>
                </div>
              )}
            </div>
            {/* Empresa */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-widest" style={{ color: "#9CA3AF" }}>
                {tr.fields.company}
              </label>
              <input type="text" value={w.clientCompany} onChange={e => w.setClientCompany(e.target.value)}
                placeholder={tr.placeholders.company}
                className="w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all"
                style={{ borderColor: "#E5E7EB", color: "#111827" }}
                onFocus={e => e.currentTarget.style.borderColor = "#27295C"}
                onBlur={e => e.currentTarget.style.borderColor = "#E5E7EB"}
              />
            </div>
            {/* WhatsApp */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-widest" style={{ color: "#9CA3AF" }}>
                {tr.fields.whatsapp}
              </label>
              <div className="flex gap-2">
                <select value={w.clientCountryCode} onChange={e => w.setClientCountryCode(e.target.value)}
                  className="px-3 py-3 rounded-xl border-2 text-sm outline-none bg-white"
                  style={{ borderColor: "#E5E7EB", color: "#111827", minWidth: "90px" }}>
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                  ))}
                </select>
                <input type="tel" value={w.clientWhatsapp} onChange={e => w.setClientWhatsapp(e.target.value)}
                  placeholder={tr.placeholders.whatsapp}
                  className="flex-1 px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all"
                  style={{ borderColor: "#E5E7EB", color: "#111827" }}
                  onFocus={e => e.currentTarget.style.borderColor = "#27295C"}
                  onBlur={e => e.currentTarget.style.borderColor = "#E5E7EB"}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button onClick={w.prev}
              className="flex items-center gap-1.5 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all"
              style={{ borderColor: "#E5E7EB", color: "#6B7280" }}>
              <ArrowLeft className="w-4 h-4" /> {tr.back}
            </button>
            <button
              onClick={w.next}
              disabled={!w.clientName || !w.clientEmail || !w.clientCompany || !w.clientWhatsapp}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: (!w.clientName || !w.clientEmail || !w.clientCompany || !w.clientWhatsapp) ? "#E5E7EB" : "#27295C",
                color: (!w.clientName || !w.clientEmail || !w.clientCompany || !w.clientWhatsapp) ? "#9CA3AF" : "white",
              }}>
              {tr.next} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Horario ── */}
      {w.step === 4 && (
        <div>
          <h2 className="text-xl font-bold mb-2" style={{ color: "#27295C" }}>{tr.step4Title}</h2>
          <p className="text-xs text-gray-400 mb-6">{tr.timezone}: <span className="font-medium">{timezone}</span></p>

          {loadingSlots ? (
            <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> {tr.loading}
            </div>
          ) : !slotsData || !Object.keys(slotsData.grouped || {}).length ? (
            <p className="text-center text-gray-400 py-12 text-sm">{tr.noSlots}</p>
          ) : (
            <div>
              {/* Date tabs */}
              <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
                {Object.keys(slotsData.grouped).slice(0, 10).map((date) => {
                  const d = new Date(date + "T12:00:00");
                  const isSelected = selectedDate === date;
                  const locale = w.language === "pt" ? "pt-BR" : w.language === "en" ? "en-US" : "es-ES";
                  const dayName = d.toLocaleDateString(locale, { weekday: "short" }).toUpperCase();
                  const dayNum = d.toLocaleDateString(locale, { day: "numeric" });
                  const monthName = d.toLocaleDateString(locale, { month: "short" });
                  return (
                    <button key={date} onClick={() => setSelectedDate(date)}
                      className="flex-shrink-0 flex flex-col items-center px-4 py-2.5 rounded-xl border-2 text-xs font-medium transition-all"
                      style={{
                        borderColor: isSelected ? "#27295C" : "#E5E7EB",
                        background: isSelected ? "#27295C" : "white",
                        color: isSelected ? "white" : "#6B7280",
                        minWidth: "64px",
                      }}>
                      <span style={{ fontSize: "10px", opacity: 0.7 }}>{dayName}</span>
                      <span className="font-bold text-sm">{dayNum}</span>
                      <span style={{ fontSize: "10px", opacity: 0.7 }}>{monthName}</span>
                    </button>
                  );
                })}
              </div>

              {/* Time slots */}
              {selectedDate && slotsData.grouped[selectedDate] && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-6">
                  {slotsData.grouped[selectedDate].map((slot) => {
                    const isSelected = w.selectedSlot === slot.utc;
                    return (
                      <button key={slot.utc} onClick={() => w.setSelectedSlot(slot.utc)}
                        className="py-2.5 rounded-xl border-2 text-sm font-medium transition-all"
                        style={{
                          borderColor: isSelected ? "#27295C" : "#E5E7EB",
                          background: isSelected ? "#27295C" : "white",
                          color: isSelected ? "white" : "#374151",
                        }}>
                        {slot.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <button onClick={w.prev}
              className="flex items-center gap-1.5 px-4 py-3 rounded-xl border-2 text-sm font-medium"
              style={{ borderColor: "#E5E7EB", color: "#6B7280" }}>
              <ArrowLeft className="w-4 h-4" /> {tr.back}
            </button>
            <button onClick={w.next} disabled={!w.selectedSlot}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: !w.selectedSlot ? "#E5E7EB" : "#27295C",
                color: !w.selectedSlot ? "#9CA3AF" : "white",
              }}>
              {tr.next} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 5: Plataforma + Confirmar ── */}
      {w.step === 5 && (
        <div>
          <h2 className="text-xl font-bold mb-6" style={{ color: "#27295C" }}>{tr.step5Title}</h2>
          <div className="space-y-3 mb-8">
            {(["meet","zoom","whatsapp"] as Platform[]).map((p) => (
              <button key={p} onClick={() => w.setPlatform(p)}
                className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border-2 text-left transition-all hover:-translate-y-0.5"
                style={{
                  borderColor: w.platform === p ? "#C9A84C" : "#E5E7EB",
                  background: w.platform === p ? "rgba(201,168,76,0.05)" : "white",
                }}>
                <span className="text-2xl">{p === "meet" ? "🎥" : p === "zoom" ? "📹" : "💬"}</span>
                <div>
                  <p className="font-semibold text-sm" style={{ color: "#27295C" }}>{tr.platforms[p]}</p>
                  <p className="text-xs text-gray-400">{tr.platformSub[p]}</p>
                </div>
                {w.platform === p && <Check className="w-4 h-4 ml-auto" style={{ color: "#C9A84C" }} />}
              </button>
            ))}
          </div>

          {/* Resumen */}
          {w.selectedSlot && w.platform && (
            <div className="p-4 rounded-xl mb-6" style={{ background: "#F8F9FB", border: "1px solid #E5E7EB" }}>
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Resumen</p>
              <p className="text-sm font-medium" style={{ color: "#27295C" }}>
                {formatInTimeZone(parseISO(w.selectedSlot), timezone, "EEEE d MMM · h:mm a")}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{w.platform} · {w.clientCompany}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={w.prev}
              className="flex items-center gap-1.5 px-4 py-3 rounded-xl border-2 text-sm font-medium"
              style={{ borderColor: "#E5E7EB", color: "#6B7280" }}>
              <ArrowLeft className="w-4 h-4" /> {tr.back}
            </button>
            <button onClick={handleSubmit} disabled={!w.platform || submitting}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{
                background: (!w.platform || submitting) ? "#E5E7EB" : "#C9A84C",
                color: (!w.platform || submitting) ? "#9CA3AF" : "#1A1C3E",
              }}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{tr.confirm} <CheckCircle className="w-4 h-4" /></>}
            </button>
          </div>
        </div>
      )}

    </WizardShell>
  );
}

// ── Shell del wizard ──
function WizardShell({ children, language, onLangChange, repInfo }: {
  children: React.ReactNode;
  language: Lang;
  onLangChange: (l: Lang) => void;
  repInfo?: RepInfo;
}) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F8F9FB" }}>
      {/* Header */}
      <header className="h-14 flex items-center px-4 sm:px-6" style={{ background: "#27295C" }}>
        <div className="max-w-lg mx-auto w-full flex items-center justify-between">
          <Image
            src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png"
            alt="FastForward ® | FDA Experts"
            width={140} height={32}
            className="object-contain"
            priority unoptimized
          />
          <div className="flex items-center gap-1">
            {LANGS.map(l => (
              <button key={l.code} onClick={() => onLangChange(l.code)}
                className="px-2 py-1 rounded text-xs font-medium transition-all"
                style={{ color: language === l.code ? "#C9A84C" : "rgba(255,255,255,0.4)" }}>
                {l.flag} {l.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          {/* Rep badge */}
          {repInfo && (
            <div className="flex items-center gap-3 mb-6 p-4 rounded-xl"
                 style={{ background: "white", border: "1px solid #E5E7EB", boxShadow: "0 2px 8px rgba(39,41,92,0.06)" }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                   style={{ background: "linear-gradient(135deg, #27295C, #373CA7)", fontSize: "18px" }}>
                {repInfo.avatarUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={repInfo.avatarUrl} alt={repInfo.fullName} className="w-full h-full rounded-full object-cover" />
                  : repInfo.fullName[0]
                }
              </div>
              <div className="flex-1">
                <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: "#9CA3AF" }}>
                  {language === "en" ? "Your expert" : language === "pt" ? "Seu especialista" : "Tu experto"}
                </p>
                <p className="font-bold text-sm" style={{ color: "#27295C" }}>{repInfo.fullName}</p>
                <p className="text-xs" style={{ color: "#C9A84C" }}>FastForward ® | FDA Experts</p>
              </div>
              <div className="w-2 h-2 rounded-full" style={{ background: "#22C55E" }} title="Disponible" />
            </div>
          )}

          {/* Card */}
          <div className="rounded-2xl p-6 sm:p-8"
               style={{ background: "white", boxShadow: "0 4px 32px rgba(39,41,92,0.08)", border: "1px solid rgba(39,41,92,0.06)" }}>
            {children}
          </div>

          {/* Footer */}
          <p className="text-center text-xs mt-6" style={{ color: "#9CA3AF" }}>
            FastForward ® | FDA Experts · Miami, FL
          </p>
        </div>
      </main>
    </div>
  );
}
