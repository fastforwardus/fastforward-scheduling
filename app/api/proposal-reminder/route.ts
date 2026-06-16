export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { proposals, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";
const BOOK_URL = "https://ffus.link/Video";

type Lang = "es" | "en" | "pt";

const T = {
  greet:      { es: "Hola", en: "Hi", pt: "Olá" },
  totalLabel: { es: "Total", en: "Total", pt: "Total" },
  book:       { es: "Agendar nueva reunión", en: "Schedule a new meeting", pt: "Agendar nova reunião" },
  bookCall:   { es: "Agendar una llamada", en: "Book a call", pt: "Agendar uma ligação" },
  footer:     "FastForward Trading Company LLC · Miami, FL · info@fastfwdus.com",
};

type StageDef = {
  subject: Record<Lang, string>;
  body: Record<Lang, string>;
  badge: { bg: string; border: string; color: string; text: Record<Lang, string> } | null;
  acceptLabel: Record<Lang, string>;
  acceptColor: string;
  secondary: "book" | "call" | null;
};

const STAGES: Record<1 | 2 | 3 | 4, StageDef> = {
  1: {
    subject: {
      es: "¿Alguna duda sobre tu propuesta?",
      en: "Any questions about your proposal?",
      pt: "Alguma dúvida sobre sua proposta?",
    },
    body: {
      es: "Queríamos saber si tenés alguna consulta sobre la propuesta que te enviamos. Estamos para ayudarte a avanzar cuando quieras.",
      en: "We wanted to check if you have any questions about the proposal we sent. We're here to help you move forward whenever you're ready.",
      pt: "Queríamos saber se você tem alguma dúvida sobre a proposta que enviamos. Estamos aqui para ajudar você a avançar quando quiser.",
    },
    badge: null,
    acceptLabel: { es: "Aceptar propuesta →", en: "Accept proposal →", pt: "Aceitar proposta →" },
    acceptColor: "#22C55E",
    secondary: "book",
  },
  2: {
    subject: {
      es: "Tu propuesta vence pronto — sigue disponible",
      en: "Your proposal expires soon — still available",
      pt: "Sua proposta expira em breve — ainda disponível",
    },
    body: {
      es: "Tu propuesta de FastForward sigue activa, pero el plazo se acerca. Si querés seguir adelante, podés aceptarla ahora — o agendemos una llamada para resolver lo que falte.",
      en: "Your FastForward proposal is still active, but the deadline is approaching. If you'd like to move ahead, you can accept it now — or let's schedule a call to sort out anything pending.",
      pt: "Sua proposta da FastForward continua ativa, mas o prazo está chegando. Se quiser seguir em frente, pode aceitá-la agora — ou agendemos uma ligação para resolver o que faltar.",
    },
    badge: {
      bg: "#FEF3C7", border: "#FCD34D", color: "#854D0E",
      text: { es: "⏳ Tu propuesta vence en 5 días", en: "⏳ Your proposal expires in 5 days", pt: "⏳ Sua proposta expira em 5 dias" },
    },
    acceptLabel: { es: "Aceptar propuesta →", en: "Accept proposal →", pt: "Aceitar proposta →" },
    acceptColor: "#22C55E",
    secondary: "book",
  },
  3: {
    subject: {
      es: "⚠️ Tu propuesta vence mañana",
      en: "⚠️ Your proposal expires tomorrow",
      pt: "⚠️ Sua proposta expira amanhã",
    },
    body: {
      es: "Este es el último recordatorio: tu propuesta vence mañana. Si querés asegurar las condiciones actuales, es el momento de confirmarla.",
      en: "This is the final reminder: your proposal expires tomorrow. To lock in the current terms, now's the time to confirm it.",
      pt: "Este é o último lembrete: sua proposta expira amanhã. Para garantir as condições atuais, é hora de confirmá-la.",
    },
    badge: {
      bg: "#FEE2E2", border: "#FCA5A5", color: "#991B1B",
      text: { es: "⚠️ Vence mañana — última oportunidad", en: "⚠️ Expires tomorrow — last chance", pt: "⚠️ Expira amanhã — última chance" },
    },
    acceptLabel: { es: "Aceptar ahora →", en: "Accept now →", pt: "Aceitar agora →" },
    acceptColor: "#22C55E",
    secondary: null,
  },
  4: {
    subject: {
      es: "Tu propuesta expiró — ¿la reactivamos?",
      en: "Your proposal expired — shall we reactivate it?",
      pt: "Sua proposta expirou — quer reativar?",
    },
    body: {
      es: "El plazo de tu propuesta venció, pero si seguís interesado podemos reactivarla sin problema. Aceptala desde el botón o reservá una llamada y la dejamos lista de nuevo.",
      en: "Your proposal's deadline has passed, but if you're still interested we can reactivate it. Accept it from the button or book a call and we'll get it ready again.",
      pt: "O prazo da sua proposta venceu, mas se ainda tiver interesse podemos reativá-la. Aceite pelo botão ou agende uma ligação e deixamos tudo pronto novamente.",
    },
    badge: null,
    acceptLabel: { es: "Reactivar mi propuesta →", en: "Reactivate my proposal →", pt: "Reativar minha proposta →" },
    acceptColor: "#27295C",
    secondary: "call",
  },
};

function render(stageNum: 1 | 2 | 3 | 4, lang: Lang, firstName: string, proposalNum: string, total: number, confirmUrl: string) {
  const s = STAGES[stageNum];
  const greet = firstName ? `${T.greet[lang]}, ${firstName}` : T.greet[lang];
  const totalFmt = `USD $${total.toLocaleString("en-US")}`;
  const badgeHtml = s.badge
    ? `<div style="background:${s.badge.bg};border:1px solid ${s.badge.border};border-radius:8px;padding:10px 14px;margin-bottom:16px;"><span style="font-size:13px;color:${s.badge.color};font-weight:600;">${s.badge.text[lang]}</span></div>`
    : "";
  const secondaryHtml =
    s.secondary === "book"
      ? `<a href="${BOOK_URL}" style="display:block;text-align:center;border:1px solid #27295C;color:#27295C;padding:14px;border-radius:10px;font-weight:600;text-decoration:none;font-size:14px;">${T.book[lang]}</a>`
      : s.secondary === "call"
      ? `<a href="${BOOK_URL}" style="display:block;text-align:center;border:1px solid #27295C;color:#27295C;padding:14px;border-radius:10px;font-weight:600;text-decoration:none;font-size:14px;">${T.bookCall[lang]}</a>`
      : "";

  const html = `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  <div style="background:#27295C;border-radius:16px 16px 0 0;padding:28px;text-align:center;">
    <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="32" alt="FastForward">
  </div>
  <div style="background:white;border-radius:0 0 16px 16px;padding:32px;border:1px solid #E5E7EB;border-top:none;">
    ${badgeHtml}
    <p style="font-size:18px;font-weight:700;color:#27295C;margin:0 0 12px;">${greet} 👋</p>
    <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 20px;">${s.body[lang]}</p>
    <div style="background:#F8F9FB;border-radius:12px;padding:16px;margin-bottom:20px;border:1px solid #E5E7EB;">
      <p style="font-size:12px;color:#9CA3AF;margin:0 0 4px;text-transform:uppercase;">${proposalNum} · ${T.totalLabel[lang]}</p>
      <p style="font-size:20px;font-weight:700;color:#C9A84C;margin:0;">${totalFmt}</p>
    </div>
    <a href="${confirmUrl}" style="display:block;text-align:center;background:${s.acceptColor};color:white;padding:16px;border-radius:12px;font-weight:700;text-decoration:none;font-size:15px;margin-bottom:${secondaryHtml ? "12px" : "0"};">${s.acceptLabel[lang]}</a>
    ${secondaryHtml}
    <div style="border-top:1px solid #F0F0F0;padding-top:20px;margin-top:20px;text-align:center;">
      <p style="font-size:12px;color:#9CA3AF;margin:0;">${T.footer}</p>
    </div>
  </div>
</div>`;

  return { subject: s.subject[lang], html };
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = Date.now();
  const DAILY_CAP = 50;

  const rows = await db.select({
    id: proposals.id,
    proposalNum: proposals.proposalNum,
    total: proposals.total,
    lang: proposals.lang,
    confirmToken: proposals.confirmToken,
    clientName: proposals.clientName,
    clientEmail: proposals.clientEmail,
    sentById: proposals.sentById,
    createdAt: proposals.createdAt,
    reminderStage: proposals.reminderStage,
  }).from(proposals).where(eq(proposals.status, "pending")).orderBy(desc(proposals.createdAt));

  const seenEmails = new Set<string>();
  let sent = 0;

  for (const p of rows) {
    if (!p.clientEmail) continue;
    const email = p.clientEmail.toLowerCase().trim();
    if (email.endsWith("@fastfwdus.com") || email.endsWith("@fastfwd.com")) continue;

    const ageDays = (now - new Date(p.createdAt).getTime()) / 86400000;
    const target: 0 | 1 | 2 | 3 | 4 =
      ageDays >= 17 ? 4 : ageDays >= 15 ? 3 : ageDays >= 9 ? 2 : ageDays >= 5 ? 1 : 0;

    const current = p.reminderStage ?? 0;
    if (target === 0 || target <= current) continue;
    if (seenEmails.has(email)) continue;
    seenEmails.add(email);

    let repName = "FastForward FDA Experts";
    let repEmail = "info@fastfwdus.com";
    if (p.sentById) {
      const [rep] = await db.select({ fullName: users.fullName, email: users.email })
        .from(users).where(eq(users.id, p.sentById)).limit(1);
      if (rep) { repName = rep.fullName; repEmail = rep.email; }
    }

    const lang = (["es", "en", "pt"].includes(p.lang || "") ? p.lang : "es") as Lang;
    const firstName = (p.clientName || "").split(" ")[0] || "";
    const confirmUrl = `${APP_URL}/proposal/confirm/${p.confirmToken}`;

    const { subject, html } = render(target as 1 | 2 | 3 | 4, lang, firstName, p.proposalNum, p.total, confirmUrl);

    await resend.emails.send({
      from: `${repName} — FastForward <info@fastfwdus.com>`,
      replyTo: repEmail,
      to: p.clientEmail,
      subject,
      html,
    }).catch(console.error);

    await db.update(proposals).set({ reminderStage: target }).where(eq(proposals.id, p.id));
    sent++;
    if (sent >= DAILY_CAP) break;
  }

  return NextResponse.json({ ok: true, sent, checked: rows.length });
}
