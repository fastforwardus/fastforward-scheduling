"use client";

import Image from "next/image";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ArrowRight, Shield, TrendingUp, Globe, Award } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-navy-900">

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10
                         bg-navy-500/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Image
            src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png"
            alt="FastForward ® | FDA Experts"
            width={180}
            height={40}
            className="object-contain"
            priority
          />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <a href="/book" className="btn-gold text-sm px-4 py-2">
              Agendar consulta <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-16 bg-gradient-to-br from-navy-900 via-navy-500 to-navy-600
                          min-h-[92vh] flex items-center">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8
                          bg-gold-400/15 border border-gold-400/30 text-gold-300 text-sm font-medium">
            ✦ Consulta gratuita · 30 minutos · Experto senior
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold text-white mb-6 leading-tight"
              style={{ letterSpacing: "-0.02em" }}>
            Tu empresa latinoamericana<br />
            <span className="text-gold-400">merece estar en EE.UU.</span>
          </h1>

          <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto leading-relaxed">
            FDA compliance, LLC formation y entrada al mercado americano.
            Más de 300 empresas ya lo lograron con FastForward.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/book" className="btn-gold text-lg px-8 py-4">
              Agendar consulta gratuita <ArrowRight className="w-5 h-5" />
            </a>
            <a href="https://fastfwdus.com" target="_blank"
               className="inline-flex items-center gap-2 px-8 py-4 rounded-xl
                          border-2 border-white/20 text-white font-semibold
                          hover:bg-white/10 transition-all duration-200">
              Conocer FastForward
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 mt-20 max-w-2xl mx-auto">
            {[
              { n: "300+", label: "Empresas atendidas" },
              { n: "15+", label: "Países de LATAM" },
              { n: "98%", label: "Tasa de aprobación FDA" },
            ].map((stat) => (
              <div key={stat.n} className="text-center">
                <div className="text-3xl font-bold text-gold-400">{stat.n}</div>
                <div className="text-sm text-gray-400 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-gray-50 dark:bg-navy-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-center mb-12 text-navy-500 dark:text-white">
            ¿En qué podemos ayudarte?
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Shield, title: "FDA / FSMA", text: "Cumplimiento total con regulaciones para alimentos, suplementos y cosméticos." },
              { icon: TrendingUp, title: "LLC Formation", text: "Constituimos tu empresa en EE.UU. con EIN, agente registrado y cuenta bancaria." },
              { icon: Globe, title: "Market Entry", text: "Estrategia completa para ingresar al mercado americano con tus productos." },
              { icon: Award, title: "Certificaciones", text: "Orgánico, Kosher, Halal, BRC y más certificaciones internacionales." },
            ].map((f) => (
              <div key={f.title} className="card p-6 hover:shadow-md transition-shadow">
                <f.icon className="w-10 h-10 mb-4 text-gold-400" />
                <h3 className="font-bold text-lg mb-2 text-navy-500 dark:text-white">{f.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-100 dark:border-navy-700 
                         bg-white dark:bg-navy-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row 
                        items-center justify-between gap-4">
          <Image
            src="https://fastfwdus.com/wp-content/uploads/2025/05/logoR.png"
            alt="FastForward ® | FDA Experts"
            width={140}
            height={32}
            className="object-contain dark:hidden"
          />
          <Image
            src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png"
            alt="FastForward ® | FDA Experts"
            width={140}
            height={32}
            className="object-contain hidden dark:block"
          />
          <p className="text-gray-400 text-sm">
            FastForward ® | FDA Experts · Miami, FL ·{" "}
            <a href="https://fastfwdus.com" className="hover:text-navy-500 dark:hover:text-gold-400 transition-colors">
              fastfwdus.com
            </a>
          </p>
        </div>
      </footer>

    </div>
  );
}
