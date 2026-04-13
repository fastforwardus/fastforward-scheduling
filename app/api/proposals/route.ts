export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, users, proposals } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { getSession } from "@/lib/session";
import { Resend } from "resend";
import { generateProposalPDF, ProposalData } from "@/lib/proposal-pdf";
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
  try {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    appointmentId,
    services,
    discount = 0,
    introText,
    emailText,
    lang = "es",
    clientEmail: clientEmailOverride,
    clientAddress,
    // Direct client fields (for proposals without appointment)
    directClientName,
    directClientCompany,
    directClientEmail,
  } = await req.json();

  if (!services?.length) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }
  if (!appointmentId && (!directClientName || !directClientEmail)) {
    return NextResponse.json({ error: "Faltan datos del cliente" }, { status: 400 });
  }

  // Get appointment + rep
  let appt: { clientName: string; clientEmail: string; clientCompany: string; clientWhatsapp: string; id: string; assignedTo: string | null; serviceInterest: string | null; scheduledAt?: Date } | null = null;
  if (appointmentId) {
    const [a] = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
    if (!a) return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    appt = a;
  } else {
    appt = {
      id: "direct",
      clientName: directClientName,
      clientEmail: directClientEmail,
      clientCompany: directClientCompany || directClientName,
      clientWhatsapp: "",
      assignedTo: session.id,
      serviceInterest: null,
      scheduledAt: new Date(),
    };
  }

  const [rep] = await db.select({
    id: users.id, fullName: users.fullName, email: users.email, slug: users.slug,
  }).from(users).where(eq(users.id, session.id)).limit(1);

  const now = new Date();
  const validUntil = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
  const proposalNum = generateProposalNumber();

  const nameParts = appt!.clientName.split(" ");
  const firstName = nameParts[0];

  const proposalData: ProposalData = {
    clientName: appt!.clientCompany || appt.clientName,
    contactName: appt!.clientName,
    contactEmail: appt!.clientEmail,
    contactPhone: appt!.clientWhatsapp || "",
    contactAddress: clientAddress || undefined,
    repName: rep.fullName,
    repEmail: rep.email,
    repSlug: rep.slug || "book",
    proposalNum,
    dateStr: formatDate(now),
    validUntil: formatDate(validUntil),
    lang: lang as "es" | "en" | "pt",
    introText: introText || (
      lang === "en"
        ? `Dear ${firstName}, it is our pleasure to present this proposal to support your entry into the United States market. Our team has prepared a customized solution based on your company's requirements.`
        : lang === "pt"
        ? `Prezado/a ${firstName}, é um prazer apresentar esta proposta para acompanhá-lo no processo de entrada no mercado norte-americano. Nossa equipe preparou uma solução personalizada com base nos requisitos de sua empresa.`
        : `Estimado/a ${firstName}, es un placer presentarle esta propuesta para acompañarle en el proceso de ingreso al mercado estadounidense. Nuestro equipo ha preparado una solución personalizada basada en los requerimientos de su empresa.`
    ),
    services,
    discount,
    emailText,
  };

  // Calculate total
  const total = services.reduce((s: number, svc: { price: number }) => s + svc.price, 0) - discount;

  // Generate confirm token
  const confirmToken = randomBytes(32).toString("hex");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";

  // Save proposal to DB
  await db.insert(proposals).values({
    appointmentId: appointmentId || "direct-" + randomBytes(8).toString("hex"),
    proposalNum,
    total,
    confirmToken,
    services: JSON.stringify(services),
    discount,
    lang: lang as string,
    status: "pending",
    clientAddress: clientAddress || null,
    clientEmail: appt?.clientEmail || null,
    clientName: appt?.clientName || null,
  });

  // Generate PDF
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateProposalPDF(proposalData);
  } catch (pdfErr) {
    console.error("PDF generation error:", pdfErr);
    return NextResponse.json({ error: "PDF generation failed", detail: String(pdfErr) }, { status: 500 });
  }
  const pdfBase64 = pdfBuffer.toString("base64");


  // Send email to client
  const L = {
    greeting:   lang === "en" ? `Hello, ${firstName}` : lang === "pt" ? `Olá, ${firstName}` : `Estimado/a ${firstName}`,
    body:       lang === "en"
      ? `Please find attached the commercial proposal we have prepared for ${appt.clientCompany || "your company"}. It includes all agreed services with a total of <strong>USD $${total.toLocaleString("en-US")}</strong>.<br><br>This proposal is valid for 15 days. To confirm it and begin the process, simply click the button below.`
      : lang === "pt"
      ? `Em anexo, encontrará a proposta comercial personalizada que preparamos para ${appt.clientCompany || "sua empresa"}. Ela inclui todos os serviços acordados com um total de <strong>USD $${total.toLocaleString("en-US")}</strong>.<br><br>A proposta é válida por 15 dias. Para confirmá-la e iniciar os trâmites, clique no botão abaixo.`
      : `Adjunto encontrará la propuesta comercial personalizada que preparamos para ${appt.clientCompany || "su empresa"}. Incluye todos los servicios acordados con un total de <strong>USD $${total.toLocaleString("en-US")}</strong>.<br><br>La propuesta tiene una vigencia de 15 días. Para confirmarla e iniciar los trámites, haga clic en el botón a continuación.`,
    cta:        lang === "en" ? "Accept proposal" : lang === "pt" ? "Aceitar proposta" : "Aceptar propuesta",
    ctaNote:    lang === "en" ? "By clicking you confirm the services and total indicated in the attached PDF." : lang === "pt" ? "Ao clicar, você confirma os serviços e o total indicados no PDF em anexo." : "Al hacer clic confirma los servicios y el total indicado en el PDF adjunto.",
    totalLabel: lang === "en" ? "Proposal total" : lang === "pt" ? "Total da proposta" : "Total de la propuesta",
    validLabel: lang === "en" ? `Proposal ${proposalNum} · Valid until ${formatDate(validUntil)}` : lang === "pt" ? `Proposta ${proposalNum} · Válida até ${formatDate(validUntil)}` : `Propuesta ${proposalNum} · Vigente hasta ${formatDate(validUntil)}`,
    contact:    lang === "en" ? "For any questions, do not hesitate to contact us." : lang === "pt" ? "Para qualquer dúvida, não hesite em nos contactar." : "Para cualquier consulta, no dude en contactarnos.",
  };

  const emailHtml = `
<div style="font-family:system-ui,sans-serif;max-width:580px;margin:0 auto;padding:24px;">
  <div style="background:#27295C;border-radius:16px 16px 0 0;padding:28px;text-align:center;">
    <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="34" alt="FastForward">
  </div>
  <div style="background:white;border-radius:0 0 16px 16px;padding:32px;border:1px solid #E5E7EB;border-top:none;">
    <p style="font-size:18px;font-weight:700;color:#27295C;margin:0 0 8px;">${L.greeting}</p>
    <div style="font-size:14px;color:#374151;line-height:1.6;margin-bottom:24px;">
      ${emailText || L.body}
    </div>
    <a href="${appUrl}/proposal/confirm/${confirmToken}"
       style="display:block;text-align:center;background:#22C55E;color:white;padding:16px;border-radius:12px;font-weight:700;text-decoration:none;font-size:16px;margin-bottom:16px;">
      ✅ ${L.cta} →
    </a>
    <p style="text-align:center;font-size:11px;color:#9CA3AF;margin:-8px 0 20px;">${L.ctaNote}</p>
    <div style="background:#F8F9FB;border-radius:12px;padding:16px;margin-bottom:24px;border:1px solid #E5E7EB;">
      <p style="font-size:12px;color:#9CA3AF;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.05em;">${L.totalLabel}</p>
      <p style="font-size:24px;font-weight:700;color:#C9A84C;margin:0;">USD $${total.toLocaleString("en-US")}</p>
      <p style="font-size:12px;color:#6B7280;margin:4px 0 0;">${L.validLabel}</p>
    </div>
    <p style="font-size:13px;color:#6B7280;margin:0 0 4px;">${L.contact}</p>
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
    to: clientEmailOverride || appt.clientEmail,
    cc: rep.email !== "info@fastfwdus.com" ? [rep.email] : undefined,
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

  // Update appointment outcome to proposal_sent (only if real appointment)
  if (appointmentId && appointmentId !== "direct") {
    await db.update(appointments)
      .set({ outcome: "proposal_sent", nextStep: "send_proposal" })
      .where(eq(appointments.id, appointmentId));
  }

  // Sync to Zoho CRM with note (only for appointment-based proposals)
  if (appointmentId) createOrUpdateZohoLead({
    clientName: appt.clientName,
    clientEmail: appt.clientEmail,
    clientCompany: appt.clientCompany,
    clientWhatsapp: appt.clientWhatsapp,
    serviceInterest: appt.serviceInterest || undefined,
    outcome: "proposal_sent",
    repName: rep.fullName,
    repEmail: rep.email,
    appointmentId: appt.id,
    scheduledAt: appt.scheduledAt ? String(appt.scheduledAt) : new Date().toISOString(),
    noteToAdd: `[${new Date().toLocaleString("es-ES", { timeZone: "America/New_York" })}] Propuesta ${proposalNum} enviada — Total: USD $${total.toLocaleString("en-US")}`,
    clientNotes: `Propuesta ${proposalNum} enviada. Idioma: ${lang === 'en' ? 'English' : lang === 'pt' ? 'Portugu\u00eas' : 'Espa\u00f1ol'}. Total: USD $${total.toLocaleString("en-US")}. Servicios: ${services.map((s: { name: string }) => s.name).join(", ")}`,
  }).catch(console.error);



  return NextResponse.json({ ok: true, proposalNum, total, confirmUrl: `${appUrl}/proposal/confirm/${confirmToken}` });
  } catch (err) {
    console.error("PROPOSALS ERROR:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
