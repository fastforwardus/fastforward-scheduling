/** Registro central de módulos del dashboard. El Sidebar y el panel admin leen de aquí. */
export type ModuleDef = { key: string; href: string; label: string; roles: string[]; always?: boolean };

export const MODULES: ModuleDef[] = [
  { key: "inicio", href: "/dashboard", label: "Inicio", roles: ["admin", "sales_manager", "sales_rep"], always: true },
  { key: "citas", href: "/dashboard/appointments", label: "Todas las citas", roles: ["admin", "sales_manager", "sales_rep"] },
  { key: "propuestas", href: "/dashboard/propuestas", label: "Propuestas", roles: ["admin", "sales_manager", "sales_rep"] },
  { key: "enviar_propuesta", href: "/dashboard/propuesta", label: "Enviar propuesta", roles: ["admin", "sales_manager", "sales_rep"] },
  { key: "facturar", href: "/dashboard/facturar", label: "Facturar", roles: ["admin", "sales_manager", "sales_rep"] },
  { key: "actividad", href: "/dashboard/actividad", label: "Actividad", roles: ["admin", "sales_manager", "sales_rep"] },
  { key: "status", href: "/dashboard/status", label: "Status", roles: ["admin", "sales_manager", "sales_rep", "recovery"] },
  { key: "recovery", href: "/dashboard/recovery", label: "Recupero", roles: ["admin", "sales_manager", "recovery"] },
  { key: "equipo", href: "/dashboard/team", label: "Equipo", roles: ["admin", "sales_manager"] },
  { key: "admin", href: "/dashboard/admin", label: "Administración", roles: ["admin"] },
  { key: "asistencia", href: "/dashboard/admin/asistencia", label: "Asistencia", roles: ["admin", "sales_manager"] },
  { key: "conversaciones", href: "/dashboard/admin/adriana", label: "Conversaciones", roles: ["admin", "sales_manager", "sales_rep"] },
  { key: "settings", href: "/dashboard/settings", label: "Configuración", roles: ["admin", "sales_manager", "sales_rep"], always: true },
];

/** Módulos que ve un usuario según su rol (sin override). */
export function defaultModulesFor(role: string, canRecovery?: boolean): string[] {
  return MODULES.filter((m) => m.roles.includes(role) || (m.key === "recovery" && !!canRecovery)).map((m) => m.key);
}

/** Módulos efectivos: si tiene override (modules != null) manda el override; si no, el rol. Inicio y Configuración siempre. */
export function effectiveModules(user: { role: string; canRecovery?: boolean; modules?: string[] | null }): string[] {
  const base = user.modules && user.modules.length ? user.modules : defaultModulesFor(user.role, user.canRecovery);
  const set = new Set(base);
  MODULES.filter((m) => m.always).forEach((m) => set.add(m.key));
  return [...set];
}
