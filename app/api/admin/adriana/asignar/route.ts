export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { sendWhatsAppText } from "@/lib/adriana/whatsapp-sender";
import { parseFechaSegura as parseFecha } from "@/lib/fechas";

const VENTANA_HS = 24;


/** Asignar la conversacion a alguien del equipo. Solo admin y managers. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "sales_manager"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { conversationId, userId } = await req.json();
  if (!conversationId) return NextResponse.json({ error: "Falta conversationId" }, { status: 400 });

  const filas = await db.execute(sql`
    update adriana_conversations
    set owner_user_id = ${userId || null},
        asignada_at = ${userId ? sql`now()` : null},
        asignada_por = ${userId ? session.id : null}
    where id = ${conversationId}
    returning id, lead_name, lead_email, lead_company, wa_phone, owner_user_id
  `);
  const conv = (Array.isArray(filas) ? filas[0] : null) as Record<string, unknown> | null;
  if (!conv) return NextResponse.json({ error: "Conversacion no encontrada" }, { status: 404 });

  if (userId) {
    const quien = String(conv.lead_company || conv.lead_name || conv.wa_phone);
    await db.execute(sql`
      insert into reminders (title, notes, due_at, original_due_at,
                             created_by_user_id, assigned_to_user_id,
                             lead_email, lead_phone, source_type, source_id, notify_channels)
      values (${"Responder a " + quien},
              'Conversacion de WhatsApp asignada',
              now(), now(), ${session.id}, ${userId},
              ${String(conv.lead_email || "").toLowerCase() || null},
              ${String(conv.wa_phone || "") || null},
              'conversacion', ${conversationId},
              ARRAY['app','email']::text[])
    `);

    // Resolver los handoffs abiertos de esta conversacion
    await db.execute(sql`
      update adriana_handoffs set resolved_at = now(), resolved_by_user_id = ${userId}
      where conversation_id = ${conversationId} and resolved_at is null
    `);
  }

  return NextResponse.json({ ok: true, ownerUserId: conv.owner_user_id });
}

/** Responder al cliente con el numero de Adriana. Solo el dueno. */
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId, texto } = await req.json();
  if (!conversationId || !texto?.trim())
    return NextResponse.json({ error: "Faltan conversationId o texto" }, { status: 400 });

  const filas = await db.execute(sql`
    select id, wa_phone, owner_user_id, last_user_msg_at, opted_out_at
    from adriana_conversations where id = ${conversationId} limit 1
  `);
  const c = (Array.isArray(filas) ? filas[0] : null) as Record<string, unknown> | null;
  if (!c) return NextResponse.json({ error: "Conversacion no encontrada" }, { status: 404 });

  if (c.opted_out_at)
    return NextResponse.json({ error: "El cliente pidio no recibir mensajes" }, { status: 409 });

  if (c.owner_user_id !== session.id && session.role !== "admin")
    return NextResponse.json({ error: "La conversacion tiene otro responsable" }, { status: 403 });

  const ultimo = c.last_user_msg_at ? parseFecha(c.last_user_msg_at).getTime() : 0;
  const horas = (Date.now() - ultimo) / 3600000;
  if (!ultimo || horas > VENTANA_HS)
    return NextResponse.json({
      error: "ventana_cerrada",
      mensaje: "Pasaron mas de 24 h desde el ultimo mensaje del cliente. Meta solo permite plantillas aprobadas.",
      horas: Math.round(horas),
    }, { status: 409 });

  const envio = await sendWhatsAppText(String(c.wa_phone), texto.trim());
  if (!envio.ok)
    return NextResponse.json({ error: "No se pudo enviar", detalle: envio.error }, { status: 502 });

  await db.execute(sql`
    insert into adriana_messages (conversation_id, role, content, wa_message_id)
    values (${conversationId}, 'human',
            ${JSON.stringify([{ type: "text", text: texto.trim() }])}::jsonb,
            ${(envio as { messageId?: string }).messageId ?? null})
  `);
  await db.execute(sql`
    update adriana_conversations set last_assistant_msg_at = now(), updated_at = now()
    where id = ${conversationId}
  `);

  return NextResponse.json({ ok: true });
}
