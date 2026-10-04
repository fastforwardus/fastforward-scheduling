import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import LlamadasClient from "@/components/dashboard/LlamadasClient";

export default async function LlamadasPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!["admin", "sales_manager", "caller"].includes(session.role)) redirect("/dashboard");
  return <LlamadasClient user={session as typeof session & { timezone?: string }} />;
}
