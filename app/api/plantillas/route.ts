export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";

/**
 * Lista y crea plantillas de WhatsApp usando el token de produccion.
 *
 * El token es sensitive en Vercel y no se puede bajar a una maquina local,
 * asi que la gestion se hace desde la app, que si lo tiene.
 *
 *   /api/plantillas?run=TOKEN            -> lista
 *   /api/plantillas?run=TOKEN&crear=noshow -> crea las de no-show
 */
const API = "https://graph.facebook.com/v22.0";

const NOSHOW = {
  es: {
    lang: "es",
    body: "Hola {{1}}, soy Adriana de FastForward. Teníamos una llamada agendada y no pudimos conectar. ¿Quieres que busquemos otro horario? Responde por aquí y lo coordinamos.",
  },
  en: {
    lang: "en",
    body: "Hi {{1}}, this is Adriana from FastForward. We had a call scheduled and couldn't connect. Would you like to find another time? Reply here and we'll set it up.",
  },
  pt: {
    lang: "pt_BR",
    body: "Olá {{1}}, sou Adriana da FastForward. Tínhamos uma ligação agendada e não conseguimos conectar. Quer que a gente busque outro horário? Responda por aqui que eu coordeno.",
  },
};

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("run") !== process.env.MANUAL_RUN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
  const waba = process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID || "1509260374256987";
  if (!token) return NextResponse.json({ error: "falta el token" }, { status: 500 });

  const crear = req.nextUrl.searchParams.get("crear");

  if (crear === "noshow") {
    const hechas: Record<string, unknown>[] = [];
    for (const [idi, t] of Object.entries(NOSHOW)) {
      const r = await fetch(`${API}/${waba}/message_templates`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "noshow_reagendar",
          language: t.lang,
          category: "MARKETING",
          components: [
            { type: "BODY", text: t.body,
              example: { body_text: [[idi === "pt" ? "Antônio" : idi === "en" ? "John" : "Carlos"]] } },
          ],
        }),
      });
      const d = await r.json();
      hechas.push({ idioma: idi, ok: !d.error, detalle: d.error?.message ?? d.id ?? d.status });
    }
    return NextResponse.json({ ok: true, creadas: hechas });
  }

  const r = await fetch(
    `${API}/${waba}/message_templates?limit=100&fields=name,language,status,category`,
    { headers: { Authorization: `Bearer ${token}` } });
  const d = await r.json();
  if (d.error) return NextResponse.json({ error: d.error.message }, { status: 400 });

  const plantillas = (d.data || []).map((t: Record<string, string>) =>
    ({ nombre: t.name, idioma: t.language, estado: t.status, categoria: t.category }));
  return NextResponse.json({ ok: true, total: plantillas.length, plantillas });
}
