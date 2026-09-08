import { getBaseUrl } from "@/lib/base-url";
import { db } from "@/db";
import { adrianaConversations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export interface CreateBookingInput {
  name: string;
  email: string;
  company?: string;
  product_type?: string;
  country?: string;
  timezone: string;       // IANA, "America/Argentina/Buenos_Aires"
  /**
   * Hora LOCAL del cliente, sin zona: "2026-09-08T10:00:00".
   * Es la forma preferida. Calcular el UTC a mano se presta a error —un cliente
   * quedo agendado tres horas tarde por eso— y el horario de verano lo empeora.
   */
  slot_local?: string;
  /** Compatibilidad: UTC ya calculado. Se usa solo si no vino slot_local. */
  slot_iso_utc?: string;
  notes?: string;
}

export interface CreateBookingContext {
  conversationId: string;
  waPhone: string;
  language?: "es" | "en" | "pt" | null;
}

interface BookEndpointResponse {
  success?: boolean;
  appointmentId?: string;
  meetingLink?: string;
  error?: string;
}

export async function createBooking(
  input: CreateBookingInput,
  ctx: CreateBookingContext
): Promise<{
  ok: boolean;
  confirmation_id?: string;
  meeting_link?: string;
  formatted_time_local?: string;
  message: string;
}> {
  const secret = process.env.ADRIANA_INTERNAL_SECRET;
  if (!secret) {
    console.error("[create_booking] ADRIANA_INTERNAL_SECRET missing");
    return { ok: false, message: "Server misconfigured" };
  }

  // La conversion la hace el codigo, que no se equivoca con el horario de verano
  let scheduledUtc: string;
  if (input.slot_local) {
    const limpio = input.slot_local.replace(/[Zz]$/, "").replace(/[+-]\d{2}:?\d{2}$/, "");
    scheduledUtc = fromZonedTime(limpio, input.timezone).toISOString();
  } else if (input.slot_iso_utc) {
    scheduledUtc = input.slot_iso_utc;
  } else {
    return { ok: false, message: "Falta el horario: mandá slot_local con la hora del cliente." };
  }
  console.log("[create_booking]", input.timezone,
    "| local:", input.slot_local ?? "(no vino)", "-> utc:", scheduledUtc);

  const url = `${getBaseUrl()}/api/book`;

  const payload = {
    clientName:      input.name,
    clientEmail:     input.email,
    clientCompany:   input.company || "Sin especificar",
    clientWhatsapp:  ctx.waPhone,
    clientTimezone:  input.timezone,
    clientLanguage:  ctx.language || "es",
    serviceInterest: input.product_type || undefined,
    platform:        "meet",
    repSlug:         "general",
    scheduledAt:     scheduledUtc,
    clientNotes:     input.notes || `Booking vía WhatsApp Adriana${input.country ? ` — País: ${input.country}` : ""}`,
    bookedVia:       "adriana_whatsapp",
  };

  let data: BookEndpointResponse;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Adriana-Internal-Secret": secret,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      console.error("[create_booking] non-JSON response:", text.slice(0, 200));
      return { ok: false, message: `Booking endpoint returned non-JSON (${res.status})` };
    }

    if (!res.ok) {
      console.error("[create_booking] endpoint error:", res.status, data);
      return { ok: false, message: data.error || `Booking failed (${res.status})` };
    }
  } catch (err) {
    console.error("[create_booking] fetch error:", err);
    return { ok: false, message: "Network error calling booking endpoint" };
  }

  if (!data.appointmentId) {
    return { ok: false, message: "Booking endpoint did not return appointmentId" };
  }

  // Guardamos el appointmentId en la conversación para tracking
  await db
    .update(adrianaConversations)
    .set({
      appointmentId: data.appointmentId,
      bookedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(adrianaConversations.id, ctx.conversationId));

  // Formato amigable en TZ del cliente
  const localTime = formatInTimeZone(
    new Date(scheduledUtc),
    input.timezone,
    "EEEE d 'de' MMMM, HH:mm 'hs'"
  );

  return {
    ok: true,
    confirmation_id: data.appointmentId,
    meeting_link: data.meetingLink || "(link en el email de confirmación)",
    formatted_time_local: localTime,
    message: "Booking created successfully",
  };
}
