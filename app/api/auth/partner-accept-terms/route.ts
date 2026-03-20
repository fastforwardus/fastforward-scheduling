import { NextResponse } from "next/server";
import { db } from "@/db";
import { partners } from "@/db/schema";
import { eq } from "drizzle-orm";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = cookies();
  const token = cookieStore.get("ff-partner-session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || "ff-secret");
  const { payload } = await jwtVerify(token, secret);

  await db.update(partners)
    .set({ termsAccepted: true, termsAcceptedAt: new Date() })
    .where(eq(partners.id, payload.id as string));

  return NextResponse.json({ ok: true });
}
