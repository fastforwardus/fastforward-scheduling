import { NextResponse } from "next/server";
import { db } from "@/db";
import { appointments } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = cookies();
  const token = cookieStore.get("ff-partner-session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || "ff-secret");
  const { payload } = await jwtVerify(token, secret);
  const slug = payload.slug as string;

  const appts = await db.select({
    id: appointments.id,
    clientName: appointments.clientName,
    clientCompany: appointments.clientCompany,
    serviceInterest: appointments.serviceInterest,
    scheduledAt: appointments.scheduledAt,
    status: appointments.status,
    outcome: appointments.outcome,
    createdAt: appointments.createdAt,
  }).from(appointments)
    .where(eq(appointments.partnerSlug, slug))
    .orderBy(desc(appointments.scheduledAt));

  return NextResponse.json({ appointments: appts, partnerName: payload.name });
}
