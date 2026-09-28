import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { timeEntries, users } from "@/db/schema";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { agruparPorDia, hoyNY, rangoDiaNY } from "@/lib/asistencia";
import { ngtecoCfg } from "@/lib/ngteco";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !["admin", "sales_manager"].includes(session.role)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const hoy = hoyNY();
  const from = req.nextUrl.searchParams.get("from") || hoy;
  const to = req.nextUrl.searchParams.get("to") || hoy;
  const [ini] = rangoDiaNY(from);
  const [, fin] = rangoDiaNY(to);
  const rows = await db.select({ userId: timeEntries.userId, fullName: users.fullName, punchedAt: timeEntries.punchedAt, source: timeEntries.source, kind: timeEntries.kind })
    .from(timeEntries).innerJoin(users, eq(timeEntries.userId, users.id))
    .where(and(gte(timeEntries.punchedAt, ini), lt(timeEntries.punchedAt, fin)))
    .orderBy(asc(timeEntries.punchedAt));
  const lastSync = await ngtecoCfg("NGTECO_LAST_SYNC");
  const lastError = await ngtecoCfg("NGTECO_LAST_ERROR");
  const reps = await db.select({ id: users.id, fullName: users.fullName, ngtecoId: users.ngtecoId, hourlyRate: users.hourlyRate, isActive: users.isActive })
    .from(users).orderBy(asc(users.fullName));
  return NextResponse.json({
    filas: agruparPorDia(rows),
    lastSync: lastSync ? JSON.parse(lastSync) : null,
    lastError,
    reps: reps.filter((r) => r.isActive).map((r) => ({ id: r.id, fullName: r.fullName, ngtecoId: r.ngtecoId, hourlyRate: session.role === "admin" ? r.hourlyRate : null })),
  });
}

// Admin: edita ID de NGTeco y tarifa por hora de una persona
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { userId, ngtecoId, hourlyRate } = await req.json().catch(() => ({}));
  if (!userId) return NextResponse.json({ error: "userId requerido" }, { status: 400 });
  const set: { ngtecoId?: string | null; hourlyRate?: string | null } = {};
  if (ngtecoId !== undefined) set.ngtecoId = ngtecoId ? String(ngtecoId).trim().toUpperCase() : null;
  if (hourlyRate !== undefined) set.hourlyRate = hourlyRate === "" || hourlyRate === null ? null : String(Number(hourlyRate));
  await db.update(users).set(set).where(eq(users.id, userId));
  return NextResponse.json({ ok: true });
}
