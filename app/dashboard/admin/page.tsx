import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import AdminPanelClient from "@/components/dashboard/AdminPanelClient";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard/manager");
  return <AdminPanelClient user={session} />;
}
