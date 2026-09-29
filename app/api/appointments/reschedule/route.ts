export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { rescheduleAppointment } from "@/lib/reschedule";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { appointmentId, newScheduledAt } = await req.json();
  if (!appointmentId || !newScheduledAt) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });

  const r = await rescheduleAppointment(appointmentId, new Date(newScheduledAt));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  return NextResponse.json({ ok: true, meetingLink: r.meetingLink });
}
