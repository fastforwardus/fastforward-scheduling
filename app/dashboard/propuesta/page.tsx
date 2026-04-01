import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import PropuestaDirectaClient from "@/components/dashboard/PropuestaDirectaClient";

export default async function PropuestaDirectaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <PropuestaDirectaClient user={{ ...session, id: session.id }} />;
}
