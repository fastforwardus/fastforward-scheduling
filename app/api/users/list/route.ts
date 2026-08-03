import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, appointments } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { getAvailableRepIds } from "@/lib/slots";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const reps = await db
    .select({ id: users.id, fullName: users.fullName, email: users.email, role: users.role, slug: users.slug })
    .from(users)
    .where(eq(users.isActive, true));

  // ?at=<ISO> -> agrega flags de conflicto y disponibilidad para ese horario
  const at = req.nextUrl.searchParams.get("at");
  if (!at) return NextResponse.json({ users: reps });

  const slot = new Date(at);
  if (isNaN(slot.getTime())) return NextResponse.json({ users: reps });

  try {
    const busy = await db
      .select({ assignedTo: appointments.assignedTo })
      .from(appointments)
      .where(and(
        eq(appointments.scheduledAt, slot),
        ne(appointments.status, "cancelled"),
      ));
    const busyIds = new Set(busy.map((b) => b.assignedTo).filter(Boolean) as string[]);
    const availableIds = await getAvailableRepIds(slot);

    return NextResponse.json({
      users: reps.map((r) => ({
        ...r,
        hasConflict: busyIds.has(r.id),
        isAvailable: availableIds.has(r.id),
      })),
    });
  } catch (err) {
    console.error("users/list flags error:", err);
    return NextResponse.json({ users: reps });
  }
}
