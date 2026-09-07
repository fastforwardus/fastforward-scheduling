import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import FacturaNuevaClient from "@/components/dashboard/FacturaNuevaClient";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <FacturaNuevaClient user={session} />;
}
