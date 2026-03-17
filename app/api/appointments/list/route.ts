import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, users } from "@/db/schema";
import { eq, desc, isNull } from "drizzle-orm";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter"); // "unassigned" | "mine" | "all"

  try {
    const rows = await db
      .select({
        id: appointments.id,
        clientName: appointments.clientName,
        clientEmail: appointments.clientEmail,
        clientCompany: appointments.clientCompany,
        clientWhatsapp: appointments.clientWhatsapp,
        clientTimezone: appointments.clientTimezone,
        clientLanguage: appointments.clientLanguage,
        serviceInterest: appointments.serviceInterest,
        platform: appointments.platform,
        scheduledAt: appointments.scheduledAt,
        status: appointments.status,
        outcome: appointments.outcome,
        notes: appointments.notes,
        leadScore: appointments.leadScore,
        bookedVia: appointments.bookedVia,
        assignedTo: appointments.assignedTo,
        createdAt: appointments.createdAt,
        repName: users.fullName,
        repEmail: users.email,
        repSlug: users.slug,
      })
      .from(appointments)
      .leftJoin(users, eq(appointments.assignedTo, users.id))
      .orderBy(desc(appointments.scheduledAt));

    let filtered = rows;

    if (filter === "unassigned") {
      filtered = rows.filter(r => !r.assignedTo);
    } else if (filter === "mine") {
      filtered = rows.filter(r => r.assignedTo === session.id);
    } else if (session.role === "sales_rep") {
      // Sales rep solo ve las suyas
      filtered = rows.filter(r => r.assignedTo === session.id);
    }

    return NextResponse.json({ appointments: filtered });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
