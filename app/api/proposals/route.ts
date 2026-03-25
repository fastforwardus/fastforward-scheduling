export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, users, proposals } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { getSession } from "@/lib/session";
import { Resend } from "resend";
import { generateProposalPDF, ProposalData } from "@/lib/proposal-pdf";
import { randomUUID } from "crypto";
import { createOrUpdateZohoLead } from "@/lib/zoho";

const resend = new Resend(process.env.RESEND_API_KEY);

function generateProposalNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `FF-${year}-${rand}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/New_York" });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    appointmentId,
    services,
    discount = 0,
    introText,
    emailText,
    lang = "es",
  } = await req.json();

  if (!appointmentId || !services?.length) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }

  // Get appointment + rep
  const [appt] = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
  if (!appt) return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });

  const [rep] = await db.select({
    id: users.id, fullName: users.fullName, email: users.email, slug: users.slug,
  }).from(users).where(eq(users.id, session.id)).limit(1);

  const now = new Date();
  const validUntil = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
  const proposalNum = generateProposalNumber();

  const nameParts = appt.clientName.split(" ");
  const firstName = nameParts[0];

  const proposalData: ProposalData = {
    clientName: appt.clientCompany || appt.clientName,
    contactName: appt.clientName,
    contactEmail: appt.clientEmail,
    contactPhone: appt.clientWhatsapp || "",
    repName: rep.fullName,
    repEmail: rep.email,
    repSlug: rep.slug || "book",
    proposalNum,
    dateStr: formatDate(now),
    validUntil: formatDate(validUntil),
    lang: lang as "es" | "en" | "pt",
    introText: introText || `Estimado/a ${firstName}, es un placer presentarle esta propuesta para acompanarle en el proceso de ingreso al mercado estadounidense. Nuestro equipo ha preparado una solucion personalizada basada en los requerimientos de su empresa.`,
    services,
    discount,
    emailText,
  };

  // Calculate total
  const total = services.reduce((s: number, svc: { price: number }) => s + svc.price, 0) - discount;

  // Generate confirm token
  const confirmToken = randomBytes(32).toString("hex");

  // Save proposal to DB
  await db.insert(proposals).values({
    appointmentId,
    clientName: appt.clientName,
    clientEmail: appt.clientEmail,
    repName: rep.fullName,
    proposalNum,
    total,
    signToken: confirmToken,
    confirmToken,
    services: JSON.stringify(services),
    discount,
    lang: lang as string,
    status: "pending",
  });

  // Generate PDF
  const pdfBuffer = await generateProposalPDF(proposalData);
  const pdfBase64 = pdfBuffer.toString("base64");


  // Send email to client
  const emailHtml = `
<div style="font-family:system-ui,sans-serif;max-width:580px;margin:0 auto;padding:24px;">
  <div style="background:#27295C;border-radius:16px 16px 0 0;padding:28px;text-align:center;">
    <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="34" alt="FastForward">
  </div>
  <div style="background:white;border-radius:0 0 16px 16px;padding:32px;border:1px solid #E5E7EB;border-top:none;">
    <p style="font-size:18px;font-weight:700;color:#27295C;margin:0 0 8px;">Hola, ${firstName}</p>
    <div style="font-size:14px;color:#374151;line-height:1.6;margin-bottom:24px;">
      ${emailText || `Adjunto encontrara la propuesta comercial personalizada que preparamos para ${appt.clientCompany || "su empresa"}. La misma incluye todos los servicios acordados con un total de <strong>USD $${total.toLocaleString("en-US")}</strong>.<br><br>La propuesta es valida por 15 dias. Para confirmarla y dar inicio a los tramites, simplemente responda este email.`}
    </div>
    <div style="background:#F8F9FB;border-radius:12px;padding:16px;margin-bottom:24px;border:1px solid #E5E7EB;">
      <p style="font-size:12px;color:#9CA3AF;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.05em;">Total de la propuesta</p>
      <p style="font-size:24px;font-weight:700;color:#C9A84C;margin:0;">USD $${total.toLocaleString("en-US")}</p>
      <p style="font-size:12px;color:#6B7280;margin:4px 0 0;">Propuesta ${proposalNum} · Valida hasta ${formatDate(validUntil)}</p>
    </div>
    <p style="font-size:13px;color:#6B7280;margin:0 0 4px;">Ante cualquier consulta no dude en contactarnos.</p>
    <p style="font-size:13px;font-weight:600;color:#27295C;margin:0;">${rep.fullName} · FastForward FDA Experts</p>
    <div style="border-top:1px solid #F0F0F0;padding-top:20px;margin-top:24px;text-align:center;">
      <p style="font-size:12px;color:#9CA3AF;margin:0;">FastForward Trading Company LLC · Miami, FL</p>
      <a href="https://fastfwdus.com" style="font-size:12px;color:#C9A84C;">fastfwdus.com</a>
    </div>
  </div>
</div>`;

  await resend.emails.send({
    from: `${rep.fullName} — FastForward <info@fastfwdus.com>`,
    replyTo: rep.email,
    to: appt.clientEmail,
    subject: lang === "en"
      ? `Commercial proposal for ${appt.clientCompany || appt.clientName} — FastForward`
      : lang === "pt"
      ? `Proposta comercial para ${appt.clientCompany || appt.clientName} — FastForward`
      : `Propuesta comercial para ${appt.clientCompany || appt.clientName} — FastForward`,
    html: emailHtml,
    attachments: [{
      filename: `Propuesta-FastForward-${proposalNum}.pdf`,
      content: pdfBase64,
    }],
  });

  // Update appointment outcome to proposal_sent
  await db.update(appointments)
    .set({ outcome: "proposal_sent", nextStep: "send_proposal" })
    .where(eq(appointments.id, appointmentId));

  // Sync to Zoho CRM with note
  createOrUpdateZohoLead({
    clientName: appt.clientName,
    clientEmail: appt.clientEmail,
    clientCompany: appt.clientCompany,
    clientWhatsapp: appt.clientWhatsapp,
    serviceInterest: appt.serviceInterest || undefined,
    outcome: "proposal_sent",
    repName: rep.fullName,
    appointmentId: appt.id,
    scheduledAt: String(appt.scheduledAt),
    clientNotes: `Propuesta ${proposalNum} enviada. Idioma: ${lang === 'en' ? 'English' : lang === 'pt' ? 'Portugu\u00eas' : 'Espa\u00f1ol'}. Total: USD $${total.toLocaleString("en-US")}. Servicios: ${services.map((s: { name: string }) => s.name).join(", ")}`,
  }).catch(console.error);

  // Save proposal to DB for signing
  const signToken = randomUUID();
  await db.insert(proposals).values({
    appointmentId,
    clientName: appt.clientName,
    clientEmail: appt.clientEmail,
    repName: rep.fullName,
    proposalNum,
    total,
    signToken,
    lang: lang as string,
    pdfBase64,
  }).catch(console.error);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";
  const signUrl = `${appUrl}/sign/${signToken}`;

  // Resend email with sign link
  await resend.emails.send({
    from: `${rep.fullName} — FastForward <info@fastfwdus.com>`,
    replyTo: rep.email,
    to: appt.clientEmail,
    subject: lang === "en"
      ? `Commercial proposal for ${appt.clientCompany || appt.clientName} — FastForward`
      : lang === "pt"
      ? `Proposta comercial para ${appt.clientCompany || appt.clientName} — FastForward`
      : `Propuesta comercial para ${appt.clientCompany || appt.clientName} — FastForward`,
    html: emailHtml,
  });

  return NextResponse.json({ ok: true, proposalNum, total, signUrl });
}
