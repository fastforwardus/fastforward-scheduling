import { db } from "@/db";
import { adrianaHandoffs, adrianaConversations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendWhatsAppText } from "@/lib/adriana/whatsapp-sender";
import { Resend } from "resend";

export interface NotifyTeamInput {
  reason: "second_booking" | "payment" | "complex_question" | "other";
  urgency: "low" | "normal" | "high";
  summary: string;
}

export interface NotifyTeamContext {
  conversationId: string;
}

const ADMIN_WHATSAPP = "17864956610";       // Carlos
const ADMIN_EMAIL    = "info@fastfwdus.com";

export async function notifyTeam(
  input: NotifyTeamInput,
  ctx: NotifyTeamContext
): Promise<{ ok: boolean; message: string }> {
  if (!input.summary?.trim()) {
    return { ok: false, message: "Summary is empty" };
  }
  if (!input.reason || !input.urgency) {
    return { ok: false, message: "Missing reason or urgency" };
  }

  // Traer datos de la conversación para enriquecer el mensaje
  const [conv] = await db
    .select()
    .from(adrianaConversations)
    .where(eq(adrianaConversations.id, ctx.conversationId))
    .limit(1);

  if (!conv) {
    return { ok: false, message: "Conversation not found" };
  }

  // Insertar handoff en DB
  const [handoff] = await db
    .insert(adrianaHandoffs)
    .values({
      conversationId: ctx.conversationId,
      reason:  input.reason,
      urgency: input.urgency,
      summary: input.summary,
    })
    .returning();

  const leadName  = conv.leadName || conv.waProfileName || `+${conv.waPhone}`;
  const leadEmail = conv.leadEmail || "(sin email)";
  const company   = conv.leadCompany || "(sin empresa)";
  const urgencyEmoji = input.urgency === "high" ? "🚨" : input.urgency === "low" ? "📋" : "🔔";
  const adminUrl  = `https://scheduling.fastfwdus.com/dashboard/admin/adriana`;

  const notifMessage = [
    `${urgencyEmoji} *Adriana necesita ayuda*`,
    ``,
    `*Cliente:* ${leadName}`,
    `*Empresa:* ${company}`,
    `*Email:* ${leadEmail}`,
    `*WhatsApp:* +${conv.waPhone}`,
    `*Motivo:* ${input.reason}`,
    `*Urgencia:* ${input.urgency}`,
    ``,
    `*Resumen:*`,
    input.summary,
    ``,
    `Ver chat: ${adminUrl}`,
  ].join("\n");

  // Notificar al admin por WhatsApp (best-effort, no rompe si falla)
  let waOk = false;
  try {
    await sendWhatsAppText(ADMIN_WHATSAPP, notifMessage);
    waOk = true;
  } catch (err) {
    console.error("[notify-team] Error enviando WhatsApp:", err);
  }

  // Notificar al admin por email (best-effort)
  let emailOk = false;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY!);
    await resend.emails.send({
      from: "Adriana <adriana@fastfwdus.com>",
      to: [ADMIN_EMAIL],
      subject: `${urgencyEmoji} Adriana necesita ayuda — ${leadName}`,
      text: notifMessage,
    });
    emailOk = true;
  } catch (err) {
    console.error("[notify-team] Error enviando email:", err);
  }

  // Marcar notified_at si al menos un canal salió OK
  if (waOk || emailOk) {
    await db
      .update(adrianaHandoffs)
      .set({ notifiedAt: new Date() })
      .where(eq(adrianaHandoffs.id, handoff.id));
  }

  return {
    ok: true,
    message: `Equipo notificado. Te van a contactar pronto por WhatsApp o email.`,
  };
}
