export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { proposals, appointments, users, proposalEvents } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { Resend } from "resend";
import { findOrCreateZohoBooksContact, createZohoBooksInvoice, markZohoBooksInvoiceSent, getZohoBooksInvoicePdf } from "@/lib/zohobooks";
import { createOrUpdateZohoLead, crearTareaZoho } from "@/lib/zoho";

const resend = new Resend(process.env.RESEND_API_KEY);


export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "Token requerido" }, { status: 400 });

  const [proposal] = await db.select().from(proposals)
    .where(eq(proposals.confirmToken, token as string)).limit(1);

  if (!proposal) return NextResponse.json({ error: "Propuesta no encontrada" }, { status: 404 });
  if ((proposal as { status?: string | null }).status === "accepted") return NextResponse.json({ ok: true, alreadyAccepted: true });

  const [appt] = await db.select({
    clientName: appointments.clientName,
    clientCompany: appointments.clientCompany,
    clientEmail: appointments.clientEmail,
    clientWhatsapp: appointments.clientWhatsapp,
    assignedTo: appointments.assignedTo,
  }).from(appointments).where(sql`${appointments.id}::text = ${proposal.appointmentId}`).limit(1);

  // Para propuestas directas sin cita, appt puede ser null
  const clientName: string = appt?.clientName ?? (proposal as Record<string, unknown>).clientName as string ?? "";
  const clientEmail: string = appt?.clientEmail ?? (proposal as Record<string, unknown>).clientEmail as string ?? "";
  const clientCompany: string = appt?.clientCompany ?? "";
  const clientWhatsapp: string = appt?.clientWhatsapp ?? "";
  const assignedTo: string = appt?.assignedTo ?? "";

  const services = (typeof proposal.services === "string" ? JSON.parse(proposal.services || "[]") : proposal.services) as { name: string; price: number }[];

  // ── Zoho Books: crear contacto + factura ──────────────────────────
  let errorFactura: string | null = null;
  let zohoInvoiceId = "";
  let zohoContactId = "";
  let zohoPaymentLink = "";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";

  try {
    console.log("ZohoBooks contact params — name:", clientName, "| email:", clientEmail || "VACÍO");
    const contact = await findOrCreateZohoBooksContact({
      name: clientName,
      email: clientEmail,
      company: clientCompany || undefined,
      phone: clientWhatsapp || undefined,
      address: (proposal as Record<string,unknown>).clientAddress as string || undefined,
      taxId: (proposal as Record<string,unknown>).clientTaxId as string || undefined,
    });
    zohoContactId = contact.contact_id;

    const invoice = await createZohoBooksInvoice({
      contactId: contact.contact_id,
      invoiceNumber: proposal.proposalNum,
      lineItems: services.map((s) => ({ name: s.name, rate: s.price, quantity: 1 })),
      discount: proposal.discount || 0,
      notes: `Propuesta ${proposal.proposalNum} — FastForward`,
    });

    zohoInvoiceId = invoice.invoice_id;
    zohoPaymentLink = invoice.invoice_url;
    await markZohoBooksInvoiceSent(zohoInvoiceId);
    console.log("Zoho Books invoice creado y marcado sent:", zohoInvoiceId);
  } catch (err) {
    console.error("Zoho Books invoice error:", err);
    // Sin esto la propuesta queda aceptada, sin factura y sin que nadie se
    // entere: el cliente acepto y el cobro nunca se emitio.
    errorFactura = String(err).slice(0, 400);
  }

  // ── Update proposal status ───────────────────────────────────────
  await db.update(proposals).set({
    status: "accepted",
    acceptedAt: new Date(),
    zohoContactId: zohoContactId || null,
    zohoPaymentLink: zohoPaymentLink || null,
    zohoInvoiceId: zohoInvoiceId || null,
    zohoInvoiceMissingAt: zohoInvoiceId ? null : new Date(),
  }).where(eq(proposals.id, proposal.id));

  await db.insert(proposalEvents).values({
    proposalId: proposal.id, kind: "accepted", channel: "web",
    detail: zohoInvoiceId
      ? `Aceptada — invoice ${zohoInvoiceId}`
      : `Aceptada — LA FACTURA NO SE GENERO: ${errorFactura || "motivo desconocido"}`,
  }).catch(() => {});

  // Tarea en Zoho al aceptarse: solo para Emiliano, que la pidio porque
  // trabaja desde Zoho y el email de aviso se le pasa. El resto del equipo no
  // la quiere, asi que va acotada a el.
  try {
    const [duenio] = await db.select({ email: users.email, fullName: users.fullName })
      .from(users).where(eq(users.id, proposal.sentById ?? "")).limit(1);
    // Su casilla es renewals@, no lleva su nombre: el match va por nombre
    if (duenio?.fullName?.toLowerCase().includes("emiliano")) {
      crearTareaZoho({
        asunto: `Propuesta aceptada — ${proposal.clientName ?? "cliente"} · USD ${proposal.total}`,
        descripcion:
          `La propuesta ${proposal.proposalNum} fue aceptada por el cliente.\n` +
          `Total: USD ${proposal.total}\n` +
          `Email: ${proposal.clientEmail ?? "—"}\n` +
          (zohoInvoiceId ? `Factura: ${zohoInvoiceId}` : "ATENCION: la factura no se genero."),
        ownerEmail: duenio.email,
      }).catch(() => {});
    }
  } catch (e) {
    console.error("[accept] no se pudo crear la tarea en Zoho:", e);
  }

  // Recordatorio en Pendientes: un aviso por email se pierde entre otros, y
  // habia USD 6.754 aceptados sin facturar sin que nadie lo viera.
  if (!zohoInvoiceId) {
    db.execute(sql`
      insert into reminders
        (title, notes, due_at, original_due_at, created_by_user_id,
         assigned_to_user_id, lead_email, source_type, source_id, notify_channels)
      select
        ${"Falta facturar — " + (proposal.clientName ?? "cliente") + " · USD " + proposal.total},
        ${"La propuesta " + proposal.proposalNum + " fue aceptada pero Zoho Books no emitió la factura. Generala desde Propuestas con el botón amarillo."},
        now(), now(),
        coalesce(${proposal.sentById ?? null}::uuid, (select id from users where role = 'admin' limit 1)),
        coalesce(${proposal.sentById ?? null}::uuid, (select id from users where role = 'admin' limit 1)),
        ${proposal.clientEmail ?? null},
        'factura_faltante', ${proposal.id}, '{app,email}'
      where not exists (
        select 1 from reminders
        where source_type = 'factura_faltante' and source_id = ${proposal.id}
      )`).catch((e) => console.error("[accept] no se pudo crear el recordatorio:", e));
  }

  // Aviso al equipo: una propuesta aceptada sin factura es plata que se
  // cobra tarde o no se cobra.
  if (!zohoInvoiceId) {
    resend.emails.send({
      from: "FastForward Sistema <info@fastfwdus.com>",
      to: (process.env.AVISO_FACTURA_EMAIL || "info@fastfwdus.com").split(","),
      subject: `Falta la factura — ${proposal.proposalNum} (${proposal.clientName ?? ""})`,
      html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;max-width:520px;">
<p style="margin:0 0 14px;font-size:16px;"><b>El cliente aceptó pero la factura no se generó</b></p>
<div style="border-left:3px solid #DC2626;padding-left:14px;margin-bottom:16px;">
<p style="margin:0 0 4px;"><b>Propuesta:</b> ${proposal.proposalNum}</p>
<p style="margin:0 0 4px;"><b>Cliente:</b> ${proposal.clientName ?? "—"}</p>
<p style="margin:0 0 4px;"><b>Total:</b> USD ${proposal.total}</p>
</div>
<p style="margin:0 0 8px;color:#5b6472;">Error de Zoho Books:</p>
<div style="background:#f6f8fb;border-radius:8px;padding:12px;font-size:12px;white-space:pre-wrap;">${
  (errorFactura || "sin detalle").replace(/</g, "&lt;")
}</div>
<p style="margin:16px 0 0;font-size:13px;color:#5b6472;">Hay que emitirla a mano en Zoho Books y avisarle al cliente.</p>
</div>`,
    }).catch((e) => console.error("[accept] no se pudo avisar del fallo:", e));
  }

  // ── Marcar la cita como ganada ───────────────────────────────────
  // appointment_id es TEXT y puede ser "direct-xxxx" (propuesta sin cita),
  // asi que va con ::text: eq() contra la columna UUID reventaba la ruta
  // entera con invalid input syntax y el cliente nunca recibia el mail
  // de confirmacion. Va antes de Zoho/emails y con try/catch propio.
  try {
    await db.update(appointments).set({
      outcome: "closed",
    }).where(sql`${appointments.id}::text = ${proposal.appointmentId}`);
  } catch (err) {
    console.error("Error marcando cita como ganada:", err);
  }


  // ── Auto-envío email de factura (async, no bloquea) ─────────────
  if (zohoInvoiceId && clientEmail) {
    setTimeout(async () => { try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";
      const payLink = `${appUrl}/pay/${proposal.confirmToken}`;
      const L = proposal.lang === "en"
        ? { subject: `Invoice ${proposal.proposalNum} — FastForward`, greeting: `Hello ${clientName},`, intro: "Please find attached the invoice for the requested service.", payBtn: "View & Pay Invoice", secure: "Secure payment via Stripe · info@fastfwdus.com" }
        : proposal.lang === "pt"
        ? { subject: `Fatura ${proposal.proposalNum} — FastForward`, greeting: `Olá ${clientName},`, intro: "Segue em anexo a fatura referente ao serviço solicitado.", payBtn: "Ver e Pagar Fatura", secure: "Pagamento seguro via Stripe · info@fastfwdus.com" }
        : { subject: `Factura ${proposal.proposalNum} — FastForward`, greeting: `Estimado/a ${clientName},`, intro: "Adjunto encontrará la factura correspondiente al servicio solicitado.", payBtn: "Ver y Pagar Factura", secure: "Pago seguro vía Stripe · info@fastfwdus.com" };

      const services2 = (typeof proposal.services === "string" ? JSON.parse(proposal.services || "[]") : proposal.services) as { name: string; price: number }[];
      const fmt = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2 });

      let pdfBuffer: Buffer | null = null;
      try { pdfBuffer = await getZohoBooksInvoicePdf(zohoInvoiceId); } catch {}

      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'Helvetica Neue',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
<tr><td style="background:#111827;padding:24px 32px;">
<img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" alt="FastForward" height="32">
</td></tr>
<tr><td style="background:#1f2937;padding:28px 32px;text-align:center;">
<p style="margin:0 0 4px;color:#9ca3af;font-size:12px;letter-spacing:1px;text-transform:uppercase;">Balance Due</p>
<p style="margin:0;color:#fff;font-size:40px;font-weight:700;">${fmt(proposal.total)}</p>
<p style="margin:8px 0 0;color:#6b7280;font-size:13px;">${proposal.proposalNum}</p>
</td></tr>
<tr><td style="padding:32px;">
<p style="margin:0 0 16px;color:#111827;font-size:15px;font-weight:600;">${L.greeting}</p>
<p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6;">${L.intro}</p>
<table width="100%" style="margin-bottom:20px;border-collapse:collapse;">
${services2.map(s => `<tr><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#374151;font-size:14px;">${s.name}</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-size:14px;font-weight:500;text-align:right;">${fmt(s.price)}</td></tr>`).join("")}
</table>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
<tr><td align="center">
<a href="${payLink}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;">${L.payBtn} →</a>
</td></tr>
</table>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px;">
<p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">${L.secure}</p>
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
        ...(pdfBuffer ? { attachments: [{ filename: `Factura-FastForward-${proposal.proposalNum}.pdf`, content: pdfBuffer.toString("base64") }] } : {}),
      });

      await db.update(proposals).set({ invoiceSentAt: new Date() }).where(eq(proposals.id, proposal.id));
      console.log("Email de factura enviado a:", clientEmail);
    } catch (err) {
      console.error("Error auto-enviando email de factura:", err);
    } }, 100);
  }

  // ── Zoho note on acceptance
  try {
    const zohoRes = await createOrUpdateZohoLead({
      clientName: clientName,
      clientEmail: clientEmail,
      clientCompany: clientCompany,
      clientWhatsapp: clientWhatsapp || "",
      outcome: "closed",
      noteToAdd: `[${new Date().toLocaleString("es-ES", { timeZone: "America/New_York" })}] Propuesta aceptada — Invoice Zoho Books: ${zohoInvoiceId || "pendiente"} — Total: USD $${proposal.total.toLocaleString("en-US")}`,
    });
    console.log("Zoho updated on acceptance:", zohoRes);
  } catch (err) { console.error("Zoho accept error:", err); }

  const lang = (proposal.lang || "es") as "es" | "en" | "pt";

  const confirmMessages = {
    es: { subject: "Propuesta confirmada — FastForward", body: `Estimado/a ${clientName.split(" ")[0]},

Hemos recibido su confirmación. Su factura ha sido generada y llegará por correo electrónico en los próximos minutos.

Nuestro equipo se pondrá en contacto para coordinar los próximos pasos.

Gracias por confiar en FastForward.` },
    en: { subject: "Proposal confirmed — FastForward", body: `Hi ${clientName.split(" ")[0]},

We have received your confirmation. Your invoice has been generated and will arrive by email shortly.

Our team will contact you to coordinate next steps.

Thank you for trusting FastForward.` },
    pt: { subject: "Proposta confirmada — FastForward", body: `Olá ${clientName.split(" ")[0]},

Recebemos sua confirmação. Sua fatura foi gerada e chegará por email em breve.

Nossa equipe entrará em contato para coordenar os próximos passos.

Obrigado por confiar na FastForward.` },
  };

  const msg = confirmMessages[lang];

  // Email to client
  await resend.emails.send({
    from: "FastForward FDA Experts <info@fastfwdus.com>",
    replyTo: "info@fastfwdus.com",
    to: clientEmail,
    subject: msg.subject,
    html: `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  <div style="background:#27295C;border-radius:16px 16px 0 0;padding:28px;text-align:center;">
    <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="32" alt="FastForward">
  </div>
  <div style="background:white;border-radius:0 0 16px 16px;padding:32px;border:1px solid #E5E7EB;border-top:none;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="width:56px;height:56px;background:#DCFCE7;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;">
        <span style="font-size:28px;">✅</span>
      </div>
      <h1 style="font-size:20px;font-weight:700;color:#27295C;margin:0 0 8px;">${lang === "en" ? "Proposal confirmed!" : lang === "pt" ? "Proposta confirmada!" : "¡Propuesta confirmada!"}</h1>
    </div>
    <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 20px;white-space:pre-line;">${msg.body}</p>
    <div style="background:#F8F9FB;border-radius:10px;padding:14px;border:1px solid #E5E7EB;">
      <p style="font-size:12px;color:#9CA3AF;margin:0 0 4px;">${lang === "en" ? "Proposal" : "Propuesta"}</p>
      <p style="font-size:15px;font-weight:700;color:#27295C;margin:0 0 8px;">${proposal.proposalNum}</p>
      <p style="font-size:12px;color:#9CA3AF;margin:0 0 4px;">Total</p>
      <p style="font-size:20px;font-weight:700;color:#C9A84C;margin:0;">USD $${proposal.total.toLocaleString("en-US")}</p>
    </div>
    <div style="border-top:1px solid #F0F0F0;padding-top:20px;margin-top:24px;text-align:center;">
      <p style="font-size:12px;color:#9CA3AF;">FastForward Trading Company LLC · Miami, FL</p>
    </div>
  </div>
</div>`,
  }).catch(console.error);

  // Get rep info
  let repEmail = "info@fastfwdus.com";
  let repName = "FastForward";
  if (assignedTo) {
    const [rep] = await db.select({ email: users.email, fullName: users.fullName })
      .from(users).where(eq(users.id, assignedTo)).limit(1);
    if (rep) { repEmail = rep.email; repName = rep.fullName; }
  }

  // Notify Carlos + Rep
  const notifyEmails = ["info@fastfwdus.com"];
  if (repEmail !== "info@fastfwdus.com") notifyEmails.push(repEmail);

  await resend.emails.send({
    from: "FastForward Sistema <info@fastfwdus.com>",
    to: notifyEmails,
    subject: `🏆 Propuesta aceptada — ${clientName} (${clientCompany})`,
    html: `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  <div style="background:#27295C;border-radius:16px 16px 0 0;padding:28px;text-align:center;">
    <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="32" alt="FastForward">
  </div>
  <div style="background:white;border-radius:0 0 16px 16px;padding:32px;border:1px solid #E5E7EB;border-top:none;">
    <p style="font-size:20px;font-weight:700;color:#27295C;margin:0 0 4px;">🏆 Propuesta aceptada</p>
    <p style="color:#6B7280;font-size:14px;margin:0 0 24px;">${repName} — ${clientName} confirmó la propuesta.</p>
    <div style="background:#F8F9FB;border-radius:12px;padding:16px;border:1px solid #E5E7EB;">
      <p style="font-size:11px;color:#9CA3AF;margin:0 0 2px;text-transform:uppercase;">Cliente</p>
      <p style="font-size:15px;font-weight:700;color:#27295C;margin:0 0 12px;">${clientName} — ${clientCompany}</p>
      <p style="font-size:11px;color:#9CA3AF;margin:0 0 2px;text-transform:uppercase;">Propuesta</p>
      <p style="font-size:14px;font-weight:600;color:#27295C;margin:0 0 12px;">${proposal.proposalNum}</p>
      <p style="font-size:11px;color:#9CA3AF;margin:0 0 2px;text-transform:uppercase;">Total</p>
      <p style="font-size:20px;font-weight:700;color:#C9A84C;margin:0 0 12px;">USD $${proposal.total.toLocaleString("en-US")}</p>
      ${zohoInvoiceId ? `<p style="font-size:11px;color:#9CA3AF;margin:0 0 2px;text-transform:uppercase;">Invoice Zoho Books</p><p style="font-size:13px;font-weight:600;color:#22C55E;margin:0;">✅ Creado — ID: ${zohoInvoiceId}</p>` : ""}
    </div>
    <a href="${appUrl}/dashboard" style="display:block;text-align:center;background:#C9A84C;color:#1A1C3E;padding:14px;border-radius:10px;font-weight:700;text-decoration:none;margin-top:20px;">
      Ver en dashboard →
    </a>
  </div>
</div>`,
  }).catch(console.error);

  return NextResponse.json({ ok: true, zohoInvoiceId });
}
