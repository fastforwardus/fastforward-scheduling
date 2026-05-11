import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { adrianaConversations } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getOrCreateConversation,
  appendMessage,
  getMessageHistory,
} from "./db-helpers";
import { ADRIANA_TOOLS, dispatchTool, type AdrianaToolContext } from "./tools";
import { buildSystemPrompt } from "./system-prompt";

const MODEL = "claude-opus-4-5";  // ajustar según preferencia / costo
const MAX_TOKENS = 1024;
const MAX_TOOL_LOOPS = 6; // safety: si Claude entra en bucle, cortamos
const HISTORY_LIMIT = 40; // últimos N mensajes que mandamos a Claude

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ProcessMessageInput {
  waPhone: string;
  waProfileName?: string;
  userMessage: string;
  waMessageId?: string;
}

export interface ProcessMessageOutput {
  ok: boolean;
  assistantText: string;
  conversationId: string;
  toolCalls: { name: string; input: unknown; result: unknown }[];
  tokensIn: number;
  tokensOut: number;
  error?: string;
}

/**
 * Procesa un mensaje del usuario y devuelve la respuesta de Adriana lista para mandar.
 */
export async function processUserMessage(
  input: ProcessMessageInput
): Promise<ProcessMessageOutput> {
  const conv = await getOrCreateConversation(input.waPhone, input.waProfileName);

  const toolCallsLog: { name: string; input: unknown; result: unknown }[] = [];

  // Guardar mensaje del usuario
  await appendMessage({
    conversationId: conv.id,
    role: "user",
    content: [{ type: "text", text: input.userMessage }],
    waMessageId: input.waMessageId ?? null,
  });

  await db
    .update(adrianaConversations)
    .set({ lastUserMsgAt: new Date(), updatedAt: new Date() })
    .where(eq(adrianaConversations.id, conv.id));

  // Cargar historial (ya ordenado ascendente: primero el más viejo)
  const history = await getMessageHistory(conv.id, HISTORY_LIMIT);

  // Convertir el historial al formato que espera Anthropic
  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content as unknown as Anthropic.ContentBlockParam[],
  }));

  const ctx: AdrianaToolContext = {
    conversationId: conv.id,
    waPhone: input.waPhone,
    language: conv.language,
  };

  const systemPrompt = buildSystemPrompt({
    language: conv.language,
    leadName: conv.leadName,
    leadEmail: conv.leadEmail,
    leadCompany: conv.leadCompany,
    leadCountry: conv.leadCountry,
    leadProductType: conv.leadProductType,
    leadChannel: conv.leadChannel,
    leadTimeline: conv.leadTimeline,
    timezone: conv.timezone,
    alreadyBooked: !!conv.bookedAt,
    surveyDone: !!conv.surveyDoneAt,
  });

  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let finalText = "";
  let lastAssistantContent: Anthropic.ContentBlock[] = [];

  // Tool use loop
  for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
    let response: Anthropic.Message;
    try {
      response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        tools: ADRIANA_TOOLS,
        messages,
      });
    } catch (err) {
      console.error("[adriana engine] Anthropic API error:", err);
      return {
        ok: false,
        assistantText: "Disculpa, tuve un problema técnico. ¿Puedes intentar de nuevo en un momento?",
        conversationId: conv.id,
        toolCalls: toolCallsLog,
        tokensIn: totalTokensIn,
        tokensOut: totalTokensOut,
        error: String(err),
      };
    }

    totalTokensIn += response.usage.input_tokens;
    totalTokensOut += response.usage.output_tokens;
    lastAssistantContent = response.content;

    // Empujar el turno completo del assistant (texto + tool_use blocks) al historial in-memory
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn" || response.stop_reason === "stop_sequence") {
      finalText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      break;
    }

    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      const toolResultBlocks: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUseBlocks) {
        let result: unknown;
        try {
          result = await dispatchTool(tu.name, tu.input, ctx);
        } catch (err) {
          console.error(`[adriana engine] tool "${tu.name}" threw:`, err);
          result = { ok: false, message: `Tool ${tu.name} threw an error` };
        }
        toolCallsLog.push({ name: tu.name, input: tu.input, result });
        toolResultBlocks.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(result),
        });
      }

      messages.push({ role: "user", content: toolResultBlocks });
      continue;
    }

    // max_tokens u otro motivo: cortamos y usamos lo que haya
    finalText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    break;
  }

  if (!finalText) {
    finalText = "Déjame un momento, ya te respondo.";
  }

  // Guardar el turno final del assistant en DB
  await appendMessage({
    conversationId: conv.id,
    role: "assistant",
    content: lastAssistantContent,
    tokensIn: totalTokensIn,
    tokensOut: totalTokensOut,
  });

  await db
    .update(adrianaConversations)
    .set({ lastAssistantMsgAt: new Date(), updatedAt: new Date() })
    .where(eq(adrianaConversations.id, conv.id));

  return {
    ok: true,
    assistantText: finalText,
    conversationId: conv.id,
    toolCalls: toolCallsLog,
    tokensIn: totalTokensIn,
    tokensOut: totalTokensOut,
  };
}
