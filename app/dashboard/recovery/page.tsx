import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import RecoveryClient from "@/components/dashboard/RecoveryClient";

export default async function RecoveryPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "sales_rep") {
    const [u] = await db.select({ can: users.canRecovery }).from(users)
      .where(eq(users.id, session.id)).limit(1);
    if (!u?.can) redirect("/dashboard/sales");
  }
  return <RecoveryClient user={session} />;
}
