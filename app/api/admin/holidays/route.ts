import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { holidays } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";

export async function GET() {
  const all = await db.select().from(holidays).orderBy(holidays.date);
  return NextResponse.json({ holidays: all });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { date, reason } = await req.json();
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });
  await db.insert(holidays).values({ date, reason: reason || null, createdBy: session.id })
    .onConflictDoNothing();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { date } = await req.json();
  await db.delete(holidays).where(eq(holidays.date, date));
  return NextResponse.json({ ok: true });
}
