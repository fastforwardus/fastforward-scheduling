export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { Resend } from "resend";
import { autorizarOps } from "@/lib/ops-auth";
import { parseFechaSegura as parseFecha } from "@/lib/fechas";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";

interface Rem {
  id: string; title: string; notes: string | null; due_at: string;
  user_id: string; full_name: string; email: string; timezone: string | null;
}

export async function GET(req: NextRequest) {
  if (!(await autorizarOps(req)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const dryRun = params.get("apply") !== "1";
  // Para probar sin molestar a nadie: manda todos los digest a una sola casilla
  const forzarA = params.get("to");

  // Vencidos + lo que vence hoy, de gente activa, que no se aviso en 20 h
  const filas = await db.execute(sql`
    select r.id, r.title, r.notes, r.due_at,
           u.id as user_id, u.full_name, u.email, u.timezone
    from reminders r
    join users u on u.id = r.assigned_to_user_id
    where r.done_at is null
      and u.is_active
      and 'email' = any(r.notify_channels)
      and r.due_at < (now() at time zone 'America/New_York')::date + interval '1 day'
      and (r.last_notified_at is null or r.last_notified_at < now() - interval '20 hours')
    order by u.id, r.due_at
  `);

  const rems = (Array.isArray(filas) ? filas : []) as unknown as Rem[];

  const porUsuario = new Map<string, Rem[]>();
  for (const r of rems) {
    if (!porUsuario.has(r.user_id)) porUsuario.set(r.user_id, []);
    porUsuario.get(r.user_id)!.push(r);
  }

  const enviados: { a: string; cantidad: number }[] = [];

  for (const lista of porUsuario.values()) {
    const u = lista[0];
    if (!u.email) continue;

    const tz = u.timezone || "America/New_York";
    const ahora = Date.now();
    const vencidos = lista.filter(r => parseFecha(r.due_at).getTime() < ahora);
    const hoy = lista.filter(r => parseFecha(r.due_at).getTime() >= ahora);

    const fila = (r: Rem, venc: boolean) => {
      const cuando = parseFecha(r.due_at).toLocaleString("es-ES",
        { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: tz });
      return `<tr>
        <td style="padding:10px 16px;border-bottom:1px solid #F0F0F0;color:${venc ? "#991B1B" : "#6B7280"};font-size:13px;white-space:nowrap;">${cuando}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #F0F0F0;color:${venc ? "#7F1D1D" : "#111827"};font-size:14px;">
          ${r.title}${r.notes ? `<br><span style="color:#9CA3AF;font-size:12px;">${r.notes.slice(0, 120)}</span>` : ""}
        </td></tr>`;
    };

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;background:#F8F9FB;font-family:'Helvetica Neue',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FB;padding:32px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;">
<tr><td style="background:#27295C;padding:20px 28px;">
  <p style="margin:0;color:#C9A84C;font-size:13px;">Tus pendientes</p>
  <p style="margin:4px 0 0;color:#fff;font-size:20px;font-weight:600;">Hola, ${u.full_name.split(" ")[0]}</p>
</td></tr>
${vencidos.length ? `<tr><td style="padding:14px 28px 6px;">
  <p style="margin:0;color:#991B1B;font-size:13px;font-weight:600;">${vencidos.length} vencido${vencidos.length === 1 ? "" : "s"}</p>
</td></tr>
<tr><td style="padding:0 12px;"><table width="100%" style="border-collapse:collapse;">${vencidos.map(r => fila(r, true)).join("")}</table></td></tr>` : ""}
${hoy.length ? `<tr><td style="padding:14px 28px 6px;">
  <p style="margin:0;color:#6B7280;font-size:13px;font-weight:600;">Para hoy</p>
</td></tr>
<tr><td style="padding:0 12px;"><table width="100%" style="border-collapse:collapse;">${hoy.map(r => fila(r, false)).join("")}</table></td></tr>` : ""}
<tr><td style="padding:22px 28px;">
  <a href="${APP_URL}/dashboard" style="display:inline-block;background:#27295C;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;">Ver mi día →</a>
</td></tr>
<tr><td style="background:#F8F9FB;padding:14px 28px;border-top:1px solid #E5E7EB;">
  <p style="margin:0;color:#9CA3AF;font-size:11px;">FastForward · Este aviso se manda solo cuando tenés pendientes.</p>
</td></tr>
</table></td></tr></table></body></html>`;

    if (!dryRun) {
      await resend.emails.send({
        from: "FastForward <info@fastfwdus.com>",
        to: forzarA || u.email,
        subject: (forzarA ? `[${u.full_name}] ` : "") + (vencidos.length
          ? `${vencidos.length} pendiente${vencidos.length === 1 ? "" : "s"} vencido${vencidos.length === 1 ? "" : "s"}`
          : `Tenés ${hoy.length} pendiente${hoy.length === 1 ? "" : "s"} para hoy`),
        html,
      }).catch(e => console.error("digest error:", u.email, e));

      if (!forzarA) await db.execute(sql`
        update reminders set last_notified_at = now()
        where id in ${sql.raw("(" + lista.map(r => `'${r.id}'`).join(",") + ")")}
      `);
    }
    enviados.push({ a: u.email, cantidad: lista.length });
  }

  return NextResponse.json({ dryRun, usuarios: enviados.length, enviados });
}
