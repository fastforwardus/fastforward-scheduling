import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import AsistenciaClient from "@/components/dashboard/AsistenciaClient";

export default async function AsistenciaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!["admin", "sales_manager"].includes(session.role)) redirect("/dashboard/sales");
  return <AsistenciaClient isAdmin={session.role === "admin"} />;
}
