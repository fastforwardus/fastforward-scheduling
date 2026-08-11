export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
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

/**
 * Firma estilo Svix, que es lo que usa Resend. Sin esto el endpoint es
 * publico: cualquiera podria disparar WhatsApps a numeros arbitrarios
 * desde nuestro numero de negocio.
 */
function verificarFirma(raw: string, headers: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return true; // sin secreto configurado, no bloqueamos

  const id = headers.get("svix-id") || headers.get("webhook-id");
  const ts = headers.get("svix-timestamp") || headers.get("webhook-timestamp");
  const sig = headers.get("svix-signature") || headers.get("webhook-signature");
  if (!id || !ts || !sig) return false;

  // Rechazar reenvios viejos (mas de 5 minutos)
  const edad = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(edad) || edad > 300) return false;

  const clave = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const esperada = crypto.createHmac("sha256", clave)
    .update(`${id}.${ts}.${raw}`).digest("base64");

  // La cabecera trae una o varias firmas, con formato "v1,<firma>"
  return sig.split(" ").some((parte) => {
    const val = parte.includes(",") ? parte.split(",")[1] : parte;
    try {
      return crypto.timingSafeEqual(Buffer.from(val), Buffer.from(esperada));
    } catch { return false; }
  });
}
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
    const raw = await req.text();
    if (!verificarFirma(raw, req.headers)) {
      console.warn("[web-lead] firma invalida — request descartado");
      return NextResponse.json({ error: "firma invalida" }, { status: 401 });
    }
    const payload = JSON.parse(raw);
    const d = payload?.data ?? payload;
    const asunto = String(d?.subject || "");

    // El payload no siempre trae el cuerpo: segun el caso viene en text, en
    // html, o hay que pedirlo por la API de receiving con el id del email.
    let cuerpo = String(d?.text || d?.plain || d?.body || "");
    if (!cuerpo && d?.html) {
      cuerpo = String(d.html)
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&");
    }
    if (!cuerpo && d?.email_id && process.env.RESEND_API_KEY) {
      try {
        const r = await fetch(`https://api.resend.com/emails/receiving/${d.email_id}`, {
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        });
        if (r.ok) {
          const full = await r.json();
          cuerpo = String(full?.text || full?.html || "");
          if (cuerpo.includes("<")) cuerpo = cuerpo.replace(/<[^>]+>/g, "");
        } else {
          console.warn("[web-lead] receiving API respondio", r.status);
        }
      } catch (e) { console.error("[web-lead] no se pudo traer el cuerpo:", e); }
    }
    if (!cuerpo) {
      console.warn("[web-lead] sin cuerpo. Campos del payload:", Object.keys(d || {}).join(", "));
    }
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

    // Dedupe solo por telefono: es a lo que le mandamos el mensaje. Filtrar
    // tambien por email bloqueaba personas distintas que comparten direccion
    // (por ejemplo las de "Ocultar mi correo" de Apple).
    if (telefono) {
      const soloDigitos = telefono.replace(/\D/g, "");
      const dup = await db.execute(sql`
        select 1 from web_leads
        where created_at > now() - interval '24 hours'
          and regexp_replace(coalesce(telefono, ''), '[^0-9]', '', 'g') = ${soloDigitos}
        limit 1`);
      const filas = Array.isArray(dup) ? dup : ((dup as { rows?: unknown[] })?.rows ?? []);
      if (filas.length) return NextResponse.json({ ok: true, ignorado: "telefono repetido" });
    }

    // Muchos cargan el numero sin codigo de pais. Se infiere del slug de la
    // landing (las paginas tienen el pais en la URL) y se valida con Lookups:
    // si el candidato no es un numero real, no se manda.
    const PAIS_URL: [RegExp, string][] = [
      [/mexico|-mx\b/i, "52"], [/colombia|-co\b/i, "57"], [/chile|-cl\b/i, "56"],
      [/peru|-pe\b/i, "51"], [/argentina|-ar\b/i, "54"], [/ecuador|-ec\b/i, "593"],
      [/espana|spain|-es\b/i, "34"], [/brasil|brazil|-br\b/i, "55"],
      [/panama|-pa\b/i, "507"], [/guatemala|-gt\b/i, "502"],
      [/costa-rica|-cr\b/i, "506"], [/bolivia|-bo\b/i, "591"],
      [/estados-unidos|usa|-us\b/i, "1"],
    ];

    let e164: string | null = null;
    let motivo: string | null = null;
    const digitos = telefono.replace(/\D/g, "");

    if (!digitos) {
      motivo = "sin telefono";
    } else {
      const candidatos = [digitos];
      // Si no arranca con +, probamos anteponiendo el pais de la landing
      if (!telefono.trim().startsWith("+")) {
        const pais = PAIS_URL.find(([re]) => re.test(url))?.[1];
        if (pais && !digitos.startsWith(pais)) candidatos.push(pais + digitos);
      }

      for (const cand of candidatos) {
        const chk = await validarTelefono(cand);
        if (chk.valido && chk.e164) { e164 = chk.e164; break; }
        if (!chk.verificado) { motivo = "no se pudo verificar"; break; }
      }
      if (!e164 && !motivo) motivo = "telefono sin pais o invalido";
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
