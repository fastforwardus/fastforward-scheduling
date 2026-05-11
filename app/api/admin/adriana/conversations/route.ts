export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { adrianaConversations, adrianaMessages, adrianaSatisfaction, appointments } from "@/db/schema";
import { sql, desc, eq, and, or, ilike, gte, lte } from "drizzle-orm";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q       = searchParams.get("q")?.trim() || "";
  const lang    = searchParams.get("lang") || "";
  const status  = searchParams.get("status") || "";
  const dateFrom = searchParams.get("date_from") || "";
  const dateTo   = searchParams.get("date_to") || "";

  const filters = [];
  if (q) {
    filters.push(or(
      ilike(adrianaConversations.waPhone, `%${q}%`),
      ilike(adrianaConversations.waProfileName, `%${q}%`),
      ilike(adrianaConversations.leadName, `%${q}%`),
      ilike(adrianaConversations.leadEmail, `%${q}%`),
      ilike(adrianaConversations.leadCompany, `%${q}%`),
    ));
  }
  if (lang)    filters.push(eq(adrianaConversations.language, lang as "es" | "en" | "pt"));
  if (status)  filters.push(eq(adrianaConversations.status, status));
  if (dateFrom) filters.push(gte(adrianaConversations.createdAt, new Date(dateFrom)));
  if (dateTo) {
    const to = new Date(dateTo);
    to.setUTCHours(23, 59, 59, 999);
    filters.push(lte(adrianaConversations.createdAt, to));
  }

  const where = filters.length > 0 ? and(...filters) : undefined;

  // Conversaciones + contadores
  const rows = await db
    .select({
      id: adrianaConversations.id,
      waPhone: adrianaConversations.waPhone,
      waProfileName: adrianaConversations.waProfileName,
      language: adrianaConversations.language,
      timezone: adrianaConversations.timezone,
      leadName: adrianaConversations.leadName,
      leadEmail: adrianaConversations.leadEmail,
      leadCompany: adrianaConversations.leadCompany,
      leadCountry: adrianaConversations.leadCountry,
      leadProductType: adrianaConversations.leadProductType,
      leadChannel: adrianaConversations.leadChannel,
      leadTimeline: adrianaConversations.leadTimeline,
      zohoLeadId: adrianaConversations.zohoLeadId,
      appointmentId: adrianaConversations.appointmentId,
      bookedAt: adrianaConversations.bookedAt,
      surveyDoneAt: adrianaConversations.surveyDoneAt,
      status: adrianaConversations.status,
      lastUserMsgAt: adrianaConversations.lastUserMsgAt,
      lastAssistantMsgAt: adrianaConversations.lastAssistantMsgAt,
      createdAt: adrianaConversations.createdAt,
      updatedAt: adrianaConversations.updatedAt,
      messageCount: sql<number>`(SELECT COUNT(*)::int FROM ${adrianaMessages} WHERE ${adrianaMessages.conversationId} = ${adrianaConversations.id})`,
      satisfactionScore: sql<number | null>`(SELECT score FROM ${adrianaSatisfaction} WHERE ${adrianaSatisfaction.conversationId} = ${adrianaConversations.id} ORDER BY created_at DESC LIMIT 1)`,
    })
    .from(adrianaConversations)
    .where(where)
    .orderBy(desc(sql`COALESCE(${adrianaConversations.lastUserMsgAt}, ${adrianaConversations.createdAt})`))
    .limit(200);

  // Stats agregadas
  const stats = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      booked: sql<number>`COUNT(*) FILTER (WHERE ${adrianaConversations.bookedAt} IS NOT NULL)::int`,
      survey: sql<number>`COUNT(*) FILTER (WHERE ${adrianaConversations.surveyDoneAt} IS NOT NULL)::int`,
    })
    .from(adrianaConversations);

  return NextResponse.json({ conversations: rows, stats: stats[0] });
}
