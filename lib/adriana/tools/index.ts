import type Anthropic from "@anthropic-ai/sdk";
import { saveLead, type SaveLeadInput, type SaveLeadContext } from "./save-lead";
import { getAvailableSlots, type GetAvailableSlotsInput } from "./get-available-slots";
import { createBooking, type CreateBookingInput, type CreateBookingContext } from "./create-booking";
import { saveSatisfactionScore, type SaveSatisfactionInput, type SaveSatisfactionContext } from "./save-satisfaction-score";
import { saveFeedbackComment, type SaveFeedbackInput, type SaveFeedbackContext } from "./save-feedback-comment";
import { notifyTeam, type NotifyTeamInput, type NotifyTeamContext } from "./notify-team";
import { getRescheduleSlots, rescheduleBooking, type RescheduleSlotsInput, type RescheduleBookingInput, type RescheduleContext } from "./reschedule-booking";

/** Schemas que se le mandan a Claude. */
export const ADRIANA_TOOLS: Anthropic.Tool[] = [
  {
    name: "save_lead",
    description:
      "Guarda o actualiza datos del lead capturados en la conversación. Llamala apenas tengas al menos 3 datos nuevos (nombre, email, empresa, país, tipo de producto, canal, timeline, notas). Todos los campos son opcionales — solo pasá los que tengas.",
    input_schema: {
      type: "object",
      properties: {
        name:         { type: "string", description: "Nombre completo del lead" },
        email:        { type: "string", description: "Email del lead" },
        company:      { type: "string", description: "Nombre de la empresa o marca" },
        country:      { type: "string", description: "País de origen del producto" },
        product_type: { type: "string", description: "alimento | suplemento | cosmético | alcohol | OTC | dispositivo médico | otro" },
        channel:      { type: "string", description: "retail | e-commerce | food service | distribuidor | marca propia" },
        timeline:     { type: "string", description: "urgente | 1-3 meses | 3-6 meses | exploratorio" },
        notes:        { type: "string", description: "Notas libres adicionales sobre el lead" },
      },
      required: [],
    },
  },
  {
    name: "get_available_slots",
    description:
      "Devuelve slots disponibles para agendar la llamada de descubrimiento de 20 minutos, formateados en la zona horaria del cliente. Usá esto antes de proponerle horarios. Ofrecé máximo 3 slots al cliente.",
    input_schema: {
      type: "object",
      properties: {
        timezone:       { type: "string", description: "Zona horaria IANA del cliente, ej. 'America/Argentina/Buenos_Aires', 'America/Mexico_City', 'Europe/Madrid'" },
        date_from:      { type: "string", description: "Fecha desde (ISO date YYYY-MM-DD). Opcional." },
        date_to:        { type: "string", description: "Fecha hasta (ISO date YYYY-MM-DD). Opcional." },
        preferred_time: { type: "string", enum: ["morning", "afternoon", "any"], description: "Filtrar por mañana o tarde si el cliente lo pidió" },
      },
      required: ["timezone"],
    },
  },
  {
    name: "create_booking",
    description:
      "Crea la reserva de la llamada de descubrimiento. Solo llamala cuando ya confirmaste con el cliente: nombre completo, email, slot exacto, y zona horaria. Devuelve confirmation_id, formatted_time_local, y un mensaje sobre el meeting link.",
    input_schema: {
      type: "object",
      properties: {
        name:         { type: "string", description: "Nombre completo del cliente" },
        email:        { type: "string", description: "Email del cliente, validado" },
        company:      { type: "string", description: "Empresa/marca (opcional)" },
        product_type: { type: "string", description: "Tipo de producto (opcional)" },
        country:      { type: "string", description: "País (opcional)" },
        timezone:     { type: "string", description: "IANA tz del cliente" },
        slot_local: { type: "string", description: "Hora LOCAL del cliente, sin zona ni Z: '2026-09-08T10:00:00'. Es la hora que el cliente eligió, tal como se la mostraste. NO conviertas a UTC: el sistema lo hace." },
        notes:        { type: "string", description: "Notas adicionales para los notes del booking (opcional)" },
      },
      required: ["name", "email", "timezone", "slot_local"],
    },
  },
  {
    name: "get_reschedule_slots",
    description:
      "Devuelve los horarios libres para REAGENDAR la cita que el cliente YA tiene, filtrados al mismo consultor asignado (el consultor nunca cambia al reagendar). Úsala cuando el cliente pide cambiar la fecha u hora de su cita. Devuelve rep_name, current_time_local y slots. Ofrece máximo 3 slots. Si el cliente pide un horario puntual, pásalo como date_from/date_to para verificarlo.",
    input_schema: {
      type: "object",
      properties: {
        timezone:       { type: "string", description: "Zona horaria IANA del cliente" },
        date_from:      { type: "string", description: "Fecha desde (YYYY-MM-DD). Opcional." },
        date_to:        { type: "string", description: "Fecha hasta (YYYY-MM-DD). Opcional." },
        preferred_time: { type: "string", enum: ["morning", "afternoon", "any"], description: "Mañana o tarde si el cliente lo pidió" },
      },
      required: ["timezone"],
    },
  },
  {
    name: "reschedule_booking",
    description:
      "Mueve la cita existente del cliente al nuevo horario, manteniendo el mismo consultor. Solo llámala con un slot que get_reschedule_slots haya devuelto como libre y que el cliente haya confirmado. Si el horario pedido por el cliente no está en los slots libres, NO la llames: ofrécele los horarios disponibles. Devuelve formatted_time_local y rep_name.",
    input_schema: {
      type: "object",
      properties: {
        timezone:   { type: "string", description: "IANA tz del cliente" },
        slot_local: { type: "string", description: "Hora LOCAL del cliente, sin zona ni Z: '2026-09-29T16:00:00'. NO conviertas a UTC." },
      },
      required: ["timezone", "slot_local"],
    },
  },
  {
    name: "save_satisfaction_score",
    description:
      "Guarda el puntaje de satisfacción 1-5 que dio el cliente al final de la conversación, después del booking. Solo llamala con un número entero entre 1 y 5.",
    input_schema: {
      type: "object",
      properties: {
        score: { type: "integer", minimum: 1, maximum: 5, description: "Puntaje 1 (peor) a 5 (mejor)" },
      },
      required: ["score"],
    },
  },
  {
    name: "save_feedback_comment",
    description:
      "Guarda el comentario textual de feedback. Llamala después de save_satisfaction_score si el score fue 3, 4 o 1, 2 y el cliente respondió qué se podría mejorar / qué pasó.",
    input_schema: {
      type: "object",
      properties: {
        comment: { type: "string", description: "Texto literal del feedback del cliente" },
      },
      required: ["comment"],
    },
  },
  {
    name: "notify_team",
    description:
      "Notifica al equipo humano de FastForward cuando NO podés resolver algo por tu cuenta. Llamala SIEMPRE antes de prometer al cliente que el equipo lo va a contactar. Casos típicos: el cliente quiere agendar una SEGUNDA cita (ya tiene una primera), pregunta por pagos/facturación, tiene una pregunta muy técnica/regulatoria específica, pide hablar con un humano, o está molesto. NO uses esta tool para preguntas básicas que vos podés responder. Después de llamarla, decile al cliente que el equipo recibió la notificación y va a contactarlo.",
    input_schema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          enum: ["payment", "complex_question", "other"],
          description: "Motivo del handoff: payment (pago/factura), complex_question (tecnica/regulatoria), other. Si el cliente quiere OTRA cita NO uses esta tool: agendala vos con get_available_slots y create_booking. Si quiere CAMBIAR la fecha de su cita existente tampoco: usa get_reschedule_slots y reschedule_booking.",
        },
        urgency: {
          type: "string",
          enum: ["low", "normal", "high"],
          description: "low: puede esperar, normal: default, high: cliente molesto o lead muy caliente.",
        },
        summary: {
          type: "string",
          description: "Resumen 1-3 líneas para que el humano sepa qué pasó y qué quiere el cliente. Incluí datos concretos: nombre, empresa, qué pidió, por qué Adriana no puede resolverlo.",
        },
      },
      required: ["reason", "urgency", "summary"],
    },
  },
];

/** Contexto que el engine inyecta al dispatcher: tools que necesitan saber de qué conversación se trata. */
export interface AdrianaToolContext {
  conversationId: string;
  waPhone: string;
  language?: "es" | "en" | "pt" | null;
}

/**
 * Dispatcher: recibe el name y los inputs que pidió Claude y ejecuta la tool correspondiente.
 * Devuelve el resultado serializable que se le manda de vuelta a Claude como tool_result.
 */
export async function dispatchTool(
  name: string,
  input: unknown,
  ctx: AdrianaToolContext
): Promise<unknown> {
  switch (name) {
    case "save_lead":
      return saveLead(input as SaveLeadInput, { conversationId: ctx.conversationId, waPhone: ctx.waPhone } as SaveLeadContext);

    case "get_available_slots":
      return getAvailableSlots(input as GetAvailableSlotsInput);

    case "create_booking":
      return createBooking(input as CreateBookingInput, { conversationId: ctx.conversationId, waPhone: ctx.waPhone, language: ctx.language } as CreateBookingContext);

    case "save_satisfaction_score":
      return saveSatisfactionScore(input as SaveSatisfactionInput, { conversationId: ctx.conversationId } as SaveSatisfactionContext);

    case "save_feedback_comment":
      return saveFeedbackComment(input as SaveFeedbackInput, { conversationId: ctx.conversationId } as SaveFeedbackContext);

    case "notify_team":
      return notifyTeam(input as NotifyTeamInput, { conversationId: ctx.conversationId } as NotifyTeamContext);

    case "get_reschedule_slots":
      return getRescheduleSlots(input as RescheduleSlotsInput, { conversationId: ctx.conversationId } as RescheduleContext);

    case "reschedule_booking":
      return rescheduleBooking(input as RescheduleBookingInput, { conversationId: ctx.conversationId } as RescheduleContext);

    default:
      return { ok: false, message: `Unknown tool: ${name}` };
  }
}
