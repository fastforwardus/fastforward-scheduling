import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointmentNotes } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const appointmentId = req.nextUrl.searchParams.get("appointmentId");
  if (!appointmentId) return NextResponse.json({ error: "appointmentId required" }, { status: 400 });

  const notes = await db
    .select()
    .from(appointmentNotes)
    .where(eq(appointmentNotes.appointmentId, appointmentId))
    .orderBy(asc(appointmentNotes.createdAt));

  return NextResponse.json({ notes });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { appointmentId, content } = await req.json();
  if (!appointmentId || !content?.trim()) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }

  const [note] = await db
    .insert(appointmentNotes)
    .values({
      appointmentId,
      userId: session.id,
      authorName: session.fullName,
      authorRole: session.role,
      content: content.trim(),
    })
    .returning();

  return NextResponse.json({ ok: true, note });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const noteId = req.nextUrl.searchParams.get("noteId");
  if (!noteId) return NextResponse.json({ error: "noteId required" }, { status: 400 });

  // Solo puede borrar el autor o admin
  const [note] = await db
    .select()
    .from(appointmentNotes)
    .where(eq(appointmentNotes.id, noteId))
    .limit(1);

  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (note.userId !== session.id && session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(appointmentNotes).where(eq(appointmentNotes.id, noteId));
  return NextResponse.json({ ok: true });
}
