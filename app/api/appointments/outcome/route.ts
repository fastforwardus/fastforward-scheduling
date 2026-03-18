import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { appointmentId, outcome, nextStep, notes, status } = await req.json();
  if (!appointmentId) return NextResponse.json({ error: "appointmentId required" }, { status: 400 });

  const [appt] = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
  if (!appt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (session.role === "sales_rep" && appt.assignedTo !== session.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let leadScore = appt.leadScore;
  if (outcome === "closed" || outcome === "proposal_sent") leadScore = "hot";
  else if (outcome === "interested") leadScore = "warm";
  else if (outcome === "not_qualified") leadScore = "cold";

  await db.update(appointments)
    .set({ outcome: outcome || null, nextStep: nextStep || null, notes: notes || null, status: status || "completed", leadScore })
    .where(eq(appointments.id, appointmentId));

  // Crear secuencia de follow-up si el outcome lo amerita
  const shouldFollowUp = ["interested", "needs_time", "proposal_sent"].includes(outcome);
  if (shouldFollowUp && status === "completed") {
    const now = new Date();
    const nextSendAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // dia 1 manana

    // Verificar si ya existe una secuencia
    const { followUpSequences } = await import("@/db/schema");
    const { eq: eqSeq } = await import("drizzle-orm");
    const existing = await db.select().from(followUpSequences)
      .where(eqSeq(followUpSequences.appointmentId, appointmentId)).limit(1);

    if (!existing.length) {
      await db.insert(followUpSequences).values({
        appointmentId,
        currentStep: 0,
        nextSendAt,
        isActive: true,
      });
    } else {
      await db.update(followUpSequences)
        .set({ isActive: true, nextSendAt, currentStep: 0, completedAt: null })
        .where(eqSeq(followUpSequences.appointmentId, appointmentId));
    }
  }

  return NextResponse.json({ ok: true });
}
