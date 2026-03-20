import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { wizardSessions } from "@/db/schema";
import { and, eq, lte, gte } from "drizzle-orm";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const SERVICE_LABELS: Record<string, string> = {
  fda_fsma:         "FDA / FSMA compliance",
  register_company: "apertura de empresa LLC en EE.UU.",
  market_entry:     "ingreso al mercado americano",
  not_sure:         "asesoria general",
};

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // Buscar sesiones abandonadas entre 1 y 24 horas atras, no completadas, no recuperadas
  const oneHourAgo      = new Date(now.getTime() - 1 * 60 * 60 * 1000);
  const twentyFourAgo   = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const abandoned = await db.select().from(wizardSessions)
    .where(
      and(
        eq(wizardSessions.completed, false),
        eq(wizardSessions.recovered, false),
        lte(wizardSessions.updatedAt, oneHourAgo),
        gte(wizardSessions.updatedAt, twentyFourAgo),
      )
    );

  let sent = 0;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";

  for (const session of abandoned) {
    const serviceLabel = SERVICE_LABELS[session.serviceInterest || ""] || "nuestros servicios";
    const bookUrl = session.partnerSlug
      ? `${appUrl}/book/partner/${session.partnerSlug}`
      : `${appUrl}/book`;

    const firstName = session.name?.split(" ")[0] || "Hola";

    try {
      await resend.emails.send({
        from: "Carlos Bisio — FastForward <info@fastfwdus.com>",
        replyTo: "info@fastfwdus.com",
        to: session.email,
        subject: `${firstName}, quedaste a un paso de tu consulta gratuita`,
        html: `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  <div style="background:#27295C;border-radius:16px 16px 0 0;padding:28px;text-align:center;">
    <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="32" alt="FastForward">
  </div>
  <div style="background:white;border-radius:0 0 16px 16px;padding:32px;border:1px solid #E5E7EB;border-top:none;">
    <p style="font-size:20px;font-weight:700;color:#27295C;margin:0 0 8px;">Hola, ${firstName} 👋</p>
    <p style="color:#6B7280;font-size:14px;margin:0 0 20px;">
      Vimos que empezaste a agendar una consulta sobre <strong style="color:#27295C;">${serviceLabel}</strong> pero no la completaste.
    </p>
    <p style="color:#6B7280;font-size:14px;margin:0 0 24px;">
      La consulta es <strong style="color:#27295C;">gratuita y sin compromiso</strong>. Solo toma 30 minutos y podes hacerla por Google Meet, Zoom o WhatsApp.
    </p>

    <div style="background:#F8F9FB;border-radius:12px;padding:16px;margin-bottom:24px;border:1px solid #E5E7EB;">
      <p style="font-size:13px;color:#374151;margin:0 0 8px;">✅ Expertos certificados en regulaciones FDA</p>
      <p style="font-size:13px;color:#374151;margin:0 0 8px;">✅ +500 empresas latinoamericanas asesoradas</p>
      <p style="font-size:13px;color:#374151;margin:0;">✅ Resultados concretos y tiempos claros</p>
    </div>

    <a href="${bookUrl}"
       style="display:block;text-align:center;background:#C9A84C;color:#1A1C3E;padding:16px;border-radius:12px;font-weight:700;text-decoration:none;font-size:15px;margin-bottom:16px;">
      Completar mi consulta gratuita →
    </a>

    <p style="text-align:center;font-size:12px;color:#9CA3AF;margin:0;">
      Si ya no te interesa, simplemente ignora este email.
    </p>

    <div style="border-top:1px solid #F0F0F0;padding-top:20px;margin-top:24px;text-align:center;">
      <p style="font-size:12px;color:#9CA3AF;margin:0 0 4px;">Carlos Bisio · FastForward FDA Experts</p>
      <p style="font-size:12px;color:#9CA3AF;margin:0;">
        <a href="https://fastfwdus.com" style="color:#C9A84C;">fastfwdus.com</a> · Miami, FL
      </p>
    </div>
  </div>
</div>`,
      });

      await db.update(wizardSessions)
        .set({ recovered: true })
        .where(eq(wizardSessions.id, session.id));

      sent++;
    } catch (err) {
      console.error("Error sending recovery email:", err);
    }
  }

  return NextResponse.json({ ok: true, sent, checked: abandoned.length });
}
