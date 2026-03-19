import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { hashSync } from "bcryptjs";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const all = await db.select({
    id: users.id, fullName: users.fullName, email: users.email,
    role: users.role, slug: users.slug, isActive: users.isActive,
    whatsappPhone: users.whatsappPhone, googleRefreshToken: users.googleRefreshToken,
    timezone: users.timezone,
  }).from(users).orderBy(users.createdAt);
  return NextResponse.json({ users: all });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { fullName, email, role, slug, whatsappPhone, password, timezone } = await req.json();
  if (!fullName || !email || !role || !password) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });

  const passwordHash = hashSync(password, 12);
  const [user] = await db.insert(users).values({
    fullName, email: email.toLowerCase().trim(), passwordHash,
    role, slug: slug || null, whatsappPhone: whatsappPhone || null,
    timezone: timezone || "America/New_York", isActive: true,
  }).returning();

  // Availability default Mon-Fri 10:30-19:30
  const { availabilityRules } = await import("@/db/schema");
  for (const day of [1,2,3,4,5]) {
    await db.insert(availabilityRules).values({
      userId: user.id, dayOfWeek: day, startTime: "10:30", endTime: "19:30", isActive: true,
    }).onConflictDoNothing();
  }

  return NextResponse.json({ ok: true, user });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, fullName, email, role, slug, whatsappPhone, isActive, password, timezone } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updates: Record<string, unknown> = { fullName, email, role, slug, whatsappPhone, timezone: timezone || "America/New_York", isActive };
  if (password) updates.passwordHash = hashSync(password, 12);

  await db.update(users).set(updates).where(eq(users.id, id));
  return NextResponse.json({ ok: true });
}
