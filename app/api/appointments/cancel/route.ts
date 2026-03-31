import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "sales_manager")) 
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { appointmentId } = await req.json();
  await db.update(appointments).set({ status: "cancelled" }).where(eq(appointments.id, appointmentId));
  return NextResponse.json({ ok: true });
}
