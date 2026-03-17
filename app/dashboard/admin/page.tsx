import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import AdminDashboardClient from "@/components/dashboard/AdminDashboardClient";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard/manager");
  return <AdminDashboardClient user={{ ...session, id: session.id }} />;
}
