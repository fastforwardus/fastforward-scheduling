export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, users } from "@/db/schema";
import { eq, and, lte } from "drizzle-orm";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const tenDaysAgo   = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

  // Propuestas enviadas hace más de 7 días sin respuesta
  const staleProposals = await db.select({
    id: appointments.id,
    clientName: appointments.clientName,
    clientCompany: appointments.clientCompany,
    clientEmail: appointments.clientEmail,
    scheduledAt: appointments.scheduledAt,
    repName: users.fullName,
    repEmail: users.email,
  }).from(appointments)
    .leftJoin(users, eq(appointments.assignedTo, users.id))
    .where(
      and(
        eq(appointments.outcome, "proposal_sent"),
        lte(appointments.scheduledAt, sevenDaysAgo)
      )
    );

  // "Necesita tiempo" hace más de 10 días sin reagendar
  const staleNeedsTime = await db.select({
    id: appointments.id,
    clientName: appointments.clientName,
    clientCompany: appointments.clientCompany,
    clientEmail: appointments.clientEmail,
    scheduledAt: appointments.scheduledAt,
    repName: users.fullName,
    repEmail: users.email,
  }).from(appointments)
    .leftJoin(users, eq(appointments.assignedTo, users.id))
    .where(
      and(
        eq(appointments.outcome, "needs_time"),
        lte(appointments.scheduledAt, tenDaysAgo)
      )
    );

  if (staleProposals.length === 0 && staleNeedsTime.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";

  const proposalRows = staleProposals.map(a => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #F0F0F0;font-size:13px;color:#27295C;font-weight:600;">${a.clientName}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #F0F0F0;font-size:13px;color:#374151;">${a.clientCompany}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #F0F0F0;font-size:13px;color:#374151;">${a.repName || "-"}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #F0F0F0;font-size:13px;color:#EF4444;font-weight:600;">${Math.floor((Date.now() - new Date(a.scheduledAt).getTime()) / 86400000)} días</td>
    </tr>`).join("");

  const needsTimeRows = staleNeedsTime.map(a => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #F0F0F0;font-size:13px;color:#27295C;font-weight:600;">${a.clientName}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #F0F0F0;font-size:13px;color:#374151;">${a.clientCompany}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #F0F0F0;font-size:13px;color:#374151;">${a.repName || "-"}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #F0F0F0;font-size:13px;color:#F59E0B;font-weight:600;">${Math.floor((Date.now() - new Date(a.scheduledAt).getTime()) / 86400000)} días</td>
    </tr>`).join("");

  await resend.emails.send({
    from: "FastForward Sistema <info@fastfwdus.com>",
    replyTo: "info@fastfwdus.com",
    to: "info@fastfwdus.com",
    subject: `⚠️ Pipeline en riesgo — ${staleProposals.length + staleNeedsTime.length} leads sin seguimiento`,
    html: `
<div style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:24px;">
  <div style="background:#27295C;border-radius:16px 16px 0 0;padding:24px 28px;">
    <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="28" alt="FastForward">
    <p style="color:rgba(255,255,255,0.6);font-size:11px;margin:8px 0 0;text-transform:uppercase;">Alerta de Pipeline</p>
  </div>
  <div style="background:white;border-radius:0 0 16px 16px;padding:28px;border:1px solid #E5E7EB;border-top:none;">
    <p style="font-size:18px;font-weight:700;color:#27295C;margin:0 0 6px;">Hola, Carlos 👋</p>
    <p style="color:#6B7280;font-size:14px;margin:0 0 24px;">Hay leads en tu pipeline que necesitan atención.</p>

    ${staleProposals.length > 0 ? `
    <div style="margin-bottom:24px;">
      <p style="font-size:13px;font-weight:700;color:#EF4444;margin:0 0 10px;">🔴 Propuestas sin respuesta (+7 días) — ${staleProposals.length}</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
        <thead><tr style="background:#FEF2F2;">
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#9CA3AF;text-transform:uppercase;">Cliente</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#9CA3AF;text-transform:uppercase;">Empresa</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#9CA3AF;text-transform:uppercase;">Rep</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#9CA3AF;text-transform:uppercase;">Días</th>
        </tr></thead>
        <tbody>${proposalRows}</tbody>
      </table>
    </div>` : ""}

    ${staleNeedsTime.length > 0 ? `
    <div style="margin-bottom:24px;">
      <p style="font-size:13px;font-weight:700;color:#F59E0B;margin:0 0 10px;">🟡 Necesita tiempo sin reagendar (+10 días) — ${staleNeedsTime.length}</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
        <thead><tr style="background:#FFFBEB;">
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#9CA3AF;text-transform:uppercase;">Cliente</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#9CA3AF;text-transform:uppercase;">Empresa</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#9CA3AF;text-transform:uppercase;">Rep</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#9CA3AF;text-transform:uppercase;">Días</th>
        </tr></thead>
        <tbody>${needsTimeRows}</tbody>
      </table>
    </div>` : ""}

    <a href="${appUrl}/dashboard/admin" style="display:block;text-align:center;background:#27295C;color:white;padding:14px;border-radius:10px;font-weight:700;text-decoration:none;font-size:14px;">
      Ver dashboard →
    </a>

    <div style="border-top:1px solid #F0F0F0;padding-top:16px;margin-top:20px;text-align:center;">
      <p style="font-size:11px;color:#9CA3AF;margin:0;">FastForward Trading Company LLC · Miami, FL</p>
    </div>
  </div>
</div>`,
  });

  return NextResponse.json({ ok: true, sent: 1, proposals: staleProposals.length, needsTime: staleNeedsTime.length });
}
