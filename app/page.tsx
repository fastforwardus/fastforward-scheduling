"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ArrowRight, CheckCircle } from "lucide-react";

type Lang = "es" | "en" | "pt";

const copy = {
  es: {
    nav: "Agendar consulta",
    pill: "Consulta gratuita · 30 minutos",
    h1a: "Expertos en entrada al",
    h1b: "mercado de EE.UU.",
    sub: "FDA compliance, formación de LLC y estrategia regulatoria para empresas que exportan a Estados Unidos.",
    cta: "Agendar consulta gratuita",
    ctaSub: "Sin costo · Con un experto senior",
    items: [
      "FDA / FSMA compliance",
      "Formación de LLC con EIN",
      "Registro de instalaciones",
      "Certificaciones internacionales",
    ],
    stats: [
      { n: "300+", l: "Empresas atendidas" },
      { n: "15+", l: "Países" },
      { n: "98%", l: "Aprobación FDA" },
    ],
    footer: "Todos los derechos reservados.",
  },
  en: {
    nav: "Book consultation",
    pill: "Free consultation · 30 minutes",
    h1a: "Experts in entering the",
    h1b: "US market.",
    sub: "FDA compliance, LLC formation and regulatory strategy for companies exporting to the United States.",
    cta: "Book your free consultation",
    ctaSub: "No cost · With a senior expert",
    items: [
      "FDA / FSMA compliance",
      "LLC formation with EIN",
      "Facility registration",
      "International certifications",
    ],
    stats: [
      { n: "300+", l: "Companies served" },
      { n: "15+", l: "Countries" },
      { n: "98%", l: "FDA approval rate" },
    ],
    footer: "All rights reserved.",
  },
  pt: {
    nav: "Agendar consulta",
    pill: "Consulta gratuita · 30 minutos",
    h1a: "Especialistas em entrada no",
    h1b: "mercado dos EUA.",
    sub: "Conformidade FDA, formação de LLC e estratégia regulatória para empresas que exportam para os Estados Unidos.",
    cta: "Agendar consulta gratuita",
    ctaSub: "Sem custo · Com especialista sênior",
    items: [
      "Conformidade FDA / FSMA",
      "Formação de LLC com EIN",
      "Registro de instalações",
      "Certificações internacionais",
    ],
    stats: [
      { n: "300+", l: "Empresas atendidas" },
      { n: "15+", l: "Países" },
      { n: "98%", l: "Aprovação FDA" },
    ],
    footer: "Todos os direitos reservados.",
  },
};

const flags: { code: Lang; flag: string; label: string }[] = [
  { code: "es", flag: "🇪🇸", label: "ES" },
  { code: "en", flag: "🇺🇸", label: "EN" },
  { code: "pt", flag: "🇧🇷", label: "PT" },
];

export default function Home() {
  const [lang, setLang] = useState<Lang>("es");
  const [mounted, setMounted] = useState(false);

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
    <div className="min-h-screen bg-white dark:bg-[#0F1023] text-gray-900 dark:text-white">

      {/* ── Header ── */}
      <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-white/10
                         bg-[#27295C]/95 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-full flex items-center justify-between">
          <Image
            src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png"
            alt="FastForward ® | FDA Experts"
            width={160}
            height={36}
            className="object-contain"
            priority
          />
          <div className="flex items-center gap-3">
            {/* Language switcher */}
            <div className="hidden sm:flex items-center gap-1 mr-2">
              {flags.map((f) => (
                <button
                  key={f.code}
                  onClick={() => setLang(f.code)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all
                    ${lang === f.code
                      ? "bg-[#C9A84C] text-white"
                      : "text-white/50 hover:text-white"
                    }`}
                >
                  {f.flag} {f.label}
                </button>
              ))}
            </div>
            <ThemeToggle />
            
              href="/book"
              className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-lg
                         bg-[#C9A84C] hover:bg-[#E5BA52] text-white text-sm font-semibold
                         transition-all duration-200"
            >
              {t.nav} <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="pt-16 min-h-screen flex flex-col justify-center
                          bg-[#27295C] dark:bg-[#1A1C3E]">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <div className="max-w-3xl">

            {/* Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8
                            border border-[#C9A84C]/30 bg-[#C9A84C]/10
                            text-[#E5BA52] text-xs font-medium tracking-wide uppercase">
              {t.pill}
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl font-bold text-white leading-[1.1] mb-6"
                style={{ letterSpacing: "-0.03em" }}>
              {t.h1a}<br />
              <span className="text-[#C9A84C]">{t.h1b}</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg text-white/60 mb-10 max-w-xl leading-relaxed">
              {t.sub}
            </p>

            {/* Checklist */}
            <ul className="grid sm:grid-cols-2 gap-2.5 mb-10">
              {t.items.map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-white/70">
                  <CheckCircle className="w-4 h-4 text-[#C9A84C] flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              
                href="/book"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl
                           bg-[#C9A84C] hover:bg-[#E5BA52] text-white font-semibold
                           transition-all duration-200 hover:-translate-y-0.5
                           hover:shadow-xl hover:shadow-[#C9A84C]/25 text-base"
              >
                {t.cta} <ArrowRight className="w-4 h-4" />
              </a>
              <span className="text-sm text-white/40">{t.ctaSub}</span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-12 mt-20 pt-12 border-t border-white/10">
            {t.stats.map((s) => (
              <div key={s.n}>
                <div className="text-3xl font-bold text-[#C9A84C]">{s.n}</div>
                <div className="text-sm text-white/40 mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 bg-[#0F1023] border-t border-white/5">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row
                        items-center justify-between gap-4">
          <Image
            src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png"
            alt="FastForward ® | FDA Experts"
            width={130}
            height={30}
            className="object-contain"
          />
          <p className="text-white/30 text-xs">
            © {new Date().getFullYear()} FastForward ® | FDA Experts · Miami, FL ·{" "}
            <a href="https://fastfwdus.com"
               className="hover:text-white/60 transition-colors">
              fastfwdus.com
            </a>
            {" "}· {t.footer}
          </p>
        </div>
      </footer>

    </div>
  );
}
