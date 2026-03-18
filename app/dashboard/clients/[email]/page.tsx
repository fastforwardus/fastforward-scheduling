import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import ClientHistoryClient from "@/components/dashboard/ClientHistoryClient";

export default async function ClientPage({ params }: { params: { email: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const email = decodeURIComponent(params.email);
  return <ClientHistoryClient user={session} clientEmail={email} />;
}
