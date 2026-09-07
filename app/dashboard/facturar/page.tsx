import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import FacturarClient from "@/components/dashboard/FacturarClient";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <FacturarClient user={session} />;
}
