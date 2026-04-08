export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { proposals } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("Zoho webhook:", JSON.stringify(body));

    // Zoho Books envía el invoice_number o reference_number
    // Zoho Books customer payment webhook
    const payment = body.customer_payment;
    if (!payment) return NextResponse.json({ ok: true });

    const invoiceIds: string[] = payment.invoices?.map((inv: Record<string,unknown>) => inv.invoice_id as string).filter(Boolean) || [];
    if (invoiceIds.length === 0) return NextResponse.json({ ok: true });

    console.log("Payment received for invoices:", invoiceIds);

    // Buscar propuesta por zoho_invoice_id
    let proposal = null;
    for (const invoiceId of invoiceIds) {
      const [found] = await db.select().from(proposals).where(eq(proposals.zohoInvoiceId, invoiceId)).limit(1);
      if (found) { proposal = found; break; }
    }

    if (!proposal) {
      console.log("Propuesta no encontrada para invoices:", invoiceIds);
      return NextResponse.json({ ok: true });
    }

    // Obtener email del cliente
    let clientName = (proposal as Record<string,unknown>).clientName as string || "";
    let clientEmail = (proposal as Record<string,unknown>).clientEmail as string || "";

    if (!clientEmail && proposal.appointmentId && !proposal.appointmentId.startsWith("direct-")) {
      const rows = await db.execute(
        sql`SELECT client_name, client_email FROM appointments WHERE id::text = ${proposal.appointmentId} LIMIT 1`
      ) as unknown as { rows: { client_name: string; client_email: string }[] };
      clientName = rows.rows?.[0]?.client_name || clientName;
      clientEmail = rows.rows?.[0]?.client_email || clientEmail;
    }

    if (!clientEmail) return NextResponse.json({ ok: true });

    const lang = (proposal.lang || "es") as "es" | "en" | "pt";
    const fmt = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2 });

    const L = lang === "en"
      ? { subject: `Payment confirmed — ${proposal.proposalNum}`, greeting: `Hello ${clientName},`, msg: "We have received your payment successfully. Thank you for trusting FastForward.", detail: "Payment confirmed", team: "The FastForward Team" }
      : lang === "pt"
      ? { subject: `Pagamento confirmado — ${proposal.proposalNum}`, greeting: `Olá ${clientName},`, msg: "Recebemos seu pagamento com sucesso. Obrigado por confiar na FastForward.", detail: "Pagamento confirmado", team: "A Equipe FastForward" }
      : { subject: `Pago confirmado — ${proposal.proposalNum}`, greeting: `Hola ${clientName},`, msg: "Recibimos tu pago correctamente. Gracias por confiar en FastForward. Nuestro equipo se pondrá en contacto contigo pronto para coordinar los próximos pasos.", detail: "Pago confirmado", team: "El Equipo de FastForward" };

    const services = (typeof proposal.services === "string" ? JSON.parse(proposal.services || "[]") : proposal.services) as { name: string; price: number }[];

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'Helvetica Neue',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
<tr><td style="background:#111827;padding:24px 32px;">
<img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" alt="FastForward" height="32">
</td></tr>
<tr><td style="background:#064e3b;padding:28px 32px;text-align:center;">
<p style="margin:0 0 8px;font-size:32px;">✅</p>
<p style="margin:0;color:#fff;font-size:22px;font-weight:700;">${L.detail}</p>
<p style="margin:8px 0 0;color:#6ee7b7;font-size:14px;">${proposal.proposalNum} · ${fmt(proposal.total)}</p>
</td></tr>
<tr><td style="padding:32px;">
<p style="margin:0 0 16px;color:#111827;font-size:15px;font-weight:600;">${L.greeting}</p>
<p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.7;">${L.msg}</p>
<table width="100%" style="margin-bottom:24px;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;">
${services.map(s => `<tr><td style="padding:10px 16px;color:#374151;font-size:14px;border-bottom:1px solid #f3f4f6;">${s.name}</td><td style="padding:10px 16px;color:#111827;font-size:14px;font-weight:500;text-align:right;border-bottom:1px solid #f3f4f6;">${fmt(s.price)}</td></tr>`).join("")}
<tr><td style="padding:10px 16px;color:#111827;font-size:14px;font-weight:700;">Total</td><td style="padding:10px 16px;color:#059669;font-size:14px;font-weight:700;text-align:right;">${fmt(proposal.total)}</td></tr>
</table>
<p style="margin:0;color:#6b7280;font-size:14px;">${L.team}</p>
</td></tr>
<tr><td style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
<p style="margin:0;color:#9ca3af;font-size:11px;">FastForward Trading Company LLC · 33 SW 2nd Ave Ste 1202, Miami FL 33130</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;

    await resend.emails.send({
      from: "FastForward <info@fastfwdus.com>",
      to: clientEmail,
      replyTo: "info@fastfwdus.com",
      subject: L.subject,
      html,
    });

    // También notificar a Carlos
    await resend.emails.send({
      from: "FastForward <info@fastfwdus.com>",
      to: "info@fastfwdus.com",
      subject: `💰 Pago recibido — ${proposal.proposalNum} — ${fmt(proposal.total)}`,
      html: `<p>Pago recibido de <strong>${clientName}</strong> (${clientEmail})<br>Propuesta: ${proposal.proposalNum}<br>Total: ${fmt(proposal.total)}</p>`,
    });

    console.log("Email de confirmación enviado a:", clientEmail);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Zoho webhook error:", err);
    return NextResponse.json({ ok: true }); // siempre 200 para Zoho
  }
}
