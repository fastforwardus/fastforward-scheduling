import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { wizardSessions } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { email, name, company, stepReached, serviceInterest, partnerSlug, utmSource, completed } = await req.json();
    if (!email) return NextResponse.json({ ok: false });

    // Upsert por email — mantener la sesion mas reciente
    const existing = await db.select().from(wizardSessions)
      .where(and(eq(wizardSessions.email, email.toLowerCase()), eq(wizardSessions.completed, false)))
      .limit(1);

    if (existing.length) {
      await db.update(wizardSessions)
        .set({
          name: name || existing[0].name,
          company: company || existing[0].company,
          stepReached: stepReached || existing[0].stepReached,
          serviceInterest: serviceInterest || existing[0].serviceInterest,
          completed: completed || false,
          updatedAt: new Date(),
        })
        .where(eq(wizardSessions.id, existing[0].id));
    } else {
      await db.insert(wizardSessions).values({
        email: email.toLowerCase(),
        name: name || null,
        company: company || null,
        stepReached: stepReached || 1,
        serviceInterest: serviceInterest || null,
        partnerSlug: partnerSlug || null,
        utmSource: utmSource || null,
        completed: completed || false,
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
