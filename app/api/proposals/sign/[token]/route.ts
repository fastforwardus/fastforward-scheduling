import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { proposals } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const [proposal] = await db.select({
    clientName: proposals.clientName,
    proposalNum: proposals.proposalNum,
    total: proposals.total,
    lang: proposals.lang,
    repName: proposals.repName,
    signedAt: proposals.signedAt,
  }).from(proposals).where(eq(proposals.signToken, params.token)).limit(1);

  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ proposal });
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";

  const [proposal] = await db.select().from(proposals)
    .where(eq(proposals.signToken, params.token)).limit(1);

  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (proposal.signedAt) return NextResponse.json({ error: "Already signed" }, { status: 400 });

  await db.update(proposals)
    .set({ signedAt: new Date(), signedIp: ip })
    .where(eq(proposals.signToken, params.token));


  // Notify rep + Carlos
  await resend.emails.send({
    from: "FastForward Sistema <info@fastfwdus.com>",
    replyTo: "info@fastfwdus.com",
    to: "info@fastfwdus.com",
    subject: `✅ Propuesta firmada — ${proposal.clientName} (${proposal.proposalNum})`,
    html: `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  <div style="background:#27295C;border-radius:16px 16px 0 0;padding:28px;text-align:center;">
    <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="32" alt="FastForward">
  </div>
  <div style="background:white;border-radius:0 0 16px 16px;padding:32px;border:1px solid #E5E7EB;border-top:none;">
    <p style="font-size:18px;font-weight:700;color:#27295C;margin:0 0 16px;">🎉 Propuesta aceptada y firmada</p>
    <div style="background:#F8F9FB;border-radius:12px;padding:16px;border:1px solid #E5E7EB;margin-bottom:20px;">
      <p style="font-size:13px;color:#6B7280;margin:0 0 4px;">Cliente</p>
      <p style="font-size:15px;font-weight:700;color:#27295C;margin:0 0 12px;">${proposal.clientName}</p>
      <p style="font-size:13px;color:#6B7280;margin:0 0 4px;">Propuesta</p>
      <p style="font-size:13px;font-weight:600;color:#27295C;margin:0 0 12px;">${proposal.proposalNum}</p>
      <p style="font-size:13px;color:#6B7280;margin:0 0 4px;">Total firmado</p>
      <p style="font-size:18px;font-weight:700;color:#C9A84C;margin:0;">USD $${proposal.total.toLocaleString("en-US")}</p>
    </div>
    <p style="font-size:13px;color:#6B7280;margin:0;">IP de firma: ${ip}</p>
    <p style="font-size:13px;color:#6B7280;margin:4px 0 0;">Fecha: ${new Date().toLocaleString("es-ES", { timeZone: "America/New_York" })} (Miami)</p>
  </div>
</div>`,
  }).catch(console.error);

  // Email confirmation to client
  const langLabels: Record<string, { subject: string; body: string }> = {
    es: { subject: `Confirmación de propuesta — ${proposal.proposalNum}`, body: "Tu propuesta fue firmada exitosamente. Nuestro equipo se pondrá en contacto contigo para comenzar con los trámites." },
    en: { subject: `Proposal confirmation — ${proposal.proposalNum}`, body: "Your proposal has been successfully signed. Our team will contact you to begin the process." },
    pt: { subject: `Confirmação de proposta — ${proposal.proposalNum}`, body: "Sua proposta foi assinada com sucesso. Nossa equipe entrará em contato para iniciar os trâmites." },
  };
  const ll = langLabels[proposal.lang || "es"] || langLabels.es;

  await resend.emails.send({
    from: "FastForward FDA Experts <info@fastfwdus.com>",
    replyTo: "info@fastfwdus.com",
    to: proposal.clientEmail,
    subject: ll.subject,
    html: `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  <div style="background:#27295C;border-radius:16px 16px 0 0;padding:28px;text-align:center;">
    <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="32" alt="FastForward">
  </div>
  <div style="background:white;border-radius:0 0 16px 16px;padding:32px;border:1px solid #E5E7EB;border-top:none;">
    <p style="font-size:18px;font-weight:700;color:#27295C;margin:0 0 12px;">✅ ${proposal.proposalNum}</p>
    <p style="font-size:14px;color:#374151;margin:0 0 20px;">${ll.body}</p>
    <div style="border-top:1px solid #F0F0F0;padding-top:20px;text-align:center;">
      <p style="font-size:12px;color:#9CA3AF;">FastForward Trading Company LLC · Miami, FL</p>
      <a href="https://fastfwdus.com" style="font-size:12px;color:#C9A84C;">fastfwdus.com</a>
    </div>
  </div>
</div>`,
  }).catch(console.error);

  return NextResponse.json({ ok: true });
}
