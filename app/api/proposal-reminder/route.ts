export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { proposals, appointments, users } from "@/db/schema";
import { eq, and, isNull, lte, gte } from "drizzle-orm";
import { Resend } from "resend";
import Anthropic from "@anthropic-ai/sdk";

const resend = new Resend(process.env.RESEND_API_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

  // Proposals sent 7 days ago, still pending
  const pending = await db.select({
    id: proposals.id,
    proposalNum: proposals.proposalNum,
    total: proposals.total,
    lang: proposals.lang,
    confirmToken: proposals.confirmToken,
    appointmentId: proposals.appointmentId,
    services: proposals.services,
    createdAt: proposals.createdAt,
  }).from(proposals)
    .where(
      and(
        eq(proposals.status, "pending"),
        lte(proposals.createdAt, sevenDaysAgo),
        gte(proposals.createdAt, eightDaysAgo),
        isNull(proposals.acceptedAt),
      )
    );

  let sent = 0;

  for (const proposal of pending) {
    const [appt] = await db.select({
      clientName: appointments.clientName,
      clientCompany: appointments.clientCompany,
      clientEmail: appointments.clientEmail,
      clientWhatsapp: appointments.clientWhatsapp,
      assignedTo: appointments.assignedTo,
      serviceInterest: appointments.serviceInterest,
    }).from(appointments).where(eq(appointments.id, proposal.appointmentId as string)).limit(1);

    if (!appt) continue;

    let repName = "FastForward FDA Experts";
    let repEmail = "info@fastfwdus.com";
    if (appt.assignedTo) {
      const [rep] = await db.select({ fullName: users.fullName, email: users.email })
        .from(users).where(eq(users.id, appt.assignedTo)).limit(1);
      if (rep) { repName = rep.fullName; repEmail = rep.email; }
    }

    const lang = (proposal.lang || "es") as "es" | "en" | "pt";
    const firstName = appt.clientName.split(" ")[0];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";
    const confirmUrl = `${appUrl}/proposal/confirm/${proposal.confirmToken}`;

    // Generate AI reminder message
    const aiMsg = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20251001",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: `Generá un recordatorio breve y amigable en ${lang === "en" ? "inglés" : lang === "pt" ? "portugués" : "español"} para ${firstName} de ${appt.clientCompany || "su empresa"}, recordándole que tiene una propuesta de FastForward FDA Experts pendiente de confirmación por USD $${proposal.total.toLocaleString("en-US")}. 
Máximo 2 oraciones. Tono profesional pero cálido. Sin saludos ni despedidas. Solo el cuerpo del mensaje.`
      }]
    });

    const aiText = aiMsg.content[0].type === "text" ? aiMsg.content[0].text : "";

    const subjects = {
      es: `Recordatorio: su propuesta ${proposal.proposalNum} está pendiente — FastForward`,
      en: `Reminder: your proposal ${proposal.proposalNum} is pending — FastForward`,
      pt: `Lembrete: sua proposta ${proposal.proposalNum} está pendente — FastForward`,
    };

    const btnLabels = {
      es: "✅ Aceptar propuesta →",
      en: "✅ Accept proposal →",
      pt: "✅ Aceitar proposta →",
    };

    await resend.emails.send({
      from: `${repName} — FastForward <info@fastfwdus.com>`,
      replyTo: repEmail,
      to: appt.clientEmail,
      subject: subjects[lang],
      html: `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  <div style="background:#27295C;border-radius:16px 16px 0 0;padding:28px;text-align:center;">
    <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="32" alt="FastForward">
  </div>
  <div style="background:white;border-radius:0 0 16px 16px;padding:32px;border:1px solid #E5E7EB;border-top:none;">
    <p style="font-size:18px;font-weight:700;color:#27295C;margin:0 0 12px;">Hola, ${firstName} 👋</p>
    <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 20px;">${aiText}</p>
    <div style="background:#F8F9FB;border-radius:12px;padding:16px;margin-bottom:20px;border:1px solid #E5E7EB;">
      <p style="font-size:12px;color:#9CA3AF;margin:0 0 4px;text-transform:uppercase;">Propuesta</p>
      <p style="font-size:15px;font-weight:700;color:#27295C;margin:0 0 8px;">${proposal.proposalNum}</p>
      <p style="font-size:12px;color:#9CA3AF;margin:0 0 4px;text-transform:uppercase;">Total</p>
      <p style="font-size:20px;font-weight:700;color:#C9A84C;margin:0;">USD $${proposal.total.toLocaleString("en-US")}</p>
    </div>
    <a href="${confirmUrl}" style="display:block;text-align:center;background:#22C55E;color:white;padding:16px;border-radius:12px;font-weight:700;text-decoration:none;font-size:15px;margin-bottom:16px;">
      ${btnLabels[lang]}
    </a>
    <div style="border-top:1px solid #F0F0F0;padding-top:20px;margin-top:8px;text-align:center;">
      <p style="font-size:12px;color:#9CA3AF;margin:0;">FastForward Trading Company LLC · Miami, FL · info@fastfwdus.com</p>
    </div>
  </div>
</div>`,
    }).catch(console.error);

    sent++;
  }

  return NextResponse.json({ ok: true, sent, checked: pending.length });
}
