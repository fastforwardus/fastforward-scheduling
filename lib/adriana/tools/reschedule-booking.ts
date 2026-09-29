import { db } from "@/db";
import { adrianaConversations, appointments, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { generateAvailableSlots } from "@/lib/slots";
import { rescheduleAppointment } from "@/lib/reschedule";

export interface RescheduleSlotsInput {
  timezone: string;
  date_from?: string;
  date_to?: string;
  preferred_time?: "morning" | "afternoon" | "any";
}

export interface RescheduleBookingInput {
  timezone: string;
  /** Hora LOCAL del cliente sin zona: "2026-09-29T16:00:00" */
  slot_local: string;
}

export interface RescheduleContext {
  conversationId: string;
}

async function cargarCita(conversationId: string) {
  const [conv] = await db
    .select({ appointmentId: adrianaConversations.appointmentId })
    .from(adrianaConversations)
    .where(eq(adrianaConversations.id, conversationId))
    .limit(1);
  if (!conv?.appointmentId) {
    return { ok: false as const, message: "Este cliente no tiene una cita agendada en esta conversación. Si quiere una llamada, agéndala con get_available_slots y create_booking." };
  }
  const [appt] = await db.select().from(appointments).where(eq(appointments.id, conv.appointmentId)).limit(1);
  if (!appt) return { ok: false as const, message: "La cita asociada ya no existe. Agenda una nueva con get_available_slots y create_booking." };

  let repSlug: string | null = null;
  let repName: string | null = null;
  if (appt.assignedTo) {
    const [rep] = await db.select({ slug: users.slug, fullName: users.fullName }).from(users).where(eq(users.id, appt.assignedTo)).limit(1);
    repSlug = rep?.slug ?? null;
    repName = rep?.fullName ?? null;
  }
  return { ok: true as const, appt, repSlug, repName };
}

/** Slots libres SOLO del rep que ya tiene asignada la cita (el rep no cambia al reagendar). */
export async function getRescheduleSlots(input: RescheduleSlotsInput, ctx: RescheduleContext) {
  const info = await cargarCita(ctx.conversationId);
  if (!info.ok) return { ok: false, slots: [], message: info.message };

  let result;
  try {
    result = await generateAvailableSlots(input.timezone, info.repSlug ?? "general");
  } catch (err) {
    console.error("[get_reschedule_slots] error:", err);
    return { ok: false, slots: [], message: "Error generating slots" };
  }

  let filtered = result.slots;
  if (input.date_from) {
    const fromDate = new Date(input.date_from);
    filtered = filtered.filter(s => new Date(s.utc) >= fromDate);
  }
  if (input.date_to) {
    const toDate = new Date(input.date_to);
    toDate.setUTCHours(23, 59, 59, 999);
    filtered = filtered.filter(s => new Date(s.utc) <= toDate);
  }
  if (input.preferred_time && input.preferred_time !== "any") {
    filtered = filtered.filter(s => {
      const h = parseInt(formatInTimeZone(new Date(s.utc), input.timezone, "HH"), 10);
      return input.preferred_time === "morning" ? h < 12 : h >= 12;
    });
  }
  const limited = filtered.slice(0, 6);

  return {
    ok: true,
    rep_name: info.repName,
    current_time_local: formatInTimeZone(info.appt.scheduledAt, input.timezone, "EEEE d 'de' MMMM, HH:mm 'hs'"),
    slots: limited,
    message: limited.length === 0
      ? `No hay horarios libres para ${info.repName ?? "el consultor asignado"} en ese rango. Prueba otro día: la cita debe seguir con el mismo consultor.`
      : undefined,
  };
}

/** Mueve la cita existente al nuevo horario, manteniendo el mismo rep. */
export async function rescheduleBooking(input: RescheduleBookingInput, ctx: RescheduleContext) {
  const info = await cargarCita(ctx.conversationId);
  if (!info.ok) return { ok: false, message: info.message };

  if (!input.slot_local) return { ok: false, message: "Falta slot_local con la hora local del cliente." };
  const limpio = input.slot_local.replace(/[Zz]$/, "").replace(/[+-]\d{2}:?\d{2}$/, "");
  const nuevoUtc = fromZonedTime(limpio, input.timezone);
  if (isNaN(nuevoUtc.getTime())) return { ok: false, message: "slot_local inválido. Formato: 2026-09-29T16:00:00" };

  // Validación: el slot tiene que estar libre para ESE rep, misma lógica que la grilla pública
  let result;
  try {
    result = await generateAvailableSlots(input.timezone, info.repSlug ?? "general");
  } catch (err) {
    console.error("[reschedule_booking] slots error:", err);
    return { ok: false, message: "Error validando disponibilidad" };
  }
  const libre = result.slots.some(s => new Date(s.utc).getTime() === nuevoUtc.getTime());
  if (!libre) {
    return { ok: false, message: `Ese horario no está disponible para ${info.repName ?? "el consultor asignado"}. Llama a get_reschedule_slots y ofrece al cliente otro de los horarios libres.` };
  }

  const r = await rescheduleAppointment(info.appt.id, nuevoUtc);
  if (!r.ok) return { ok: false, message: r.error };

  await db.update(adrianaConversations)
    .set({ updatedAt: new Date() })
    .where(eq(adrianaConversations.id, ctx.conversationId));

  console.log("[reschedule_booking]", info.appt.id, "->", nuevoUtc.toISOString(), "rep:", info.repName);

  return {
    ok: true,
    rep_name: info.repName,
    formatted_time_local: formatInTimeZone(nuevoUtc, input.timezone, "EEEE d 'de' MMMM, HH:mm 'hs'"),
    meeting_link: r.meetingLink || "(link en el email de confirmación)",
    message: "Cita reagendada con el mismo consultor. Se envió email al cliente con la nueva fecha.",
  };
}
