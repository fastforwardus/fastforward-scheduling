import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import PropuestasClient from "@/components/dashboard/PropuestasClient";

export default async function PropuestasPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <PropuestasClient user={{ ...session, id: session.id }} />;
}
