import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import StatusClient from "@/components/dashboard/StatusClient";

export default async function StatusPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <StatusClient isAdmin={session.role === "admin"} />;
}
