import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import AdminDashboardClient from "@/components/dashboard/AdminDashboardClient";
import ManagerDashboardClient from "@/components/dashboard/ManagerDashboardClient";
import SalesDashboardClient from "@/components/dashboard/SalesDashboardClient";

export default async function AppointmentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "admin") return <AdminDashboardClient user={{ ...session, id: session.id }} defaultTab="all" />;
  if (session.role === "sales_manager") return <ManagerDashboardClient user={{ ...session, id: session.id }} defaultTab="all" />;
  return <SalesDashboardClient user={{ ...session, id: session.id }} defaultTab="all" />;
}
