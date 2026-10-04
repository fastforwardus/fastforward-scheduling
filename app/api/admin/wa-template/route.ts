import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NAME = "caso_actualizacion";
const TPLS = [
  { language: "es", text: "Hola {{1}}, novedades de FastForward sobre su trámite {{2}}: {{3}}. Puede ver el detalle completo en su portal de clientes. Si tiene dudas, responda por aquí.", ex: ["Juan", "Registro FDA — Alimentos", "ahora en etapa 3 de 5 (Preparación del registro)"] },
  { language: "en", text: "Hi {{1}}, an update from FastForward on your filing {{2}}: {{3}}. You can see the full details in your client portal. If you have any questions, just reply here.", ex: ["John", "FDA Registration — Food", "now at stage 3 of 5 (Registration preparation)"] },
];

function auth(req: Request) {
  const s = req.headers.get("x-secret");
  return !!s && s === process.env.CRON_SECRET;
}

async function status() {
  const waba = process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID;
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
  const r = await fetch(`https://graph.facebook.com/v22.0/${waba}/message_templates?name=${NAME}&fields=name,language,status,category,rejected_reason`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  return r.json();
}

/** GET: estado de la plantilla en Meta */
export async function GET(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await status());
}

/** POST: crea la plantilla en es + en */
export async function POST(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const waba = process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID;
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
  const results = [];
  for (const t of TPLS) {
    const r = await fetch(`https://graph.facebook.com/v22.0/${waba}/message_templates`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: NAME, language: t.language, category: "UTILITY", components: [{ type: "BODY", text: t.text, example: { body_text: [t.ex] } }] }),
    });
    results.push({ language: t.language, http: r.status, body: await r.json() });
  }
  return NextResponse.json({ results, status: await status() });
}
