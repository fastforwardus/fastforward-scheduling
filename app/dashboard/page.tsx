import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "admin") redirect("/dashboard/admin");
  if (session.role === "sales_manager") redirect("/dashboard/manager");
  redirect("/dashboard/sales");
}
