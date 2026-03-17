import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#F8F9FB" }}>
      <div className="text-center">
        <p className="text-4xl mb-3">⚙️</p>
        <h1 className="text-xl font-bold mb-2" style={{ color: "#27295C" }}>Configuración</h1>
        <p className="text-sm" style={{ color: "#9CA3AF" }}>Próximamente — recordatorios, textos, feriados</p>
      </div>
    </div>
  );
}
