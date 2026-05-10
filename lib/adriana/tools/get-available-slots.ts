import { generateAvailableSlots, type AvailableSlot } from "@/lib/slots";
import { formatInTimeZone } from "date-fns-tz";

export interface GetAvailableSlotsInput {
  date_from?: string;       // ISO date "2026-05-12" (opcional, default: ya filtra >2h desde ahora)
  date_to?: string;         // ISO date "2026-05-26"
  timezone: string;         // IANA tz "America/Argentina/Buenos_Aires"
  preferred_time?: "morning" | "afternoon" | "any";
}

export interface SlotForClaude {
  utc: string;              // se manda después a create_booking
  label: string;            // "10:30 AM"
  date: string;             // "2026-05-12" en TZ del cliente
}

export async function getAvailableSlots(
  input: GetAvailableSlotsInput
): Promise<{ ok: boolean; slots: SlotForClaude[]; message?: string }> {
  let result;
  try {
    result = await generateAvailableSlots(input.timezone);
  } catch (err) {
    console.error("[get_available_slots] error:", err);
    return { ok: false, slots: [], message: "Error generating slots" };
  }

  let filtered: AvailableSlot[] = result.slots;

  // Filtrado por rango de fechas si vino
  if (input.date_from) {
    const fromDate = new Date(input.date_from);
    filtered = filtered.filter(s => new Date(s.utc) >= fromDate);
  }
  if (input.date_to) {
    const toDate = new Date(input.date_to);
    toDate.setUTCHours(23, 59, 59, 999); // hasta fin del día
    filtered = filtered.filter(s => new Date(s.utc) <= toDate);
  }

  // Filtrado opcional por mañana/tarde en TZ del cliente
  if (input.preferred_time && input.preferred_time !== "any") {
    filtered = filtered.filter(s => {
      const hourLocal = parseInt(formatInTimeZone(new Date(s.utc), input.timezone, "HH"), 10);
      if (input.preferred_time === "morning")   return hourLocal < 12;
      if (input.preferred_time === "afternoon") return hourLocal >= 12;
      return true;
    });
  }

  // Limitamos a 6 — el modelo elige máximo 3 según prompt
  const limited = filtered.slice(0, 6);

  return {
    ok: true,
    slots: limited,
    message: limited.length === 0 ? "No slots available in that range" : undefined,
  };
}
