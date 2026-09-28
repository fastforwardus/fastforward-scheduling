import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import SalesDashboardClient from "@/components/dashboard/SalesDashboardClient";
import ClockInOut from "@/components/dashboard/ClockInOut";

export default async function SalesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const ficha = session.role === "sales_rep" || session.role === "sales_manager";
  return (
    <>
      {ficha && <ClockInOut />}
      <SalesDashboardClient user={{ ...session, id: session.id }} />
    </>
  );
}
