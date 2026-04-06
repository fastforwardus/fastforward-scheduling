import { NextRequest, NextResponse } from "next/server";
import { getQBToken } from "@/lib/quickbooks";
import { db } from "@/db";
import { systemConfig } from "@/db/schema";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const token = await getQBToken();
    return NextResponse.json({ ok: true, preview: token.substring(0, 10) + "..." });
  } catch (err) {
    // Token failed — send alert to Carlos
    await resend.emails.send({
      from: "FastForward Sistema <info@fastfwdus.com>",
      to: "info@fastfwdus.com",
      subject: "🚨 QuickBooks token expirado — acción requerida",
      html: `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  <div style="background:#EF4444;border-radius:16px 16px 0 0;padding:24px;text-align:center;">
    <p style="color:white;font-size:20px;font-weight:700;margin:0;">🚨 QuickBooks Token Expirado</p>
  </div>
  <div style="background:white;border-radius:0 0 16px 16px;padding:32px;border:1px solid #E5E7EB;border-top:none;">
    <p style="color:#374151;">El token de QuickBooks expiró. Los invoices NO se están creando automáticamente.</p>
    <p style="color:#374151;margin-top:16px;"><strong>Para arreglar:</strong></p>
    <ol style="color:#374151;line-height:2;">
      <li>Ir a <a href="https://developer.intuit.com/app/developer/playground">developer.intuit.com/app/developer/playground</a></li>
      <li>Seleccionar la app, scope accounting, Get Authorization Code</li>
      <li>Get Tokens</li>
      <li>Copiar el Refresh Token</li>
      <li>Ir a <a href="https://scheduling.fastfwdus.com/dashboard/admin">scheduling.fastfwdus.com/dashboard/admin</a> → tab Finanzas → Actualizar Token QB</li>
    </ol>
    <p style="color:#6B7280;font-size:12px;margin-top:16px;">Error: ${String(err)}</p>
  </div>
</div>`,
    }).catch(console.error);

    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// Allow admin to update QB token via API
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { refreshToken } = await req.json();
  if (!refreshToken) return NextResponse.json({ error: "refreshToken required" }, { status: 400 });

  await db.insert(systemConfig).values({ key: "QB_REFRESH_TOKEN", value: refreshToken })
    .onConflictDoUpdate({ target: systemConfig.key, set: { value: refreshToken, updatedAt: new Date() } });

  return NextResponse.json({ ok: true });
}
