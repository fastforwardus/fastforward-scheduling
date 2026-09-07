import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import ActividadPageClient from "@/components/dashboard/ActividadPageClient";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <ActividadPageClient user={session} />;
}
