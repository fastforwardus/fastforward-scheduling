import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PartnerDashboardClient from "@/components/partner/PartnerDashboardClient";

export const dynamic = "force-dynamic";

export default async function PartnerDashboardPage({ params }: { params: { slug: string } }) {
  const cookieStore = cookies();
  const token = cookieStore.get("ff-partner-session")?.value;
  if (!token) redirect(`/partner/${params.slug}`);
  return <PartnerDashboardClient slug={params.slug} />;
}
