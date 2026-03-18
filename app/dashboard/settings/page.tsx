import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import SettingsClient from "@/components/dashboard/SettingsClient";
import { Suspense } from "react";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <Suspense fallback={<div />}>
      <SettingsClient user={session} />
    </Suspense>
  );
}
