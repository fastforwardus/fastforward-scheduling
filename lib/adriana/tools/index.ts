import type Anthropic from "@anthropic-ai/sdk";
import { saveLead, type SaveLeadInput, type SaveLeadContext } from "./save-lead";
import { getAvailableSlots, type GetAvailableSlotsInput } from "./get-available-slots";
import { createBooking, type CreateBookingInput, type CreateBookingContext } from "./create-booking";
import { saveSatisfactionScore, type SaveSatisfactionInput, type SaveSatisfactionContext } from "./save-satisfaction-score";
import { saveFeedbackComment, type SaveFeedbackInput, type SaveFeedbackContext } from "./save-feedback-comment";
import { notifyTeam, type NotifyTeamInput, type NotifyTeamContext } from "./notify-team";

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
        slot_iso_utc: { type: "string", description: "El campo 'utc' del slot que devolvió get_available_slots" },
        notes:        { type: "string", description: "Notas adicionales para los notes del booking (opcional)" },
      },
      required: ["name", "email", "timezone", "slot_iso_utc"],
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
          enum: ["second_booking", "payment", "complex_question", "other"],
          description: "Motivo del handoff: second_booking (quiere otra cita), payment (pago/factura), complex_question (técnica/regulatoria), other.",
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

    default:
      return { ok: false, message: `Unknown tool: ${name}` };
  }
}
