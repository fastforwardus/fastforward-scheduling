import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { timeEntries } from "@/db/schema";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { hoyNY, rangoDiaNY } from "@/lib/asistencia";

export const dynamic = "force-dynamic";

async function estadoHoy(userId: string) {
  const [ini, fin] = rangoDiaNY(hoyNY());
  const entries = await db.select({ id: timeEntries.id, punchedAt: timeEntries.punchedAt, source: timeEntries.source, kind: timeEntries.kind })
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, userId), gte(timeEntries.punchedAt, ini), lt(timeEntries.punchedAt, fin)))
    .orderBy(asc(timeEntries.punchedAt));
  const remotos = entries.filter((e) => e.source === "scheduling");
  const clockedIn = remotos.length > 0 && remotos[remotos.length - 1].kind === "in";
  return { entries, clockedIn };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await estadoHoy(session.id));
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { kind } = await req.json().catch(() => ({}));
  if (kind !== "in" && kind !== "out") return NextResponse.json({ error: "kind invalido" }, { status: 400 });
  const { clockedIn } = await estadoHoy(session.id);
  if (kind === "in" && clockedIn) return NextResponse.json({ error: "Ya hay un clock-in abierto" }, { status: 400 });
  if (kind === "out" && !clockedIn) return NextResponse.json({ error: "No hay clock-in abierto" }, { status: 400 });
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
  await db.insert(timeEntries).values({
    userId: session.id, punchedAt: new Date(), source: "scheduling", kind,
    ip, userAgent: (req.headers.get("user-agent") || "").slice(0, 300),
  });
  return NextResponse.json(await estadoHoy(session.id));
}
