import { db } from "@/db";
import { holidays, appointments, users, availabilityRules } from "@/db/schema";
import { gte, eq, and, notInArray } from "drizzle-orm";
import { addMinutes, isBefore, addDays } from "date-fns";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

export const MIAMI = "America/New_York";
export const SLOT_DURATION = 30;
export const DAYS_AHEAD = 21;
export const MIN_LEAD_MINUTES = 120;
// Franja razonable en hora LOCAL DEL CLIENTE, no de Miami. Con Emiliano
// atendiendo desde Bari el pool arranca 2 AM Miami: eso es 8 AM en Madrid
// (bien) pero 2 AM en Nueva York (absurdo). Filtramos por donde esta el cliente.
export const HORA_MIN_CLIENTE = 7;
export const HORA_MAX_CLIENTE = 21;

export interface AvailableSlot {
  utc: string;
  label: string;
  date: string;
  capacity: number;
}

export interface SlotsResult {
  slots: AvailableSlot[];
  grouped: Record<string, AvailableSlot[]>;
  timezone: string;
}

export async function generateAvailableSlots(
  clientTz: string = MIAMI,
  repSlug?: string,
): Promise<SlotsResult> {
  const now = new Date();

  const allReps = await db
    .select({
      id: users.id,
      slug: users.slug,
      tz: users.availabilityTimezone,
      fallbackTz: users.timezone,
    })
    .from(users)
    .where(eq(users.isActive, true));

  // Link personal: solo la agenda de ese rep. Sin esto el cliente ve horarios
  // que su rep no cubre y la cita termina asignada a alguien que no trabaja.
  const reps = repSlug && repSlug !== "general"
    ? allReps.filter((r) => r.slug === repSlug)
    : allReps;

  const rules = await db
    .select({
      userId: availabilityRules.userId,
      dayOfWeek: availabilityRules.dayOfWeek,
      startTime: availabilityRules.startTime,
      endTime: availabilityRules.endTime,
    })
    .from(availabilityRules)
    .where(eq(availabilityRules.isActive, true));

  const rulesByRep = new Map<string, Map<number, { startTime: string; endTime: string }>>();
  for (const r of rules) {
    if (!rulesByRep.has(r.userId)) rulesByRep.set(r.userId, new Map());
    rulesByRep.get(r.userId)!.set(r.dayOfWeek, { startTime: r.startTime, endTime: r.endTime });
  }

  // Capacidad bruta: cuantos reps trabajan en cada instante
  const capacity = new Map<string, number>();

  for (const rep of reps) {
    const repRules = rulesByRep.get(rep.id);
    if (!repRules || repRules.size === 0) continue;
    const tz = rep.tz || rep.fallbackTz || MIAMI;

    for (let d = 0; d <= DAYS_AHEAD; d++) {
      const ref = addDays(now, d);
      const dateStr = formatInTimeZone(ref, tz, "yyyy-MM-dd");
      const dow = Number(formatInTimeZone(ref, tz, "i")) % 7; // 0=dom .. 6=sab
      const rule = repRules.get(dow);
      if (!rule) continue;

      let slotUTC = fromZonedTime(`${dateStr}T${rule.startTime}`, tz);
      const endUTC = fromZonedTime(`${dateStr}T${rule.endTime}`, tz);

      while (isBefore(slotUTC, endUTC)) {
        const iso = slotUTC.toISOString();
        capacity.set(iso, (capacity.get(iso) ?? 0) + 1);
        slotUTC = addMinutes(slotUTC, SLOT_DURATION);
      }
    }
  }

  // Ocupacion: toda cita futura consume una unidad, asignada o no
  const booked = await db
    .select({ scheduledAt: appointments.scheduledAt, assignedTo: appointments.assignedTo })
    .from(appointments)
    .where(and(
      gte(appointments.scheduledAt, now),
      // Una cita cancelada o reprogramada libera el lugar
      notInArray(appointments.status, ["cancelled", "rescheduled"]),
    ));

  // Con filtro por rep solo descontamos SUS citas: restar las de todo el equipo
  // le borraba horarios libres de su propia agenda. La sobreventa global la
  // sigue frenando el advisory lock de book/route.ts.
  const repIds = new Set(reps.map((r) => r.id));
  const taken = new Map<string, number>();
  for (const b of booked) {
    if (repSlug && repSlug !== "general" && (!b.assignedTo || !repIds.has(b.assignedTo))) continue;
    const iso = new Date(b.scheduledAt).toISOString();
    taken.set(iso, (taken.get(iso) ?? 0) + 1);
  }

  const holidayList = await db.select({ date: holidays.date }).from(holidays);
  const holidayDates = new Set(holidayList.map((h) => h.date));

  const minStart = addMinutes(now, MIN_LEAD_MINUTES);
  const slots: AvailableSlot[] = [];

  for (const [iso, cap] of capacity) {
    const free = cap - (taken.get(iso) ?? 0);
    if (free <= 0) continue;

    const when = new Date(iso);
    if (when <= minStart) continue;

    // Feriados se evaluan por fecha de Miami, no por fecha UTC
    if (holidayDates.has(formatInTimeZone(when, MIAMI, "yyyy-MM-dd"))) continue;

    // Nada de madrugada para el cliente, sin importar quien lo atienda
    const horaLocal = Number(formatInTimeZone(when, clientTz, "H"));
    if (horaLocal < HORA_MIN_CLIENTE || horaLocal >= HORA_MAX_CLIENTE) continue;

    slots.push({
      utc: iso,
      label: formatInTimeZone(when, clientTz, "h:mm a"),
      date: formatInTimeZone(when, clientTz, "yyyy-MM-dd"),
      capacity: free,
    });
  }

  slots.sort((a, b) => a.utc.localeCompare(b.utc));

  const grouped: Record<string, AvailableSlot[]> = {};
  for (const s of slots) {
    if (!grouped[s.date]) grouped[s.date] = [];
    grouped[s.date].push(s);
  }

  return { slots, grouped, timezone: clientTz };
}

// Capacidad bruta de un instante puntual (cuantos reps trabajan). No descuenta citas.
export async function getSlotCapacity(slot: Date): Promise<number> {
  const holidayList = await db.select({ date: holidays.date }).from(holidays);
  const miamiDate = formatInTimeZone(slot, MIAMI, "yyyy-MM-dd");
  if (holidayList.some((h) => h.date === miamiDate)) return 0;

  const reps = await db
    .select({ id: users.id, tz: users.availabilityTimezone, fallbackTz: users.timezone })
    .from(users)
    .where(eq(users.isActive, true));

  const rules = await db
    .select({
      userId: availabilityRules.userId,
      dayOfWeek: availabilityRules.dayOfWeek,
      startTime: availabilityRules.startTime,
      endTime: availabilityRules.endTime,
    })
    .from(availabilityRules)
    .where(eq(availabilityRules.isActive, true));

  const byRep = new Map<string, Map<number, { startTime: string; endTime: string }>>();
  for (const r of rules) {
    if (!byRep.has(r.userId)) byRep.set(r.userId, new Map());
    byRep.get(r.userId)!.set(r.dayOfWeek, { startTime: r.startTime, endTime: r.endTime });
  }

  let capacity = 0;
  for (const rep of reps) {
    const repRules = byRep.get(rep.id);
    if (!repRules) continue;
    const tz = rep.tz || rep.fallbackTz || MIAMI;
    const dateStr = formatInTimeZone(slot, tz, "yyyy-MM-dd");
    const dow = Number(formatInTimeZone(slot, tz, "i")) % 7;
    const rule = repRules.get(dow);
    if (!rule) continue;

    const startUTC = fromZonedTime(`${dateStr}T${rule.startTime}`, tz);
    const endUTC = fromZonedTime(`${dateStr}T${rule.endTime}`, tz);
    if (slot < startUTC || slot >= endUTC) continue;

    // El slot debe caer en la grilla de este rep
    const offsetMin = (slot.getTime() - startUTC.getTime()) / 60000;
    if (offsetMin % SLOT_DURATION !== 0) continue;

    capacity++;
  }
  return capacity;
}

// IDs de reps cuya franja de disponibilidad cubre este instante.
export async function getAvailableRepIds(slot: Date): Promise<Set<string>> {
  const reps = await db
    .select({ id: users.id, tz: users.availabilityTimezone, fallbackTz: users.timezone })
    .from(users)
    .where(eq(users.isActive, true));

  const rules = await db
    .select({
      userId: availabilityRules.userId,
      dayOfWeek: availabilityRules.dayOfWeek,
      startTime: availabilityRules.startTime,
      endTime: availabilityRules.endTime,
    })
    .from(availabilityRules)
    .where(eq(availabilityRules.isActive, true));

  const byRep = new Map<string, Map<number, { startTime: string; endTime: string }>>();
  for (const r of rules) {
    if (!byRep.has(r.userId)) byRep.set(r.userId, new Map());
    byRep.get(r.userId)!.set(r.dayOfWeek, { startTime: r.startTime, endTime: r.endTime });
  }

  const available = new Set<string>();
  for (const rep of reps) {
    const repRules = byRep.get(rep.id);
    if (!repRules) continue;
    const tz = rep.tz || rep.fallbackTz || MIAMI;
    const dateStr = formatInTimeZone(slot, tz, "yyyy-MM-dd");
    const dow = Number(formatInTimeZone(slot, tz, "i")) % 7;
    const rule = repRules.get(dow);
    if (!rule) continue;

    const startUTC = fromZonedTime(`${dateStr}T${rule.startTime}`, tz);
    const endUTC = fromZonedTime(`${dateStr}T${rule.endTime}`, tz);
    if (slot >= startUTC && slot < endUTC) available.add(rep.id);
  }
  return available;
}
