import { db } from "@/db";
import { adrianaSatisfaction, adrianaConversations } from "@/db/schema";
import { eq, desc, } from "drizzle-orm";

export interface SaveSatisfactionInput {
  score: number;  // 1-5
}

export interface SaveSatisfactionContext {
  conversationId: string;
}

export async function saveSatisfactionScore(
  input: SaveSatisfactionInput,
  ctx: SaveSatisfactionContext
): Promise<{ ok: boolean; satisfaction_id?: string; message: string }> {
  const score = Math.round(input.score);
  if (score < 1 || score > 5) {
    return { ok: false, message: "Score must be between 1 and 5" };
  }

  // Si ya respondió en esta conversación, actualizamos en lugar de duplicar
  const [existing] = await db
    .select()
    .from(adrianaSatisfaction)
    .where(eq(adrianaSatisfaction.conversationId, ctx.conversationId))
    .orderBy(desc(adrianaSatisfaction.createdAt))
    .limit(1);

  let satisfactionId: string;

  if (existing && !existing.comment) {
    // Misma fila, todavía sin comentario: actualizamos score
    const [updated] = await db
      .update(adrianaSatisfaction)
      .set({ score })
      .where(eq(adrianaSatisfaction.id, existing.id))
      .returning();
    satisfactionId = updated.id;
  } else {
    // Insert nuevo
    const [created] = await db
      .insert(adrianaSatisfaction)
      .values({ conversationId: ctx.conversationId, score })
      .returning();
    satisfactionId = created.id;
  }

  // Marcamos en la conversación que la encuesta fue respondida
  await db
    .update(adrianaConversations)
    .set({ surveyDoneAt: new Date(), updatedAt: new Date() })
    .where(eq(adrianaConversations.id, ctx.conversationId));

  return {
    ok: true,
    satisfaction_id: satisfactionId,
    message: `Score ${score}/5 saved`,
  };
}
