import { db } from "@/db";
import { adrianaConversations, adrianaMessages, adrianaSatisfaction } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function getConversationByPhone(waPhone: string) {
  const [conv] = await db
    .select()
    .from(adrianaConversations)
    .where(eq(adrianaConversations.waPhone, waPhone))
    .limit(1);
  return conv ?? null;
}

export async function getOrCreateConversation(waPhone: string, waProfileName?: string) {
  const existing = await getConversationByPhone(waPhone);
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
