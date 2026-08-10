export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { webLeads } from "@/db/schema";
import { sql } from "drizzle-orm";
import { validarTelefono } from "@/lib/phone-lookup";
import { sendWhatsAppTemplate } from "@/lib/adriana/whatsapp-sender";
import { getOrCreateConversation, appendMessage, updateConversation } from "@/lib/adriana/db-helpers";
import { renderTemplate } from "@/lib/whatsapp-templates";

const ENABLED = process.env.WEB_LEAD_WHATSAPP_ENABLED === "true";
// Resend reenvia TODOS los inbound del dominio a este endpoint: los del
// formulario, las respuestas a fdareg@, a leads@reply, etc. Filtramos por
// destinatario y asunto para procesar solo los del formulario web.
const BUZON = "leads@istoilrune.resend.app";
const CAP_DIARIO = 12;
const TPL = "contacto_web_seguimiento";
const LANG: Record<string, string> = { es: "es", en: "en", pt: "pt_BR" };

/** El formulario manda "Campo: valor" por linea. */
function campo(texto: string, etiqueta: string): string {
  const re = new RegExp(`^\\s*${etiqueta}\\s*:\\s*(.*)$`, "im");
  return (texto.match(re)?.[1] || "").trim();
}

function idiomaDe(v: string): "es" | "en" | "pt" {
  const t = v.toLowerCase();
  if (t.includes("portug")) return "pt";
  if (t.includes("ingl") || t.includes("english")) return "en";
  return "es";
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const d = payload?.data ?? payload;
    const asunto = String(d?.subject || "");
    const cuerpo = String(d?.text || d?.plain || "");
    const para = (Array.isArray(d?.to) ? d.to : [d?.to])
      .map((x: unknown) => String(typeof x === "object" && x ? (x as { address?: string }).address ?? "" : x ?? "").toLowerCase())
      .join(",");

    if (!para.includes(BUZON)) {
      return NextResponse.json({ ok: true, ignorado: "otro destinatario" });
    }
    if (!asunto.toLowerCase().includes("fastforward web")) {
      return NextResponse.json({ ok: true, ignorado: "asunto" });
    }

    const nombre = campo(cuerpo, "Nombre Completo");
    const email = campo(cuerpo, "Correo Electr[oó]nico");
    const telefono = campo(cuerpo, "Tel[eé]fono");
    const servicio = campo(cuerpo, "Servicio") || "tu consulta";
    const idioma = idiomaDe(campo(cuerpo, "Idioma"));
    const mensaje = campo(cuerpo, "Mensaje");
    const empresa = campo(cuerpo, "Empresa");
    const url = campo(cuerpo, "URL de la p[aá]gina");

    // Dedupe: mismo email o telefono en las ultimas 24h
    if (email || telefono) {
      const dup = await db.execute(sql`
        select 1 from web_leads
        where created_at > now() - interval '24 hours'
          and (email = ${email || null} or telefono = ${telefono || null})
        limit 1`);
      const filas = Array.isArray(dup) ? dup : ((dup as { rows?: unknown[] })?.rows ?? []);
      if (filas.length) return NextResponse.json({ ok: true, ignorado: "duplicado" });
    }

    // El telefono debe traer pais. Lookups lo confirma: sin codigo valido,
    // no hay forma de saber a que pais pertenece y no se manda nada.
    let e164: string | null = null;
    let motivo: string | null = null;
    const digitos = telefono.replace(/\D/g, "");
    if (!digitos) motivo = "sin telefono";
    else {
      const chk = await validarTelefono(digitos);
      if (chk.valido && chk.e164) e164 = chk.e164;
      else motivo = chk.verificado ? "telefono sin pais o invalido" : "no se pudo verificar";
    }

    let enviado = false;

    if (ENABLED && e164) {
      const hoy = await db.execute(sql`
        select count(*)::int n from web_leads
        where wa_enviado = true
          and created_at >= date_trunc('day', now() at time zone 'America/New_York')`);
      const f = (Array.isArray(hoy) ? hoy : ((hoy as { rows?: unknown[] })?.rows ?? [])) as Record<string, unknown>[];
      const usados = Number(f[0]?.n ?? 0);

      if (usados >= CAP_DIARIO) {
        motivo = `cap diario alcanzado (${CAP_DIARIO})`;
      } else {
        const primerNombre = (nombre || "").split(" ")[0] || "";
        const r = await sendWhatsAppTemplate({
          toPhone: e164,
          templateName: TPL,
          languageCode: LANG[idioma] || "es",
          bodyParams: [primerNombre, servicio],
        });
        if (r.ok) {
          enviado = true;
          // Se registra en Adriana para que la respuesta caiga en su hilo con contexto
          try {
            const conv = await getOrCreateConversation(e164, nombre || undefined);
            await appendMessage({
              conversationId: conv.id, role: "assistant",
              content: [{ type: "text", text: renderTemplate(TPL, LANG[idioma] || "es", [primerNombre, servicio]) }],
              waMessageId: r.metaMessageId ?? null,
            });
            await updateConversation(conv.id, {
              lastAssistantMsgAt: new Date(),
              ...(conv.leadName ? {} : { leadName: nombre || null }),
              ...(conv.leadEmail ? {} : { leadEmail: email || null }),
              ...(conv.leadCompany ? {} : { leadCompany: empresa || null }),
              ...(conv.language ? {} : { language: idioma }),
            });
          } catch (e) { console.error("[web-lead] no se registro en Adriana:", e); }
        } else {
          motivo = String(r.error).slice(0, 200);
        }
      }
    } else if (!ENABLED) {
      motivo = motivo || "flag apagado";
    }

    await db.insert(webLeads).values({
      nombre: nombre || null, email: email || null, telefono: telefono || null,
      telefonoE164: e164, empresa: empresa || null, servicio: servicio || null,
      idioma, mensaje: mensaje || null, urlOrigen: url || null,
      waEnviado: enviado, waMotivo: motivo,
    });

    console.log("[web-lead]", nombre, email, e164 || telefono, enviado ? "-> WhatsApp enviado" : `-> sin enviar (${motivo})`);
    return NextResponse.json({ ok: true, enviado, motivo });
  } catch (err) {
    console.error("resend-inbound error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
