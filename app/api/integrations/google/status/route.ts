import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ connected: false });
  const [user] = await db.select({ googleRefreshToken: users.googleRefreshToken })
    .from(users).where(eq(users.id, session.id)).limit(1);
  return NextResponse.json({ connected: !!user?.googleRefreshToken });
}
