import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const appts = await db.select({
    id: appointments.id,
    clientName: appointments.clientName,
    clientCompany: appointments.clientCompany,
    scheduledAt: appointments.scheduledAt,
    status: appointments.status,
    outcome: appointments.outcome,
  }).from(appointments)
    .where(eq(appointments.partnerSlug, params.slug))
    .orderBy(appointments.scheduledAt);

  return NextResponse.json({ appointments: appts });
}
