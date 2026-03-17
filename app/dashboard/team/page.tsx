import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import TeamPageClient from "@/components/dashboard/TeamPageClient";

export default async function TeamPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "sales_rep") redirect("/dashboard/sales");
  return <TeamPageClient user={session} />;
}
