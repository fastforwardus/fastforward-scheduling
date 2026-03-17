"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar, Users, LayoutDashboard, LogOut,
  Menu, X, Settings
} from "lucide-react";

interface SidebarProps {
  user: { fullName: string; email: string; role: string };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Inicio", roles: ["admin","sales_manager","sales_rep"] },
    { href: "/dashboard/appointments", icon: Calendar, label: "Citas", roles: ["admin","sales_manager","sales_rep"] },
    { href: "/dashboard/team", icon: Users, label: "Equipo", roles: ["admin","sales_manager"] },
    { href: "/dashboard/settings", icon: Settings, label: "Configuración", roles: ["admin"] },
  ].filter(l => l.roles.includes(user.role));

  const NavLinks = () => (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link key={link.href} href={link.href}
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
            style={{
              background: active ? "rgba(201,168,76,0.12)" : "transparent",
              color: active ? "#C9A84C" : "rgba(255,255,255,0.5)",
            }}>
            <link.icon className="w-4 h-4 flex-shrink-0" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 min-h-screen flex-shrink-0"
             style={{ background: "#1A1C3E", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
        {/* Logo */}
        <div className="px-5 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <Image
            src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png"
            alt="FastForward" width={140} height={32} className="object-contain" unoptimized
          />
        </div>

        <NavLinks />

        {/* User */}
        <div className="px-3 pb-4 border-t pt-4" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                 style={{ background: "#C9A84C" }}>
              {user.fullName[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user.fullName}</p>
              <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.3)" }}>
                {user.role === "admin" ? "Admin" : user.role === "sales_manager" ? "Manager" : "Sales Rep"}
              </p>
            </div>
          </div>
          <a href="/api/auth/logout-page"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs mt-1 transition-all w-full"
            style={{ color: "rgba(255,255,255,0.3)" }}>
            <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
          </a>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-50 h-14 flex items-center justify-between px-4"
           style={{ background: "#1A1C3E", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Image
          src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png"
          alt="FastForward" width={120} height={28} className="object-contain" unoptimized
        />
        <button onClick={() => setMobileOpen(!mobileOpen)} style={{ color: "rgba(255,255,255,0.5)" }}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.5)" }} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 flex flex-col"
                 style={{ background: "#1A1C3E" }} onClick={e => e.stopPropagation()}>
            <div className="px-5 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <Image src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png"
                alt="FastForward" width={130} height={30} className="object-contain" unoptimized />
            </div>
            <NavLinks />
            <div className="px-3 pb-4 border-t pt-4" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                     style={{ background: "#C9A84C" }}>{user.fullName[0]}</div>
                <div>
                  <p className="text-xs font-semibold text-white">{user.fullName}</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{user.email}</p>
                </div>
              </div>
              <a href="/api/auth/logout-page"
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs mt-1"
                style={{ color: "rgba(255,255,255,0.3)" }}>
                <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
              </a>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
