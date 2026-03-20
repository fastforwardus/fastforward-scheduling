import { redirect } from "next/navigation";
import { db } from "@/db";
import { partners } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function PartnerBookPage({ params }: { params: { slug: string } }) {
  const [partner] = await db.select().from(partners)
    .where(eq(partners.slug, params.slug)).limit(1);

  if (!partner || !partner.isActive) redirect("/book");

  redirect(`/book?partner=${params.slug}&utm_source=partner_${params.slug}&utm_medium=referral`);
}
