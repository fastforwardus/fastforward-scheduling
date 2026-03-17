import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import ManagerDashboardClient from "@/components/dashboard/ManagerDashboardClient";

export default async function ManagerPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "sales_rep") redirect("/dashboard/sales");
  return <ManagerDashboardClient user={session} />;
}
