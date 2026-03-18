import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const [appt] = await db.select().from(appointments)
    .where(eq(appointments.confirmToken, token)).limit(1);

  if (!appt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.update(appointments)
    .set({ status: "confirmed" })
    .where(eq(appointments.confirmToken, token));

  return NextResponse.redirect(
    new URL(`/confirm/${token}?confirmed=1`, req.url)
  );
}
