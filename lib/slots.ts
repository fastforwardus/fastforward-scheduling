import { db } from "@/db";
import { holidays, appointments } from "@/db/schema";
import { gte } from "drizzle-orm";
import { addMinutes, isBefore, addDays, startOfDay, format } from "date-fns";
import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";

export const MIAMI = "America/New_York";
export const SLOT_DURATION = 30;
export const DAY_START = { h: 10, m: 30 };
export const DAY_END   = { h: 19, m: 30 };

export interface AvailableSlot {
  utc: string;
  label: string;
  date: string;
}

export interface SlotsResult {
  slots: AvailableSlot[];
  grouped: Record<string, AvailableSlot[]>;
  timezone: string;
}

export async function generateAvailableSlots(clientTz: string = MIAMI): Promise<SlotsResult> {
  const now = new Date();

  const booked = await db
    .select({ scheduledAt: appointments.scheduledAt })
    .from(appointments)
    .where(gte(appointments.scheduledAt, now));

  const bookedSet = new Set(booked.map((b) => new Date(b.scheduledAt).toISOString()));

  const slots: AvailableSlot[] = [];

  for (let d = 0; d <= 21; d++) {
    const dayUTC = addDays(startOfDay(now), d);
    const dayMiami = toZonedTime(dayUTC, MIAMI);
    const dow = dayMiami.getDay();
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
      if (slotUTC > addMinutes(now, 120) && !bookedSet.has(slotUTC.toISOString())) {
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

  const holidayList = await db.select({ date: holidays.date }).from(holidays);
  const holidayDates = new Set(holidayList.map(h => h.date));

  const filteredSlots = slots.filter(slot => !holidayDates.has(slot.utc.split("T")[0]));

  const grouped: Record<string, AvailableSlot[]> = {};
  for (const slot of filteredSlots) {
    if (!grouped[slot.date]) grouped[slot.date] = [];
    grouped[slot.date].push(slot);
  }

  return { slots: filteredSlots, grouped, timezone: clientTz };
}
