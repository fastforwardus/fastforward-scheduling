import { db } from "@/db";
import { adrianaSatisfaction } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export interface SaveFeedbackInput {
  comment: string;
}

export interface SaveFeedbackContext {
  conversationId: string;
}

export async function saveFeedbackComment(
  input: SaveFeedbackInput,
  ctx: SaveFeedbackContext
): Promise<{ ok: boolean; message: string }> {
  if (!input.comment?.trim()) {
    return { ok: false, message: "Comment is empty" };
  }

  // Buscar la última satisfaction row de esta conversación
  const [latest] = await db
    .select()
    .from(adrianaSatisfaction)
    .where(eq(adrianaSatisfaction.conversationId, ctx.conversationId))
    .orderBy(desc(adrianaSatisfaction.createdAt))
    .limit(1);

  if (!latest) {
    // No hay score previo: insertamos solo el comentario con score null no es posible (NOT NULL).
    // En la práctica esto no debería pasar porque el flujo del prompt siempre pide score primero.
    // Defensivamente, lo guardamos como score 0 sentinel — pero mejor devolver error claro.
    return { ok: false, message: "No previous score found — score must be saved first" };
  }

  await db
    .update(adrianaSatisfaction)
    .set({ comment: input.comment.trim() })
    .where(eq(adrianaSatisfaction.id, latest.id));

  return { ok: true, message: "Feedback comment saved" };
}
