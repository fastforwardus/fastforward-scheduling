import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, users, surveys, clientProfiles } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  // Sales rep solo puede ver clientes de sus propias citas
  if (session.role === "sales_rep") {
    const hasAccess = await db.select({ id: appointments.id })
      .from(appointments)
      .where(eq(appointments.clientEmail, email.toLowerCase()))
      .limit(1);
    if (!hasAccess.length) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [profile] = await db.select().from(clientProfiles)
    .where(eq(clientProfiles.email, email.toLowerCase())).limit(1);

  const appts = await db.select({
    id: appointments.id,
    clientName: appointments.clientName,
    clientCompany: appointments.clientCompany,
    clientWhatsapp: appointments.clientWhatsapp,
    clientTimezone: appointments.clientTimezone,
    clientLanguage: appointments.clientLanguage,
    serviceInterest: appointments.serviceInterest,
    exportVolume: appointments.exportVolume,
    platform: appointments.platform,
    meetingLink: appointments.meetingLink,
    scheduledAt: appointments.scheduledAt,
    status: appointments.status,
    outcome: appointments.outcome,
    notes: appointments.notes,
    nextStep: appointments.nextStep,
    leadScore: appointments.leadScore,
    noShowCount: appointments.noShowCount,
    bookedVia: appointments.bookedVia,
    confirmToken: appointments.confirmToken,
    createdAt: appointments.createdAt,
    assignedTo: appointments.assignedTo,
    repName: users.fullName,
    repEmail: users.email,
  })
  .from(appointments)
  .leftJoin(users, eq(appointments.assignedTo, users.id))
  .where(eq(appointments.clientEmail, email.toLowerCase()))
  .orderBy(desc(appointments.scheduledAt));

  const surveyResults = await db.select().from(surveys)
    .where(eq(surveys.clientEmail, email.toLowerCase()))
    .orderBy(desc(surveys.submittedAt));

  return NextResponse.json({ profile: profile || null, appointments: appts, surveys: surveyResults });
}
