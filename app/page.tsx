"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ArrowRight, CheckCircle, Menu, X } from "lucide-react";

type Lang = "es" | "en" | "pt";

const copy = {
  es: {
    nav: "Agendar consulta",
    pill: "Consulta gratuita · 30 minutos",
    h1a: "Regulación FDA.",
    h1b: "Entrada al mercado de EE.UU.",
    sub: "Asesoramos a empresas exportadoras en FDA compliance, formación de LLC, registro de marcas y apertura al mercado americano.",
    cta: "Agendar consulta gratuita",
    ctaSub: "Sin costo · Con un experto senior",
    stats: [
      { n: "14.000+", l: "Empresas atendidas" },
      { n: "35+", l: "Países" },
      { n: "15+", l: "Años de experiencia" },
    ],
    servicesTitle: "Nuestros servicios",
    services: [
      { cat: "Alimentos y Bebidas", items: ["Registro establecimiento FDA", "Certificación FSVP", "Revisión de etiquetas", "Licencias bebidas alcohólicas FL"] },
      { cat: "Cosméticos y Medicamentos", items: ["Registro establecimiento FDA", "Registro por producto", "Revisión de etiquetas", "Medical Devices (510k)"] },
      { cat: "Apertura de Empresa", items: ["LLC en Miami con EIN", "Operating Agreement", "Registro de marca USPTO", "US Agent (servicio mensual)"] },
      { cat: "USDA · NOAA · Wildlife", items: ["USDA frutas y verduras", "USDA VS Permit", "NOAA Fisheries", "US Fish & Wildlife"] },
    ],
    testimonialsTitle: "Empresas que ya ingresaron al mercado de EE.UU.",
    testimonials: [
      { text: "En 6 meses tuvimos nuestra LLC activa y nuestros productos aprobados por la FDA.", author: "Alejandro Vidal", company: "Vidal Foods", country: "Argentina" },
      { text: "FastForward nos guió en todo el proceso de FSMA. Profesionales y muy eficientes.", author: "María González", company: "NaturalMex", country: "México" },
      { text: "Logramos ingresar al mercado americano con acompañamiento experto en cada paso.", author: "Roberto Araújo", company: "Araújo Export", country: "Brasil" },
    ],
    ctaBanner: "¿Listo para exportar a EE.UU.?",
    footer: "Todos los derechos reservados.",
  },
  en: {
    nav: "Book consultation",
    pill: "Free consultation · 30 minutes",
    h1a: "FDA Regulation.",
    h1b: "US Market Entry.",
    sub: "We advise exporting companies on FDA compliance, LLC formation, trademark registration, and US market entry strategy.",
    cta: "Book your free consultation",
    ctaSub: "No cost · With a senior expert",
    stats: [
      { n: "14,000+", l: "Companies served" },
      { n: "35+", l: "Countries" },
      { n: "15+", l: "Years of experience" },
    ],
    servicesTitle: "Our services",
    services: [
      { cat: "Food & Beverages", items: ["FDA facility registration", "FSVP certification", "Label review", "Florida alcohol licenses"] },
      { cat: "Cosmetics & Pharma", items: ["FDA facility registration", "Product registration", "Label review", "Medical Devices (510k)"] },
      { cat: "Company Formation", items: ["LLC in Miami with EIN", "Operating Agreement", "USPTO trademark", "US Agent (monthly)"] },
      { cat: "USDA · NOAA · Wildlife", items: ["USDA fruits & vegetables", "USDA VS Permit", "NOAA Fisheries", "US Fish & Wildlife"] },
    ],
    testimonialsTitle: "Companies already in the US market",
    testimonials: [
      { text: "In 6 months we had our LLC active and our products FDA-approved.", author: "Alejandro Vidal", company: "Vidal Foods", country: "Argentina" },
      { text: "FastForward guided us through the entire FSMA process. Very professional.", author: "María González", company: "NaturalMex", country: "Mexico" },
      { text: "We entered the US market with expert guidance at every step.", author: "Roberto Araújo", company: "Araújo Export", country: "Brazil" },
    ],
    ctaBanner: "Ready to export to the US?",
    footer: "All rights reserved.",
  },
  pt: {
    nav: "Agendar consulta",
    pill: "Consulta gratuita · 30 minutos",
    h1a: "Regulação FDA.",
    h1b: "Entrada no mercado dos EUA.",
    sub: "Assessoramos empresas exportadoras em conformidade FDA, formação de LLC, registro de marcas e entrada no mercado americano.",
    cta: "Agendar consulta gratuita",
    ctaSub: "Sem custo · Com especialista sênior",
    stats: [
      { n: "14.000+", l: "Empresas atendidas" },
      { n: "35+", l: "Países" },
      { n: "15+", l: "Anos de experiência" },
    ],
    servicesTitle: "Nossos serviços",
    services: [
      { cat: "Alimentos e Bebidas", items: ["Registro estabelecimento FDA", "Certificação FSVP", "Revisão de rótulos", "Licenças bebidas alcoólicas FL"] },
      { cat: "Cosméticos e Medicamentos", items: ["Registro estabelecimento FDA", "Registro por produto", "Revisão de rótulos", "Medical Devices (510k)"] },
      { cat: "Abertura de Empresa", items: ["LLC em Miami com EIN", "Operating Agreement", "Registro marca USPTO", "US Agent (mensal)"] },
      { cat: "USDA · NOAA · Wildlife", items: ["USDA frutas e legumes", "USDA VS Permit", "NOAA Fisheries", "US Fish & Wildlife"] },
    ],
    testimonialsTitle: "Empresas que já entraram no mercado dos EUA",
    testimonials: [
      { text: "Em 6 meses tínhamos nossa LLC ativa e nossos produtos aprovados pela FDA.", author: "Alejandro Vidal", company: "Vidal Foods", country: "Argentina" },
      { text: "A FastForward nos guiou por todo o processo FSMA. Muito profissional.", author: "María González", company: "NaturalMex", country: "México" },
      { text: "Entramos no mercado americano com acompanhamento especializado em cada etapa.", author: "Roberto Araújo", company: "Araújo Export", country: "Brasil" },
    ],
    ctaBanner: "Pronto para exportar para os EUA?",
    footer: "Todos os direitos reservados.",
  },
};

const flags = [
  { code: "es" as Lang, flag: "🇪🇸", label: "ES" },
  { code: "en" as Lang, flag: "🇺🇸", label: "EN" },
  { code: "pt" as Lang, flag: "🇧🇷", label: "PT" },
];

export default function Home() {
  const [lang, setLang] = useState<Lang>("es");
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    const bl = navigator.language.toLowerCase();
    if (bl.startsWith("pt")) setLang("pt");
    else if (bl.startsWith("en")) setLang("en");
    else setLang("es");
  }, []);

  const t = copy[lang];
  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-white dark:bg-[#0F1023] text-gray-900 dark:text-white transition-colors duration-300">

      {/* ── HEADER ── */}
      <header className="fixed inset-x-0 top-0 z-50 h-16 bg-white/95 dark:bg-[#0F1023]/95 border-b border-gray-100 dark:border-white/5 backdrop-blur-md transition-colors duration-300">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between">

          {/* Logo */}
          <div className="block dark:hidden">
            <Image src="https://fastfwdus.com/wp-content/uploads/2025/05/logoR.png" alt="FastForward ® | FDA Experts" width={140} height={32} className="object-contain w-28 sm:w-36" priority />
          </div>
          <div className="hidden dark:block">
            <Image src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" alt="FastForward ® | FDA Experts" width={140} height={32} className="object-contain w-28 sm:w-36" priority />
          </div>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="flex items-center gap-0.5 mr-1">
              {flags.map((f) => (
                <button key={f.code} onClick={() => setLang(f.code)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all ${lang === f.code ? "text-[#27295C] dark:text-[#C9A84C] font-semibold" : "text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60"}`}>
                  {f.flag} {f.label}
                </button>
              ))}
            </div>
            <ThemeToggle />
            <a href="/book" className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 bg-[#27295C] hover:bg-[#1A1C3E] text-white dark:bg-[#C9A84C] dark:hover:bg-[#E5BA52]">
              {t.nav} <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Mobile nav */}
          <div className="flex sm:hidden items-center gap-2">
            <ThemeToggle />
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 rounded-lg text-gray-500 dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {menuOpen && (
          <div className="sm:hidden absolute top-16 inset-x-0 bg-white dark:bg-[#0F1023] border-b border-gray-100 dark:border-white/5 px-4 py-4 flex flex-col gap-3 shadow-lg">
            {/* Language */}
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100 dark:border-white/5">
              {flags.map((f) => (
                <button key={f.code} onClick={() => { setLang(f.code); setMenuOpen(false); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${lang === f.code ? "bg-[#27295C] dark:bg-[#C9A84C] text-white" : "text-gray-400 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/10"}`}>
                  {f.flag} {f.label}
                </button>
              ))}
            </div>
            <a href="/book" onClick={() => setMenuOpen(false)}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-semibold bg-[#27295C] dark:bg-[#C9A84C] text-white transition-all">
              {t.nav} <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section className="pt-16 min-h-[100svh] flex flex-col justify-center bg-white dark:bg-[#1A1C3E] transition-colors duration-300">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="max-w-3xl">

            {/* Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8 border border-gray-200 dark:border-[#C9A84C]/20 bg-gray-50 dark:bg-[#C9A84C]/8 text-gray-500 dark:text-[#C9A84C] text-xs font-medium tracking-widest uppercase">
              {t.pill}
            </div>

            {/* Headline — responsive font size */}
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-tight mb-6 text-[#27295C] dark:text-white" style={{ letterSpacing: "-0.03em" }}>
              {t.h1a}<br />
              <span className="text-[#C9A84C]">{t.h1b}</span>
            </h1>

            <p className="text-base sm:text-lg text-gray-500 dark:text-white/50 mb-10 max-w-2xl leading-relaxed">
              {t.sub}
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <a href="/book" className="flex items-center justify-center gap-2 px-6 py-4 sm:py-3.5 rounded-xl font-semibold text-base transition-all duration-200 bg-[#27295C] hover:bg-[#1A1C3E] text-white dark:bg-[#C9A84C] dark:hover:bg-[#E5BA52] hover:shadow-xl active:scale-95">
                {t.cta} <ArrowRight className="w-4 h-4" />
              </a>
              <span className="text-sm text-gray-400 dark:text-white/30 text-center sm:text-left">{t.ctaSub}</span>
            </div>
          </div>

          {/* Stats — scroll horizontal en mobile si hace falta */}
          <div className="flex flex-wrap gap-x-8 gap-y-6 sm:gap-x-12 mt-16 sm:mt-20 pt-8 sm:pt-12 border-t border-gray-100 dark:border-white/8">
            {t.stats.map((s) => (
              <div key={s.n}>
                <div className="text-2xl sm:text-3xl font-bold text-[#27295C] dark:text-[#C9A84C]" style={{ letterSpacing: "-0.02em" }}>{s.n}</div>
                <div className="text-xs sm:text-sm text-gray-400 dark:text-white/40 mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section className="py-16 sm:py-24 bg-gray-50 dark:bg-[#0F1023] transition-colors duration-300">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="text-xl sm:text-2xl font-bold mb-8 sm:mb-12 text-[#27295C] dark:text-white">{t.servicesTitle}</h2>
          {/* 1 col mobile, 2 col tablet, 4 col desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {t.services.map((s) => (
              <div key={s.cat} className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#1A1C3E] border border-gray-100 dark:border-white/5 hover:border-[#C9A84C]/40 dark:hover:border-[#C9A84C]/30 transition-all duration-200">
                <h3 className="font-semibold text-xs text-[#27295C] dark:text-[#C9A84C] mb-4 uppercase tracking-wider">{s.cat}</h3>
                <ul className="space-y-2.5">
                  {s.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-500 dark:text-white/50">
                      <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-[#C9A84C]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-16 sm:py-24 bg-white dark:bg-[#1A1C3E] transition-colors duration-300">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="text-xl sm:text-2xl font-bold mb-8 sm:mb-12 text-[#27295C] dark:text-white">{t.testimonialsTitle}</h2>
          {/* Stack en mobile, 3 col en desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {t.testimonials.map((testimonial) => (
              <div key={testimonial.author} className="p-5 sm:p-6 rounded-2xl border border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-[#0F1023]">
                <p className="text-gray-600 dark:text-white/60 text-sm leading-relaxed mb-5">&ldquo;{testimonial.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[#27295C] dark:bg-[#C9A84C] text-white text-xs font-bold flex-shrink-0">
                    {testimonial.author[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#27295C] dark:text-white">{testimonial.author}</p>
                    <p className="text-xs text-gray-400 dark:text-white/30">{testimonial.company} · {testimonial.country}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className="py-14 sm:py-20 bg-[#27295C]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="text-white/40 text-xs mb-1.5 uppercase tracking-widest">FastForward ® | FDA Experts</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white" style={{ letterSpacing: "-0.02em" }}>{t.ctaBanner}</h2>
          </div>
          <a href="/book" className="flex-shrink-0 flex items-center justify-center gap-2 w-full sm:w-auto px-7 py-4 sm:py-3.5 rounded-xl font-semibold text-[#27295C] bg-[#C9A84C] hover:bg-[#E5BA52] transition-all duration-200 active:scale-95 hover:shadow-xl hover:shadow-[#C9A84C]/30">
            {t.cta} <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-8 sm:py-10 bg-white dark:bg-[#0F1023] border-t border-gray-100 dark:border-white/5 transition-colors duration-300">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="block dark:hidden">
            <Image src="https://fastfwdus.com/wp-content/uploads/2025/05/logoR.png" alt="FastForward ® | FDA Experts" width={120} height={28} className="object-contain" />
          </div>
          <div className="hidden dark:block">
            <Image src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" alt="FastForward ® | FDA Experts" width={120} height={28} className="object-contain" />
          </div>
          <p className="text-gray-400 dark:text-white/20 text-xs text-center sm:text-right leading-relaxed">
            © {new Date().getFullYear()} FastForward ® | FDA Experts · Miami, FL ·{" "}
            <a href="https://fastfwdus.com" className="hover:text-gray-600 dark:hover:text-white/40 transition-colors">fastfwdus.com</a>
            {" "}· {t.footer}
          </p>
        </div>
      </footer>

    </div>
  );
}
