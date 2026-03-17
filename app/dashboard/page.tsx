import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = (session.user as any).role;

  if (role === "admin") redirect("/dashboard/admin");
  if (role === "sales_manager") redirect("/dashboard/manager");
  redirect("/dashboard/sales");
}
