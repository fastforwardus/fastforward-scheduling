import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import RecoveryClient from "@/components/dashboard/RecoveryClient";

export default async function RecoveryPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "sales_rep") redirect("/dashboard/sales");
  return <RecoveryClient user={session} />;
}
