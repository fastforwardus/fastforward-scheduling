export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { db } from "@/db";
import { adrianaMessages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { processUserMessage } from "@/lib/adriana/engine";
import { sendWhatsAppText, markAsRead } from "@/lib/adriana/whatsapp-sender";

/**
 * GET — Verificación inicial de Meta cuando configurás el webhook.
 * Meta manda: ?hub.mode=subscribe&hub.verify_token=XXX&hub.challenge=YYY
 * Si verify_token coincide con el nuestro, respondemos el challenge en texto plano.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expected = process.env.META_WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

/**
 * POST — Mensaje entrante de WhatsApp.
 * 1. Validar firma HMAC SHA256 con APP_SECRET.
 * 2. Extraer mensaje (texto, número, profile name, message id).
 * 3. Deduplicación por waMessageId.
 * 4. Llamar al engine.
 * 5. Mandar respuesta vía Meta.
 *
 * IMPORTANTE: Meta espera 200 OK rápido. Si tardamos > ~20s puede reintentar.
 * Por eso respondemos 200 al final del flujo principal, pero también si algún paso
 * intermedio falla — para no entrar en reintentos infinitos.
 */
export async function POST(req: NextRequest) {
  // Leer raw body para validar firma
  const rawBody = await req.text();

  // ── 1. Validar firma HMAC ──
  const signature = req.headers.get("x-hub-signature-256");
  const appSecret = process.env.META_WHATSAPP_APP_SECRET;

  if (!appSecret) {
    console.error("[wa-webhook] Missing META_WHATSAPP_APP_SECRET");
    return new NextResponse("Server misconfigured", { status: 500 });
  }

  if (!signature) {
    console.warn("[wa-webhook] No signature header");
    return new NextResponse("Missing signature", { status: 401 });
  }

  const expectedSig = "sha256=" + crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");

  // Comparación timing-safe
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    console.warn("[wa-webhook] Invalid signature");
    return new NextResponse("Invalid signature", { status: 401 });
  }

  // ── 2. Parsear payload ──
  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  if (payload.object !== "whatsapp_business_account") {
    return new NextResponse("OK", { status: 200 });
  }

  // Procesar todos los messages que vinieron en este batch (Meta puede mandar varios)
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value?.messages) continue;

      const profileName = value.contacts?.[0]?.profile?.name ?? null;

      for (const msg of value.messages) {
        // Solo procesamos mensajes de texto por ahora
        if (msg.type !== "text" || !msg.text?.body) {
          await sendWhatsAppText(
            msg.from,
            "Por ahora solo puedo procesar mensajes de texto. ¿Podrías escribirme tu consulta?"
          );
          continue;
        }

        // ── 3. Deduplicación ──
        const existing = await db
          .select({ id: adrianaMessages.id })
          .from(adrianaMessages)
          .where(eq(adrianaMessages.waMessageId, msg.id))
          .limit(1);

        if (existing.length > 0) {
          console.log("[wa-webhook] Duplicate message ignored:", msg.id);
          continue;
        }

        // Marcar como leído (cosmético, no esperamos)
        markAsRead(msg.id).catch(() => {});

        // ── 4. Llamar al engine ──
        let result;
        try {
          result = await processUserMessage({
            waPhone: msg.from,
            waProfileName: profileName ?? undefined,
            userMessage: msg.text.body,
            waMessageId: msg.id,
          });
        } catch (err) {
          console.error("[wa-webhook] engine error:", err);
          await sendWhatsAppText(msg.from, "Disculpa, tuve un problema técnico. ¿Puedes intentar de nuevo en unos minutos?");
          continue;
        }

        // ── 5. Mandar respuesta vía Meta ──
        if (result.ok && result.assistantText) {
          const sendRes = await sendWhatsAppText(msg.from, result.assistantText);
          if (!sendRes.ok) {
            console.error("[wa-webhook] send error:", sendRes.error);
          }
        }
      }
    }
  }

  // Meta espera 200 rápido para no reintentar
  return new NextResponse("OK", { status: 200 });
}

// ─── Tipos del payload de WhatsApp Cloud API ───
interface WhatsAppWebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: { phone_number_id?: string; display_phone_number?: string };
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: Array<{
          from: string;          // número del usuario
          id: string;            // ID único del mensaje en Meta
          timestamp?: string;
          type: string;          // "text", "image", "audio", etc.
          text?: { body?: string };
        }>;
        statuses?: Array<{ id: string; status: string }>;
      };
    }>;
  }>;
}
