import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { holidays } from "@/db/schema";

import { appointments } from "@/db/schema";
import { gte } from "drizzle-orm";
import { addMinutes, isBefore, addDays, startOfDay } from "date-fns";
import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { format } from "date-fns";

const MIAMI = "America/New_York";
const SLOT_DURATION = 30;
const DAY_START = { h: 10, m: 30 };
const DAY_END   = { h: 19, m: 30 };

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientTz = searchParams.get("timezone") || MIAMI;

    const now = new Date();

    // Get all booked slots from now forward
    const booked = await db
      .select({ scheduledAt: appointments.scheduledAt })
      .from(appointments)
      .where(gte(appointments.scheduledAt, now));

    const bookedSet = new Set(booked.map((b) => new Date(b.scheduledAt).toISOString()));

    const slots: { utc: string; label: string; date: string }[] = [];

    // Generate next 14 weekdays
    for (let d = 0; d <= 21; d++) {
      const dayUTC = addDays(startOfDay(now), d);
      const dayMiami = toZonedTime(dayUTC, MIAMI);
      const dow = dayMiami.getDay(); // 0=Sun 6=Sat
      if (dow === 0 || dow === 6) continue;

      const dateStr = format(dayMiami, "yyyy-MM-dd");

      let slotUTC = fromZonedTime(
        `${dateStr}T${String(DAY_START.h).padStart(2,"0")}:${String(DAY_START.m).padStart(2,"0")}:00`,
        MIAMI
      );
      const endUTC = fromZonedTime(
        `${dateStr}T${String(DAY_END.h).padStart(2,"0")}:${String(DAY_END.m).padStart(2,"0")}:00`,
        MIAMI
      );

      while (isBefore(slotUTC, endUTC)) {
        // At least 2h from now
        if (slotUTC > addMinutes(now, 120) && !bookedSet.has(slotUTC.toISOString())) {
          // Date label in CLIENT timezone
          const dateInClientTz = formatInTimeZone(slotUTC, clientTz, "yyyy-MM-dd");
          slots.push({
            utc: slotUTC.toISOString(),
            label: formatInTimeZone(slotUTC, clientTz, "h:mm a"),
            date: dateInClientTz,
          });
        }
        slotUTC = addMinutes(slotUTC, SLOT_DURATION);
      }
    }

    // Group by date in CLIENT timezone
    const grouped: Record<string, typeof slots> = {};
    for (const slot of slots) {
      if (!grouped[slot.date]) grouped[slot.date] = [];
      grouped[slot.date].push(slot);
    }

    return NextResponse.json({ slots, grouped, timezone: clientTz });
  } catch (err) {
    console.error("Slots error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
