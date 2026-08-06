import { db } from "@/db";
import { adrianaConversations, adrianaMessages, adrianaSatisfaction } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";

export async function getConversationByPhone(waPhone: string) {
  const [conv] = await db
    .select()
    .from(adrianaConversations)
    .where(eq(adrianaConversations.waPhone, waPhone))
    .limit(1);
  return conv ?? null;
}

/**
 * Busca conversacion por los ultimos 8 digitos. Necesario porque Meta
 * normaliza distinto que nosotros: mandamos a 5491130378827 (AR con 9)
 * y las respuestas entran como 541130378827. Sin esto se duplican hilos.
 */
export async function findConversationByPhoneLoose(waPhone: string) {
  const tail = waPhone.replace(/\D/g, "").slice(-8);
  if (tail.length < 8) return null;
  const [conv] = await db
    .select()
    .from(adrianaConversations)
    .where(sql`right(regexp_replace(${adrianaConversations.waPhone}, '[^0-9]', '', 'g'), 8) = ${tail}`)
    .orderBy(desc(adrianaConversations.updatedAt))
    .limit(1);
  return conv ?? null;
}

export async function getOrCreateConversation(waPhone: string, waProfileName?: string) {
  const existing = await getConversationByPhone(waPhone) ?? await findConversationByPhoneLoose(waPhone);
  if (existing) return existing;

  const [created] = await db
    .insert(adrianaConversations)
    .values({ waPhone, waProfileName: waProfileName ?? null })
    .returning();
  return created;
}

export async function updateConversation(
  id: string,
  patch: Partial<typeof adrianaConversations.$inferInsert>
) {
  const [updated] = await db
    .update(adrianaConversations)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(adrianaConversations.id, id))
    .returning();
  return updated;
}

export async function getMessageHistory(conversationId: string, limit = 50) {
  const rows = await db
    .select()
    .from(adrianaMessages)
    .where(eq(adrianaMessages.conversationId, conversationId))
    .orderBy(desc(adrianaMessages.createdAt))
    .limit(limit);
  return rows.reverse();
}

export async function appendMessage(params: {
  conversationId: string;
  role: "user" | "assistant";
  content: unknown;
  waMessageId?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
}) {
  const [msg] = await db
    .insert(adrianaMessages)
    .values({
      conversationId: params.conversationId,
      role: params.role,
      content: params.content as object,
      waMessageId: params.waMessageId ?? null,
      tokensIn: params.tokensIn ?? null,
      tokensOut: params.tokensOut ?? null,
    })
    .returning();
  return msg;
}

export async function getLatestSatisfaction(conversationId: string) {
  const [row] = await db
    .select()
    .from(adrianaSatisfaction)
    .where(eq(adrianaSatisfaction.conversationId, conversationId))
    .orderBy(desc(adrianaSatisfaction.createdAt))
    .limit(1);
  return row ?? null;
}
