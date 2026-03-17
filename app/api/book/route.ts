import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, users, clientProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      clientName, clientEmail, clientCompany, clientWhatsapp,
      clientTimezone, clientLanguage, serviceInterest, exportVolume,
      platform, repSlug, utmSource, scheduledAt,
    } = body;

    // Validar campos requeridos
    if (!clientName || !clientEmail || !clientCompany || !clientWhatsapp || !scheduledAt || !platform) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    // Buscar el sales rep si viene con slug
    let assignedTo: string | null = null;
    let status: "scheduled" | "pending_assignment" = "pending_assignment";

    if (repSlug && repSlug !== "general") {
      const [rep] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.slug, repSlug))
        .limit(1);

      if (rep) {
        assignedTo = rep.id;
        status = "scheduled";
      }
    }

    const confirmToken = nanoid(32);

    const [appointment] = await db
      .insert(appointments)
      .values({
        clientName,
        clientEmail: clientEmail.toLowerCase().trim(),
        clientCompany,
        clientWhatsapp,
        clientTimezone: clientTimezone || "America/Argentina/Buenos_Aires",
        clientLanguage: clientLanguage || "es",
        serviceInterest,
        exportVolume,
        isB2b: true,
        platform,
        assignedTo,
        bookedVia: repSlug || "general",
        scheduledAt: new Date(scheduledAt),
        status,
        confirmToken,
        leadScore: "warm",
        utmSource,
      })
      .returning();

    // Upsert client profile
    await db
      .insert(clientProfiles)
      .values({
        email: clientEmail.toLowerCase().trim(),
        name: clientName,
        company: clientCompany,
        whatsapp: clientWhatsapp,
        timezone: clientTimezone,
        language: clientLanguage || "es",
        isB2b: true,
      })
      .onConflictDoUpdate({
        target: clientProfiles.email,
        set: { name: clientName, company: clientCompany, whatsapp: clientWhatsapp },
      });

    return NextResponse.json({
      ok: true,
      appointmentId: appointment.id,
      confirmToken,
      status: appointment.status,
      isPendingAssignment: status === "pending_assignment",
    });

  } catch (err) {
    console.error("Book error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
