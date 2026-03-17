import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { availabilityRules, appointments } from "@/db/schema";
import { eq, and, gte, lt } from "drizzle-orm";
import { addMinutes, format, isBefore, addDays, startOfDay } from "date-fns";
import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";

const EST = "America/New_York";
const SLOT_DURATION = 30;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const timezone = searchParams.get("timezone") || EST;

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const rules = await db
      .select()
      .from(availabilityRules)
      .where(and(eq(availabilityRules.userId, userId), eq(availabilityRules.isActive, true)));

    if (!rules.length) {
      return NextResponse.json({ slots: [] });
    }

    const now = new Date();
    const slots: { utc: string; label: string; date: string }[] = [];

    // Next 14 weekdays
    for (let d = 0; d <= 20; d++) {
      const dayUTC = addDays(startOfDay(now), d);
      const dayEST = toZonedTime(dayUTC, EST);
      const dow = dayEST.getDay(); // 0=Sun, 6=Sat
      if (dow === 0 || dow === 6) continue;

      const isoDay = dow === 0 ? 7 : dow; // 1=Mon..5=Fri

      const rule = rules.find((r) => r.dayOfWeek === isoDay);
      if (!rule) continue;

      const [sh, sm] = rule.startTime.split(":").map(Number);
      const [eh, em] = rule.endTime.split(":").map(Number);

      // Build slots in EST
      const dateStr = format(dayEST, "yyyy-MM-dd");
      let slotEST = fromZonedTime(`${dateStr}T${String(sh).padStart(2,"0")}:${String(sm).padStart(2,"0")}:00`, EST);
      const endEST = fromZonedTime(`${dateStr}T${String(eh).padStart(2,"0")}:${String(em).padStart(2,"0")}:00`, EST);

      while (isBefore(slotEST, endEST)) {
        // Must be at least 1h from now
        if (slotEST > addMinutes(now, 60)) {
          slots.push({
            utc: slotEST.toISOString(),
            label: formatInTimeZone(slotEST, timezone, "h:mm a"),
            date: formatInTimeZone(slotEST, timezone, "yyyy-MM-dd"),
          });
        }
        slotEST = addMinutes(slotEST, SLOT_DURATION);
      }
    }

    // Remove already-booked slots
    const booked = await db
      .select({ scheduledAt: appointments.scheduledAt })
      .from(appointments)
      .where(
        and(
          eq(appointments.assignedTo, userId),
          gte(appointments.scheduledAt, now),
        )
      );

    const bookedSet = new Set(booked.map((b) => b.scheduledAt.toISOString()));
    const available = slots.filter((s) => !bookedSet.has(s.utc));

    // Group by date
    const grouped: Record<string, typeof available> = {};
    for (const slot of available) {
      if (!grouped[slot.date]) grouped[slot.date] = [];
      grouped[slot.date].push(slot);
    }

    return NextResponse.json({ slots: available, grouped, timezone });
  } catch (err) {
    console.error("Slots error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
