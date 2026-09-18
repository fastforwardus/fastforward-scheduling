export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

// Endpoint TEMPORAL de administracion de plantillas de WhatsApp.
// Protegido con CRON_SECRET. Se elimina despues de crear cita_recordatorio_2h.
const WABA = "1509260374256987";
const API = "https://graph.facebook.com/v22.0";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
  const accion = new URL(req.url).searchParams.get("accion") || "listar";

  if (accion === "listar") {
    const res = await fetch(`${API}/${WABA}/message_templates?fields=name,status,language,category&limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  if (accion === "crear") {
    const defs = [
      { language: "es",    body: "Hola {{1}}, te recordamos que tu reunion con FastForward es hoy a las {{2}} con {{3}}. Si no puedes asistir, responde por aqui y la reprogramamos.", btn: "Ver detalles", ejemplo: ["Carlos", "2:30 PM", "Francisco Logarzo"] },
      { language: "en",    body: "Hi {{1}}, a reminder that your meeting with FastForward is today at {{2}} with {{3}}. If you cannot make it, reply here and we will reschedule.", btn: "View details", ejemplo: ["Carlos", "2:30 PM", "Francisco Logarzo"] },
      { language: "pt_BR", body: "Ola {{1}}, lembramos que sua reuniao com a FastForward e hoje as {{2}} com {{3}}. Se nao puder participar, responda por aqui e reagendamos.", btn: "Ver detalhes", ejemplo: ["Carlos", "2:30 PM", "Francisco Logarzo"] },
    ];
    const resultados = [];
    for (const d of defs) {
      const res = await fetch(`${API}/${WABA}/message_templates`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "cita_recordatorio_2h",
          language: d.language,
          category: "UTILITY",
          components: [
            { type: "BODY", text: d.body, example: { body_text: [d.ejemplo] } },
            { type: "BUTTONS", buttons: [{ type: "URL", text: d.btn, url: "https://scheduling.fastfwdus.com/book/confirm/{{1}}", example: ["https://scheduling.fastfwdus.com/book/confirm/abc123"] }] },
          ],
        }),
      });
      const data = await res.json();
      resultados.push({ lang: d.language, status: res.status, data });
    }
    return NextResponse.json({ resultados });
  }

  return NextResponse.json({ error: "accion invalida" }, { status: 400 });
}
