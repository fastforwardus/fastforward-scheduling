import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import AdrianaConversationsClient from "@/components/dashboard/AdrianaConversationsClient";

export default async function AdrianaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "recovery") redirect("/dashboard");
  return <AdrianaConversationsClient user={session} />;
}
