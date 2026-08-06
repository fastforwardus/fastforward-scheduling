export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { recoveryNotes } from "@/db/schema";
import { and, eq, asc } from "drizzle-orm";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sourceType = req.nextUrl.searchParams.get("sourceType");
  const sourceId = req.nextUrl.searchParams.get("sourceId");
  if (!sourceType || !sourceId) return NextResponse.json({ error: "Faltan params" }, { status: 400 });

  const notes = await db.select().from(recoveryNotes)
    .where(and(eq(recoveryNotes.sourceType, sourceType), eq(recoveryNotes.sourceId, sourceId)))
    .orderBy(asc(recoveryNotes.createdAt));

  return NextResponse.json({ notes });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "sales_rep") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { sourceType, sourceId, content } = await req.json();
  if (!sourceType || !sourceId || !content?.trim()) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }
  if (!["proposal", "appointment"].includes(sourceType)) {
    return NextResponse.json({ error: "sourceType invalido" }, { status: 400 });
  }

  const [note] = await db.insert(recoveryNotes).values({
    sourceType,
    sourceId: String(sourceId),
    userId: session.id,
    authorName: session.fullName,
    content: String(content).trim(),
  }).returning();

  return NextResponse.json({ ok: true, note });
}
