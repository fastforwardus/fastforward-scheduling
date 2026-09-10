export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Avisa antes de que un modelo que usamos deje de existir.
 *
 * Cuatro endpoints apuntaban a un modelo retirado y acumularon 22.913 fallos
 * en silencio: el follow-up del dia 1 estuvo meses sin funcionar. Esto compara
 * lo que usa el codigo contra lo que la API ofrece hoy.
 *
 * Cuando se cambia un modelo en el codigo, hay que actualizarlo aca tambien.
 */
const EN_USO: { modelo: string; donde: string }[] = [
  { modelo: "claude-opus-4-5",  donde: "Adriana (lib/adriana/engine.ts)" },
  { modelo: "claude-sonnet-5",  donde: "followup, almost-closed" },
];

export async function GET(req: NextRequest) {
  const esCron = req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  if (!esCron && req.nextUrl.searchParams.get("run") !== process.env.MANUAL_RUN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "falta ANTHROPIC_API_KEY" }, { status: 500 });

  let disponibles: string[] = [];
  try {
    const r = await fetch("https://api.anthropic.com/v1/models?limit=100", {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    });
    const d = await r.json() as { data?: { id: string }[]; error?: { message?: string } };
    if (d.error) throw new Error(d.error.message);
    disponibles = (d.data || []).map((m) => m.id);
  } catch (e) {
    console.error("[modelos] no se pudo consultar la lista:", e);
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 502 });
  }

  const faltan = EN_USO.filter((x) => !disponibles.includes(x.modelo));
  console.log("[modelos] disponibles:", disponibles.length, "| en riesgo:", faltan.length);

  if (faltan.length) {
    await resend.emails.send({
      from: "FastForward Sistema <info@fastfwdus.com>",
      to: (process.env.INFORME_EMAIL || "info@fastfwdus.com").split(","),
      subject: `Atención: ${faltan.length} modelo(s) de IA ya no están disponibles`,
      html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;max-width:560px;">
<p style="margin:0 0 14px;font-size:16px;"><b>Hay modelos en uso que ya no figuran en la API</b></p>
<p style="margin:0 0 16px;color:#5b6472;">Cuando un modelo se retira, todo lo que lo usa empieza a fallar en silencio. Hay que actualizarlos antes de que dejen de responder.</p>
${faltan.map((f) => `<div style="border-left:3px solid #DC2626;padding-left:14px;margin-bottom:14px;">
<p style="margin:0;font-weight:700;">${f.modelo}</p>
<p style="margin:2px 0 0;color:#5b6472;font-size:13px;">${f.donde}</p></div>`).join("")}
<p style="margin:16px 0 0;font-size:12px;color:#9CA3AF;">Modelos disponibles hoy: ${disponibles.slice(0, 12).join(", ")}</p>
</div>`,
    }).catch((e) => console.error("[modelos] no se pudo avisar:", e));
  }

  return NextResponse.json({
    ok: true, enUso: EN_USO.map((x) => x.modelo), faltan, disponibles,
  });
}
