"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function RecoveryTabs() {
  const pathname = usePathname();
  const tabs = [
    { href: "/dashboard/recovery", label: "Leads para contactar" },
    { href: "/dashboard/recovery/calls", label: "Llamados" },
    { href: "/dashboard/recovery/metrics", label: "Metricas" },
  ];
  return (
    <div className="flex gap-1 mb-5" style={{ borderBottom: "1px solid #E5E7EB" }}>
      {tabs.map(t => {
        const activo = pathname === t.href;
        return (
          <Link key={t.href} href={t.href}
            className="px-4 py-2.5 text-sm font-semibold transition-colors"
            style={{
              color: activo ? "#27295C" : "#9CA3AF",
              borderBottom: `2px solid ${activo ? "#C9A84C" : "transparent"}`,
              marginBottom: -1,
            }}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
