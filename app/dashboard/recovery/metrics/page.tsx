import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import RecoveryMetricsClient from "@/components/dashboard/RecoveryMetricsClient";

export default async function RecoveryMetricsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "sales_rep") {
    const [u] = await db.select({ can: users.canRecovery }).from(users)
      .where(eq(users.id, session.id)).limit(1);
    if (!u?.can) redirect("/dashboard/sales");
  }
  return <RecoveryMetricsClient user={session} />;
}
