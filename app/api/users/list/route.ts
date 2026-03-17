import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const reps = await db
    .select({ id: users.id, fullName: users.fullName, email: users.email, role: users.role, slug: users.slug })
    .from(users)
    .where(eq(users.isActive, true));

  return NextResponse.json({ users: reps });
}
