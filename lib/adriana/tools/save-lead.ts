import { updateConversation, getConversationByPhone } from "../db-helpers";
import { createOrUpdateZohoLead } from "@/lib/zoho";
import { db } from "@/db";
import { adrianaConversations } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface SaveLeadInput {
  name?: string;
  email?: string;
  company?: string;
  country?: string;
  product_type?: string;
  channel?: string;
  timeline?: string;
  notes?: string;
}

export interface SaveLeadContext {
  conversationId: string;
  waPhone: string;
}

export async function saveLead(
  input: SaveLeadInput,
  ctx: SaveLeadContext
): Promise<{ ok: boolean; zoho_lead_id?: string; message: string }> {
  const patch: Partial<typeof adrianaConversations.$inferInsert> = {};
  if (input.name)         patch.leadName        = input.name;
  if (input.email)        patch.leadEmail       = input.email;
  if (input.company)      patch.leadCompany     = input.company;
  if (input.country)      patch.leadCountry     = input.country;
  if (input.product_type) patch.leadProductType = input.product_type;
  if (input.channel)      patch.leadChannel     = input.channel;
  if (input.timeline)     patch.leadTimeline    = input.timeline;

  if (Object.keys(patch).length === 0) {
    return { ok: false, message: "No fields to save" };
  }

  await updateConversation(ctx.conversationId, patch);

  // Si tenemos los mínimos (nombre + email), creamos/actualizamos el lead en Zoho
  const conv = await getConversationByPhone(ctx.waPhone);
  if (!conv) return { ok: false, message: "Conversation not found" };

  const hasMinimum = conv.leadEmail && conv.leadName;
  if (!hasMinimum) {
    return { ok: true, message: "Lead data saved (Zoho pending: need name + email)" };
  }

  try {
    const notesParts = [
      conv.leadCountry      && `País: ${conv.leadCountry}`,
      conv.leadProductType  && `Producto: ${conv.leadProductType}`,
      conv.leadChannel      && `Canal de venta: ${conv.leadChannel}`,
      conv.leadTimeline     && `Timeline: ${conv.leadTimeline}`,
      input.notes           && `Notas: ${input.notes}`,
    ].filter(Boolean).join("\n");

    const zohoLead = await createOrUpdateZohoLead({
      clientName:      conv.leadName!,
      clientEmail:     conv.leadEmail!,
      clientCompany:   conv.leadCompany || "Sin especificar",
      clientWhatsapp:  ctx.waPhone,
      clientLanguage:  conv.language || undefined,
      serviceInterest: conv.leadProductType || undefined,
      clientNotes:     notesParts || undefined,
    });

    const zohoLeadId = (zohoLead as { id?: string })?.id;
    if (zohoLeadId) {
      await db
        .update(adrianaConversations)
        .set({ zohoLeadId, updatedAt: new Date() })
        .where(eq(adrianaConversations.id, ctx.conversationId));
      return { ok: true, zoho_lead_id: zohoLeadId, message: "Lead saved + Zoho synced" };
    }

    return { ok: true, message: "Lead saved, Zoho returned no id" };
  } catch (err) {
    console.error("[save_lead] Zoho error:", err);
    return { ok: true, message: "Lead saved locally, Zoho sync failed" };
  }
}
