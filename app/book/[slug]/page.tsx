import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import BookWizard from "@/components/booking/BookWizard";

export default async function PersonalBookPage({ params }: { params: { slug: string } }) {
  const [rep] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      slug: users.slug,
      avatarUrl: users.avatarUrl,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.slug, params.slug))
    .limit(1);

  if (!rep || !rep.isActive) notFound();

  return (
    <BookWizard
      repSlug={rep.slug ?? undefined}
      repInfo={{ fullName: rep.fullName, slug: rep.slug ?? "", avatarUrl: rep.avatarUrl ?? undefined }}
    />
  );
}
