import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function ManagerDashboard() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0F1023" }}>
      <div className="text-center">
        <p className="text-sm mb-2" style={{ color: "#C9A84C" }}>Sales Manager</p>
        <h1 className="text-3xl font-bold text-white mb-2">Hola, {session.fullName} 👋</h1>
        <p style={{ color: "rgba(255,255,255,0.4)" }}>Dashboard en construcción</p>
        <a href="/api/auth/logout-page" className="inline-block mt-6 px-4 py-2 rounded-lg text-sm font-medium"
           style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
          Cerrar sesión
        </a>
      </div>
    </div>
  );
}
