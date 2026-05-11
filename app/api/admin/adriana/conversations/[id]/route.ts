export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { adrianaConversations, adrianaMessages, adrianaSatisfaction, appointments } from "@/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { getSession } from "@/lib/session";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const [conv] = await db
    .select()
    .from(adrianaConversations)
    .where(eq(adrianaConversations.id, id))
    .limit(1);

  if (!conv) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const messages = await db
    .select()
    .from(adrianaMessages)
    .where(eq(adrianaMessages.conversationId, id))
    .orderBy(asc(adrianaMessages.createdAt));

  const [satisfaction] = await db
    .select()
    .from(adrianaSatisfaction)
    .where(eq(adrianaSatisfaction.conversationId, id))
    .limit(1);

  // Si hay appointment vinculada, traerla
  let appointment = null;
  if (conv.appointmentId) {
    const [apt] = await db
      .select({
        id: appointments.id,
        clientName: appointments.clientName,
        clientEmail: appointments.clientEmail,
        scheduledAt: appointments.scheduledAt,
        clientTimezone: appointments.clientTimezone,
        status: appointments.status,
        platform: appointments.platform,
        meetingLink: appointments.meetingLink,
        clientNotes: appointments.clientNotes,
      })
      .from(appointments)
      .where(sql`${appointments.id}::text = ${conv.appointmentId}`)
      .limit(1);
    if (apt) appointment = apt;
  }

  return NextResponse.json({
    conversation: conv,
    messages,
    satisfaction: satisfaction ?? null,
    appointment,
  });
}
