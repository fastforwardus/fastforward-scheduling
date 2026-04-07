export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { proposals, appointments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { getZohoBooksInvoice, getZohoBooksInvoicePdf } from "@/lib/zohobooks";

const resend = new Resend(process.env.RESEND_API_KEY);

const TRANSLATIONS = {
  es: {
    subject: (num: string) => `Factura ${num} — FastForward`,
    greeting: (name: string) => `Hola ${name},`,
    intro: "Adjunto encontrará la factura correspondiente al servicio solicitado.",
    payBtn: "Ver y Pagar Factura",
    payNote: "Podés pagar con tarjeta de crédito, débito o ACH a través del enlace seguro.",
    bankTitle: "Transferencia bancaria:",
    bankInfo: "Contactanos a info@fastfwdus.com para recibir los datos bancarios.",
    closing: "Atentamente,",
    team: "El Equipo de FastForward",
  },
  en: {
    subject: (num: string) => `Invoice ${num} — FastForward`,
    greeting: (name: string) => `Hello ${name},`,
    intro: "Please find attached the invoice for the requested service.",
    payBtn: "View & Pay Invoice",
    payNote: "You can pay securely by credit card, debit, or ACH through the link below.",
    bankTitle: "Bank transfer:",
    bankInfo: "Contact us at info@fastfwdus.com for wire transfer details.",
    closing: "Best regards,",
    team: "The FastForward Team",
  },
};

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { proposalId } = await req.json();
    if (!proposalId) return NextResponse.json({ error: "proposalId requerido" }, { status: 400 });

    // Obtener propuesta
    const [proposal] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
    if (!proposal) return NextResponse.json({ error: "Propuesta no encontrada" }, { status: 404 });
    if (!proposal.zohoInvoiceId) return NextResponse.json({ error: "Sin invoice de Zoho Books" }, { status: 400 });

    // Obtener cita para datos del cliente
    const [appt] = await db
      .select({ clientName: appointments.clientName, clientEmail: appointments.clientEmail })
      .from(appointments)
      .where(eq(appointments.id, proposal.appointmentId))
      .limit(1);
    if (!appt) return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });

    const L = TRANSLATIONS[(proposal.lang as "es" | "en") ?? "es"];

    // Obtener detalles del invoice en Zoho Books
    const inv = await getZohoBooksInvoice(proposal.zohoInvoiceId);
    const paymentLink = inv?.invoice_url ?? proposal.zohoPaymentLink ?? "";
    const total = inv?.total ?? proposal.total;
    const balance = inv?.balance ?? total;

    // Descargar PDF de Zoho Books
    let pdfBuffer: Buffer | null = null;
    try {
      pdfBuffer = await getZohoBooksInvoicePdf(proposal.zohoInvoiceId);
    } catch (err) {
      console.error("Zoho Books PDF error:", err);
    }

    // Email HTML
    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- HEADER -->
        <tr>
          <td style="background:#0f172a;padding:32px 40px;text-align:center;">
            <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png"
                 alt="FastForward" height="40" style="display:block;margin:0 auto;">
          </td>
        </tr>
        <!-- AMOUNT HERO -->
        <tr>
          <td style="background:#1e293b;padding:28px 40px;text-align:center;">
            <p style="margin:0 0 4px;color:#94a3b8;font-size:13px;letter-spacing:1px;text-transform:uppercase;">Balance Due</p>
            <p style="margin:0;color:#ffffff;font-size:42px;font-weight:700;">$${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
            <p style="margin:8px 0 0;color:#64748b;font-size:13px;">${proposal.proposalNum}</p>
          </td>
        </tr>
        <!-- BODY -->
        <tr>
          <td style="padding:40px 40px 24px;">
            <p style="margin:0 0 16px;color:#1e293b;font-size:16px;font-weight:600;">${L.greeting(appt.clientName)}</p>
            <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">${L.intro}</p>
            <!-- PAYMENT BUTTON -->
            ${paymentLink ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td align="center">
                <a href="${paymentLink}"
                   style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;
                          padding:16px 40px;border-radius:8px;font-size:16px;font-weight:700;letter-spacing:0.3px;">
                  ${L.payBtn} →
                </a>
              </td></tr>
            </table>
            <p style="margin:0 0 24px;color:#64748b;font-size:14px;text-align:center;">${L.payNote}</p>
            ` : ""}
            <!-- DIVIDER -->
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
            <!-- BANK TRANSFER -->
            <p style="margin:0 0 8px;color:#1e293b;font-size:14px;font-weight:600;">${L.bankTitle}</p>
            <p style="margin:0 0 24px;color:#475569;font-size:14px;">${L.bankInfo}</p>
            <!-- CLOSING -->
            <p style="margin:0;color:#475569;font-size:14px;">${L.closing}<br>
            <strong style="color:#1e293b;">${L.team}</strong></p>
          </td>
        </tr>
        <!-- FOOTER -->
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">
              FastForward Trading Company LLC · 33 SW 2nd Ave Ste 1202, Miami FL 33130<br>
              <a href="mailto:info@fastfwdus.com" style="color:#94a3b8;">info@fastfwdus.com</a> ·
              <a href="https://fastfwdus.com" style="color:#94a3b8;">fastfwdus.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // Enviar con Resend
    await resend.emails.send({
      from: "FastForward <info@fastfwdus.com>",
      to: appt.clientEmail,
      replyTo: "info@fastfwdus.com",
      subject: L.subject(proposal.proposalNum),
      html,
      ...(pdfBuffer
        ? {
            attachments: [{
              filename: `Factura-FastForward-${proposal.proposalNum}.pdf`,
              content: pdfBuffer.toString("base64"),
            }],
          }
        : {}),
    });

    // Marcar como enviado
    await db
      .update(proposals)
      .set({ invoiceSentAt: new Date() })
      .where(eq(proposals.id, proposalId));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Invoice send error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
