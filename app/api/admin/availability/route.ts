import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { availabilityRules } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === "sales_rep") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const rules = await db.select().from(availabilityRules).where(eq(availabilityRules.userId, userId));
  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === "sales_rep") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { userId, dayOfWeek, startTime, endTime, isActive } = await req.json();
  if (!userId || dayOfWeek === undefined) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });

  // Upsert — si ya existe el dia lo actualiza
  const existing = await db.select().from(availabilityRules)
    .where(and(eq(availabilityRules.userId, userId), eq(availabilityRules.dayOfWeek, dayOfWeek)))
    .limit(1);

  if (existing.length) {
    await db.update(availabilityRules)
      .set({ startTime, endTime, isActive: isActive ?? true })
      .where(and(eq(availabilityRules.userId, userId), eq(availabilityRules.dayOfWeek, dayOfWeek)));
  } else {
    await db.insert(availabilityRules).values({ userId, dayOfWeek, startTime, endTime, isActive: isActive ?? true });
  }
  return NextResponse.json({ ok: true });
}
