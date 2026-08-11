export const runtime = "nodejs";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { campanaLeads, adrianaConversations } from "@/db/schema";
import { eq, sql, isNotNull } from "drizzle-orm";
import { sendWhatsAppTemplate } from "@/lib/adriana/whatsapp-sender";
import { getOrCreateConversation, appendMessage, updateConversation } from "@/lib/adriana/db-helpers";
import { renderTemplate } from "@/lib/whatsapp-templates";
import { normalizeWhatsAppPhone, phoneTail } from "@/lib/phone";

const TPL = "reactivacion_consulta";
const LANG: Record<string, string> = { es: "es", en: "en", pt: "pt_BR" };

/**
 * Freno por calidad. Si el numero no esta en GREEN no se manda nada: un pico
 * de reportes aca tumba tambien a Adriana y a los recordatorios de propuesta,
 * que corren por el mismo numero.
 */
async function calidadOk(): Promise<{ ok: boolean; rating: string }> {
  const id = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
  if (!id || !token) return { ok: false, rating: "sin credenciales" };
  try {
    const r = await fetch(
      `https://graph.facebook.com/v22.0/${id}?fields=quality_rating,messaging_limit_tier`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const d = await r.json();
    const rating = String(d?.quality_rating || "desconocido");
    return { ok: rating === "GREEN", rating };
  } catch {
    return { ok: false, rating: "error al consultar" };
  }
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("run") !== process.env.MANUAL_RUN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cantidad = Math.min(Number(req.nextUrl.searchParams.get("n") || 15), 60);
  const simular = req.nextUrl.searchParams.get("dry") === "1";

  const cal = await calidadOk();
  if (!cal.ok && !simular) {
    return NextResponse.json({
      ok: false, frenado: true, rating: cal.rating,
      mensaje: "No se envio nada: el numero no esta en GREEN.",
    });
  }

  // Bajas registradas por el webhook de Adriana
  const bajas = new Set<string>();
  const outs = await db.select({ waPhone: adrianaConversations.waPhone })
    .from(adrianaConversations).where(isNotNull(adrianaConversations.optedOutAt));
  for (const o of outs) { bajas.add(normalizeWhatsAppPhone(o.waPhone)); bajas.add(phoneTail(o.waPhone)); }

  // Los mas recientes primero: son los que mas chance tienen de recordarnos
  const pendientes = await db.select().from(campanaLeads)
    .where(eq(campanaLeads.estado, "pendiente"))
    .orderBy(sql`${campanaLeads.antiguedadMeses} asc nulls last`)
    .limit(cantidad * 2);

  let enviados = 0, saltados = 0, fallidos = 0;
  const detalle: Record<string, unknown>[] = [];

  for (const p of pendientes) {
    if (enviados >= cantidad) break;
    const tel = p.telefonoE164;

    if (bajas.has(tel) || bajas.has(phoneTail(tel))) {
      await db.update(campanaLeads).set({ estado: "baja", motivo: "pidio baja" })
        .where(eq(campanaLeads.id, p.id));
      saltados++;
      continue;
    }

    const nombre = (p.nombre || "").split(" ")[0] || "";
    const tema = p.servicio && p.servicio.trim()
      ? p.servicio.trim()
      : "entrada al mercado de Estados Unidos";
    const lang = LANG[p.idioma || "es"] || "es";

    if (simular) {
      detalle.push({ tel, nombre, tema, lang, antiguedad: p.antiguedadMeses });
      enviados++;
      continue;
    }

    const r = await sendWhatsAppTemplate({
      toPhone: tel, templateName: TPL, languageCode: lang,
      bodyParams: [nombre, tema],
    });

    if (r.ok) {
      await db.update(campanaLeads).set({
        estado: "enviado", wamid: r.metaMessageId ?? null, enviadoAt: new Date(), motivo: null,
      }).where(eq(campanaLeads.id, p.id));
      enviados++;

      // Queda en el hilo de Adriana para que la respuesta entre con contexto
      try {
        const conv = await getOrCreateConversation(tel, p.nombre || undefined);
        await appendMessage({
          conversationId: conv.id, role: "assistant",
          content: [{ type: "text", text: renderTemplate(TPL, lang, [nombre, tema]) }],
          waMessageId: r.metaMessageId ?? null,
        });
        await updateConversation(conv.id, {
          lastAssistantMsgAt: new Date(),
          ...(conv.leadName ? {} : { leadName: p.nombre || null }),
          ...(conv.leadEmail ? {} : { leadEmail: p.email || null }),
          ...(conv.leadCompany ? {} : { leadCompany: p.empresa || null }),
          ...(conv.language ? {} : { language: (p.idioma || "es") as "es" | "en" | "pt" }),
        });
      } catch (e) { console.error("[campana] no se registro en Adriana:", e); }
    } else {
      await db.update(campanaLeads).set({
        estado: "fallo", motivo: String(r.error).slice(0, 250),
      }).where(eq(campanaLeads.id, p.id));
      fallidos++;
    }

    // Espaciado entre envios: una rafaga instantanea es mas sospechosa
    await new Promise((s) => setTimeout(s, 900));
  }

  const resumen = await db.execute(sql`
    select estado, count(*)::int n from campana_leads group by estado order by n desc`);
  const filas = (Array.isArray(resumen) ? resumen : ((resumen as { rows?: unknown[] })?.rows ?? []));

  console.log("[campana]", simular ? "SIMULACION" : "envio real",
    "| enviados:", enviados, "| fallidos:", fallidos, "| saltados:", saltados, "| calidad:", cal.rating);

  return NextResponse.json({
    ok: true, simulacion: simular, calidad: cal.rating,
    enviados, fallidos, saltados,
    ...(simular ? { detalle } : {}),
    totales: filas,
  });
}
