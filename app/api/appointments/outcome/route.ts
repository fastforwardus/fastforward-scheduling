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

  return NextResponse.json({ ok: true });
}
