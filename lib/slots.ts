import { db } from "@/db";
import { holidays, appointments, users, availabilityRules } from "@/db/schema";
import { gte, lte, eq, and, ne, isNotNull, isNull, notInArray } from "drizzle-orm";
import { addMinutes, isBefore, addDays } from "date-fns";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

export const MIAMI = "America/New_York";
export const SLOT_DURATION = 30;   // duracion de cada cita en minutos
export const OVERFLOW_STEP = 15;   // grilla de desborde cuando la base esta llena
export const DAYS_AHEAD = 21;
export const MIN_LEAD_MINUTES = 120;
// Franja razonable en hora LOCAL DEL CLIENTE, no de Miami. Con Emiliano
// atendiendo desde Bari el pool arranca 2 AM Miami: eso es 8 AM en Madrid
// (bien) pero 2 AM en Nueva York (absurdo). Filtramos por donde esta el cliente.
export const HORA_MIN_CLIENTE = 9;
export const HORA_MAX_CLIENTE = 21;

const MS = 60000;

// UNICOS reps que atienden el pool general. Nadie mas suma capacidad ni
// recibe citas del reparto, aunque tenga horarios cargados (ej. admin).
export const REPS_ATENCION = [
  "tomás marino", "tomas marino",
  "francisco logarzo",
  "emiliano caracciolo",
  "mauricio lobatón", "mauricio lobaton",
];
const esRepAtencion = (nombre: string | null) =>
  REPS_ATENCION.includes((nombre || "").toLowerCase().trim());

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

async function cargarRepsYReglas() {
  const reps = await db
    .select({ id: users.id, slug: users.slug, fullName: users.fullName, tz: users.availabilityTimezone, fallbackTz: users.timezone })
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

  const rulesByRep = new Map<string, Map<number, { startTime: string; endTime: string }>>();
  for (const r of rules) {
    if (!rulesByRep.has(r.userId)) rulesByRep.set(r.userId, new Map());
    rulesByRep.get(r.userId)!.set(r.dayOfWeek, { startTime: r.startTime, endTime: r.endTime });
  }
  return { reps, rulesByRep };
}

// Reps cuya franja permite una cita COMPLETA que arranca en este instante.
export async function getWorkingRepIds(slot: Date): Promise<Set<string>> {
  const { reps: todos, rulesByRep } = await cargarRepsYReglas();
  const reps = todos.filter((r) => esRepAtencion(r.fullName));
  const out = new Set<string>();
  for (const rep of reps) {
    const repRules = rulesByRep.get(rep.id);
    if (!repRules) continue;
    const tz = rep.tz || rep.fallbackTz || MIAMI;
    const dateStr = formatInTimeZone(slot, tz, "yyyy-MM-dd");
    const dow = Number(formatInTimeZone(slot, tz, "i")) % 7;
    const rule = repRules.get(dow);
    if (!rule) continue;
    const startUTC = fromZonedTime(`${dateStr}T${rule.startTime}`, tz);
    const endUTC = fromZonedTime(`${dateStr}T${rule.endTime}`, tz);
    if (slot < startUTC) continue;
    if (addMinutes(slot, SLOT_DURATION) > endUTC) continue;
    out.add(rep.id);
  }
  return out;
}

// Reps con una cita que se SOLAPA con [slot, slot+30). Una cita a las 15:00
// ocupa al rep hasta las 15:30: tambien bloquea el desborde de las 15:15.
export async function getBusyRepIds(slot: Date): Promise<Set<string>> {
  const desde = new Date(slot.getTime() - (SLOT_DURATION - 1) * MS);
  const hasta = new Date(slot.getTime() + (SLOT_DURATION - 1) * MS);
  const rows = await db
    .select({ assignedTo: appointments.assignedTo })
    .from(appointments)
    .where(and(
      isNotNull(appointments.assignedTo),
      gte(appointments.scheduledAt, desde),
      lte(appointments.scheduledAt, hasta),
      notInArray(appointments.status, ["cancelled", "rescheduled"]),
    ));
  const out = new Set<string>();
  for (const r of rows) if (r.assignedTo) out.add(r.assignedTo);
  return out;
}

// Citas sin rep asignado que se solapan con este instante. Tambien ocupan
// lugar: alguien va a tener que atenderlas.
export async function contarSinAsignar(slot: Date): Promise<number> {
  const desde = new Date(slot.getTime() - (SLOT_DURATION - 1) * MS);
  const hasta = new Date(slot.getTime() + (SLOT_DURATION - 1) * MS);
  const rows = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(
      isNull(appointments.assignedTo),
      gte(appointments.scheduledAt, desde),
      lte(appointments.scheduledAt, hasta),
      notInArray(appointments.status, ["cancelled", "rescheduled"]),
    ));
  return rows.length;
}

// REGLA CENTRAL: un rep = una cita por horario. Todo lo que asigna
// (owner de Zoho o round robin) debe salir de este set.
export async function getAvailableRepIds(slot: Date): Promise<Set<string>> {
  const [working, busy] = await Promise.all([getWorkingRepIds(slot), getBusyRepIds(slot)]);
  const out = new Set<string>();
  for (const id of working) if (!busy.has(id)) out.add(id);
  return out;
}

export async function generateAvailableSlots(
  clientTz: string = MIAMI,
  repSlug?: string,
): Promise<SlotsResult> {
  const now = new Date();
  const { reps: allReps, rulesByRep } = await cargarRepsYReglas();

  // Link personal: solo la agenda de ese rep.
  const reps = repSlug && repSlug !== "general"
    ? allReps.filter((r) => r.slug === repSlug)
    : allReps.filter((r) => esRepAtencion(r.fullName));

  // Instantes en grilla de 15: base (:00/:30 de cada rep) + desborde (:15/:45)
  const working = new Map<string, Set<string>>();
  const esBase = new Map<string, boolean>();

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
      let paso = 0;

      // La cita completa (30 min) debe caber dentro de la franja
      while (!isBefore(endUTC, addMinutes(slotUTC, SLOT_DURATION))) {
        const iso = slotUTC.toISOString();
        if (!working.has(iso)) working.set(iso, new Set());
        working.get(iso)!.add(rep.id);
        if (paso % 2 === 0) esBase.set(iso, true);
        else if (!esBase.has(iso)) esBase.set(iso, false);
        slotUTC = addMinutes(slotUTC, OVERFLOW_STEP);
        paso++;
      }
    }
  }

  // Ocupacion por solapamiento: una cita en S bloquea S-15, S y S+15
  const booked = await db
    .select({ scheduledAt: appointments.scheduledAt, assignedTo: appointments.assignedTo })
    .from(appointments)
    .where(and(
      gte(appointments.scheduledAt, addMinutes(now, -SLOT_DURATION)),
      notInArray(appointments.status, ["cancelled", "rescheduled"]),
    ));

  const repIds = new Set(reps.map((r) => r.id));
  const busy = new Map<string, Set<string>>();
  const sinAsignar = new Map<string, number>();
  for (const b of booked) {
    // Con filtro por rep solo descontamos SUS citas
    if (repSlug && repSlug !== "general" && (!b.assignedTo || !repIds.has(b.assignedTo))) continue;
    const t0 = new Date(b.scheduledAt).getTime();
    for (const t of [t0 - OVERFLOW_STEP * MS, t0, t0 + OVERFLOW_STEP * MS]) {
      const iso = new Date(t).toISOString();
      if (!working.has(iso)) continue;
      if (b.assignedTo) {
        if (!busy.has(iso)) busy.set(iso, new Set());
        busy.get(iso)!.add(b.assignedTo);
      } else {
        sinAsignar.set(iso, (sinAsignar.get(iso) ?? 0) + 1);
      }
    }
  }

  const libresEn = (iso: string): number => {
    const w = working.get(iso);
    if (!w) return 0;
    const b = busy.get(iso);
    let libres = 0;
    for (const id of w) if (!b || !b.has(id)) libres++;
    return libres - (sinAsignar.get(iso) ?? 0);
  };

  const holidayList = await db.select({ date: holidays.date }).from(holidays);
  const holidayDates = new Set(holidayList.map((h) => h.date));

  const minStart = addMinutes(now, MIN_LEAD_MINUTES);
  const slots: AvailableSlot[] = [];

  for (const iso of working.keys()) {
    const free = libresEn(iso);
    if (free <= 0) continue;

    const when = new Date(iso);
    if (when <= minStart) continue;

    // Feriados se evaluan por fecha de Miami, no por fecha UTC
    if (holidayDates.has(formatInTimeZone(when, MIAMI, "yyyy-MM-dd"))) continue;

    // Nada de madrugada para el cliente, sin importar quien lo atienda
    const horaLocal = Number(formatInTimeZone(when, clientTz, "H"));
    if (horaLocal < HORA_MIN_CLIENTE || horaLocal >= HORA_MAX_CLIENTE) continue;

    // El desborde :15/:45 solo se ofrece cuando los base vecinos estan llenos
    if (!esBase.get(iso)) {
      const prev = new Date(when.getTime() - OVERFLOW_STEP * MS).toISOString();
      const next = new Date(when.getTime() + OVERFLOW_STEP * MS).toISOString();
      const prevLibre = working.has(prev) ? libresEn(prev) : 0;
      const nextLibre = working.has(next) ? libresEn(next) : 0;
      if (prevLibre > 0 || nextLibre > 0) continue;
    }

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

/**
 * Reparto automatico: Tomas, Francisco, Emiliano y Mauricio en round robin
 * puro por carga de citas futuras. Solo entra quien trabaja ese horario y
 * no tiene cita solapada (un rep = una cita por horario).
 */
export async function elegirRepAutomatico(slot: Date): Promise<string | null> {
  const REPS_ROTACION = [
    "tomás marino", "tomas marino",
    "francisco logarzo",
    "emiliano caracciolo",
    "mauricio lobatón", "mauricio lobaton",
  ];

  const disponibles = await getAvailableRepIds(slot);
  if (!disponibles.size) return null;

  const activos = await db
    .select({ id: users.id, fullName: users.fullName })
    .from(users)
    .where(eq(users.isActive, true));

  const carga = new Map<string, number>();
  const futuras = await db
    .select({ assignedTo: appointments.assignedTo })
    .from(appointments)
    .where(and(
      isNotNull(appointments.assignedTo),
      gte(appointments.scheduledAt, new Date()),
      ne(appointments.status, "cancelled"),
    ));
  for (const a of futuras) {
    if (a.assignedTo) carga.set(a.assignedTo, (carga.get(a.assignedTo) ?? 0) + 1);
  }

  const candidatos = activos.filter((u) =>
    disponibles.has(u.id) && REPS_ROTACION.includes((u.fullName || "").toLowerCase().trim()),
  );
  if (!candidatos.length) return null;
  candidatos.sort((a, b) => (carga.get(a.id) ?? 0) - (carga.get(b.id) ?? 0));
  return candidatos[0].id;
}
