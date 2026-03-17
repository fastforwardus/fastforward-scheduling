import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function AdminDashboard() {
  const session = await auth();
  if (!session) redirect("/login");
  const user = session.user as { fullName?: string; role?: string };
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0F1023] flex items-center justify-center">
      <div className="text-center">
        <p className="text-sm text-gray-400 mb-2">Admin</p>
        <h1 className="text-2xl font-bold text-[#27295C] dark:text-white">Hola, {user.fullName} 👋</h1>
        <p className="text-gray-400 mt-2">Dashboard en construcción</p>
      </div>
    </div>
  );
}
