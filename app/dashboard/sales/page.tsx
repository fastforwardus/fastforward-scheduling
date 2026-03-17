import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import SalesDashboardClient from "@/components/dashboard/SalesDashboardClient";

export default async function SalesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <SalesDashboardClient user={session} />;
}
