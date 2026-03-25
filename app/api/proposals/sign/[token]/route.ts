import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { proposals, appointments } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const [proposal] = await db.select().from(proposals)
    .where(eq(proposals.confirmToken, params.token)).limit(1);
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (proposal.status === "accepted") return NextResponse.json({ ok: true, alreadyAccepted: true });

  const [appt] = await db.select({
    clientName: appointments.clientName,
    clientEmail: appointments.clientEmail,
  }).from(appointments).where(eq(appointments.id, proposal.appointmentId)).limit(1);

  await db.update(proposals).set({ status: "accepted", acceptedAt: new Date() })
    .where(eq(proposals.id, proposal.id));

  return NextResponse.json({ ok: true, clientName: appt?.clientName });
}
