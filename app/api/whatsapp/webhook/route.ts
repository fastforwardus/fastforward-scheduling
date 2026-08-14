export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { db } from "@/db";
import { adrianaMessages, adrianaConversations, systemConfig, proposals, proposalEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { processUserMessage } from "@/lib/adriana/engine";
import { isOptOutMessage, OPT_OUT_REPLY } from "@/lib/adriana/opt-out";
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

      // Estados de entrega: sent / delivered / read / failed.
      // Sin esto no hay forma de saber por que un template no llega —
      // Meta acepta el request y reporta el fallo solo por aca.
      if (value?.statuses?.length) {
        for (const st of value.statuses) {
          const err = st.errors?.[0];
          const linea = `${st.status} | ${st.recipient_id} | ${st.id}` +
            (err ? ` | ERROR ${err.code}: ${err.title}${err.error_data?.details ? " — " + err.error_data.details : ""}` : "");
          console.log("[wa-status]", linea);
          if (st.status === "failed") {
            try {
              await db.insert(systemConfig)
                .values({ key: "WA_LAST_STATUS_ERROR", value: linea })
                .onConflictDoUpdate({ target: systemConfig.key, set: { value: linea } });
            } catch (e) { console.error("[wa-status] no se pudo guardar:", e); }

            // Meta acepta el envio y el fallo llega despues por webhook, asi que
            // la etapa ya avanzo. La retrocedemos para que el proximo run
            // reintente — util con 131049, que es un limite temporal por usuario.
            // Tope de 3 intentos para no reintentar en loop un numero muerto.
            try {
              if (st.id) {
                const [prop] = await db
                  .select({ id: proposals.id, stage: proposals.whatsappStage, fails: proposals.whatsappFailCount })
                  .from(proposals)
                  .where(eq(proposals.whatsappLastWamid, st.id))
                  .limit(1);
                if (prop) {
                  const fails = (prop.fails ?? 0) + 1;
                  const stage = prop.stage ?? 0;
                  const patch = fails < 3 && stage > 0
                    ? { whatsappStage: stage - 1, whatsappFailCount: fails }
                    : { whatsappFailCount: fails };
                  await db.update(proposals).set(patch).where(eq(proposals.id, prop.id));
                  await db.insert(proposalEvents).values({
                    proposalId: prop.id, kind: "delivery_failed", channel: "whatsapp",
                    detail: linea.slice(0, 300),
                  }).catch(() => {});
                  console.log("[wa-status] propuesta", prop.id, "intento", fails, fails < 3 ? "-> reintenta" : "-> no reintenta");
                }
              }
            } catch (e) { console.error("[wa-status] rollback fallido:", e); }
          }
        }
      }

      if (!value?.messages) continue;

      const profileName = value.contacts?.[0]?.profile?.name ?? null;
      // BSUID y username: se guardan desde ya para no depender del telefono
      // cuando WhatsApp complete el cambio a usernames.
      const contacto = value.contacts?.[0] as {
        wa_id?: string;
        user_id?: string;
        username?: string;
        profile?: { name?: string; username?: string };
      } | undefined;
      const waUserId = contacto?.user_id ?? null;
      const waUsername = contacto?.username ?? contacto?.profile?.username ?? null;

      // Mensajes de texto agrupados por remitente: si alguien manda "Hola" y
      // "Gracias" seguidos, Meta los entrega juntos y el for respondia a cada
      // uno por separado, mandando dos respuestas casi identicas. Un humano
      // lee las dos lineas y contesta una vez.
      const mensajes: typeof value.messages = [];
      const porRemitente = new Map<string, typeof value.messages>();
      for (const m of value.messages) {
        if (m.type !== "text" || !m.text?.body) { mensajes.push(m); continue; }
        if (!porRemitente.has(m.from)) porRemitente.set(m.from, []);
        porRemitente.get(m.from)!.push(m);
      }
      for (const [, grupo] of porRemitente) {
        if (grupo.length === 1) { mensajes.push(grupo[0]); continue; }
        // Se responde al ultimo (su id queda como referencia) con todo el texto
        const ultimo = grupo[grupo.length - 1];
        const textoJunto = grupo
          .map((m) => (m.text?.body ?? "").trim())
          .filter(Boolean)
          .join("\n");
        console.log("[wa-webhook] agrupados", grupo.length, "mensajes de", ultimo.from);
        mensajes.push({ ...ultimo, text: { ...(ultimo.text ?? {}), body: textoJunto } });
      }

      for (const msg of mensajes) {
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

        // ── 3b. Opt-out: cortar antes del engine ──
        // Si pidio la baja no queremos que el LLM le conteste nada mas.
        if (isOptOutMessage(msg.text.body)) {
          try {
            const [conv] = await db
              .select({ id: adrianaConversations.id, language: adrianaConversations.language })
              .from(adrianaConversations)
              .where(eq(adrianaConversations.waPhone, msg.from))
              .limit(1);

            if (conv) {
              await db
                .update(adrianaConversations)
                .set({ optedOutAt: new Date() })
                .where(eq(adrianaConversations.id, conv.id));
            } else {
              await db
                .insert(adrianaConversations)
                .values({ waPhone: msg.from, waProfileName: profileName, optedOutAt: new Date() })
                .onConflictDoUpdate({
                  target: adrianaConversations.waPhone,
                  set: { optedOutAt: new Date() },
                });
            }

            const lang = (conv?.language ?? "es") as "es" | "en" | "pt";
            await sendWhatsAppText(msg.from, OPT_OUT_REPLY[lang]);
            console.log("[wa-webhook] opt-out registrado:", msg.from);
          } catch (err) {
            console.error("[wa-webhook] opt-out error:", err);
          }
          continue;
        }

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

        // Guardar BSUID y username sobre la conversacion que acaba de crear el
        // engine. Va aparte y en try propio: es preparacion para el cambio de
        // WhatsApp a usernames y no debe poder romper el flujo actual.
        if (waUserId || waUsername) {
          try {
            await db
              .update(adrianaConversations)
              .set({
                ...(waUserId ? { waUserId } : {}),
                ...(waUsername ? { waUsername } : {}),
              })
              .where(eq(adrianaConversations.waPhone, msg.from));
          } catch (e) {
            console.error("[wa-webhook] no se pudo guardar wa_user_id:", e);
          }
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
        statuses?: Array<{
          id: string;
          status: string;
          recipient_id?: string;
          errors?: Array<{ code?: number; title?: string; error_data?: { details?: string } }>;
        }>;
      };
    }>;
  }>;
}
