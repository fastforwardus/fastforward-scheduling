import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const [user] = await db
    .select({ id: users.id, fullName: users.fullName, slug: users.slug })
    .from(users)
    .where(eq(users.slug, slug))
    .limit(1);

  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(user);
}
