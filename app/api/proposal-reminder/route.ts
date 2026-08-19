export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { proposals, users, appointments, adrianaConversations, proposalEvents } from "@/db/schema";
import { eq, desc, sql, isNotNull } from "drizzle-orm";
import { sendWhatsAppTemplate } from "@/lib/adriana/whatsapp-sender";
import { normalizeWhatsAppPhone, isPlausiblePhone, phoneTail } from "@/lib/phone";
import { getOrCreateConversation, appendMessage, updateConversation } from "@/lib/adriana/db-helpers";
import { renderTemplate } from "@/lib/whatsapp-templates";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";
const BOOK_URL = "https://ffus.link/Video";

// Recordatorios por WhatsApp: apagados hasta que Meta apruebe las plantillas.
// Activar con: vercel env add WHATSAPP_REMINDERS_ENABLED  (valor: true)
const WA_ENABLED = process.env.WHATSAPP_REMINDERS_ENABLED === "true";
const WA_DAILY_CAP = 30;
// Un cliente con varias propuestas pendientes recibia un mensaje por dia,
// una por propuesta. El dedupe por telefono solo cubria la misma corrida.
const WA_COOLDOWN_DIAS = 7;
// Tope de antiguedad: al encender WhatsApp habia 214 propuestas de meses atras
// que caian todas en etapa 4 ("tu propuesta vence"). Mandar eso masivamente
// dispara reportes y el numero es el mismo que usa Adriana.
const WA_MAX_DIAS = Number(process.env.WA_MAX_DIAS || 30);
const WA_TPL_RESUMEN = "propuestas_pendientes_resumen";

// Meta usa pt_BR; nuestro enum guarda "pt"
const WA_LANG: Record<string, string> = { es: "es", en: "en", pt: "pt_BR" };

// Etapa -> plantilla aprobada
const WA_TEMPLATE: Record<1 | 2 | 3 | 4, string> = {
  1: "propuesta_recordatorio_1",
  2: "propuesta_recordatorio_2",
  3: "propuesta_recordatorio_2",
  4: "propuesta_vencimiento",
};

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
  const { searchParams } = new URL(req.url);
  const testEmail = searchParams.get("test");

  if (testEmail) {
    const confirmUrl = `${APP_URL}/proposal/confirm/SAMPLE-TOKEN`;
    for (const stage of [1, 2, 3, 4] as const) {
      const { subject, html } = render(stage, "es", testEmail.split("@")[0], "FF-TEST-0000", 4800, confirmUrl);
      await resend.emails.send({
        from: "FastForward FDA Experts — FastForward <info@fastfwdus.com>",
        to: testEmail,
        subject: `[PRUEBA] ${subject}`,
        html,
      }).catch(console.error);
    }
    return NextResponse.json({ ok: true, test: true, sentTo: testEmail, mails: 4 });
  }

  const manualRun = searchParams.get("run");
  const auth = req.headers.get("authorization");
  const okCron = auth === `Bearer ${process.env.CRON_SECRET}`;
  const okManual = manualRun && manualRun === process.env.MANUAL_RUN_TOKEN;
  if (!okCron && !okManual) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    whatsappStage: proposals.whatsappStage,
    clientPhone: appointments.clientWhatsapp,
  }).from(proposals)
    .leftJoin(appointments, sql`${appointments.id}::text = ${proposals.appointmentId}`)
    .where(eq(proposals.status, "pending"))
    .orderBy(desc(proposals.createdAt));

  // Telefonos que pidieron la baja por WhatsApp
  const optedOut = new Set<string>();
  if (WA_ENABLED) {
    const outs = await db
      .select({ waPhone: adrianaConversations.waPhone })
      .from(adrianaConversations)
      .where(isNotNull(adrianaConversations.optedOutAt));
    // Doble clave: normalizada y ultimos 8 digitos. Ante formatos distintos
    // preferimos no enviar antes que escribirle a quien pidio la baja.
    for (const o of outs) {
      optedOut.add(normalizeWhatsAppPhone(o.waPhone));
      optedOut.add(phoneTail(o.waPhone));
    }
  }

  // Telefonos que ya recibieron un recordatorio en la ventana de enfriamiento
  const enfriamiento = new Set<string>();
  if (WA_ENABLED) {
    const desde = new Date(Date.now() - WA_COOLDOWN_DIAS * 86400000);
    const recientes = await db
      .select({ phone: appointments.clientWhatsapp })
      .from(proposals)
      .leftJoin(appointments, sql`${appointments.id}::text = ${proposals.appointmentId}`)
      .where(sql`${proposals.whatsappLastSentAt} >= ${desde}`);
    for (const r of recientes) {
      if (!r.phone) continue;
      enfriamiento.add(normalizeWhatsAppPhone(r.phone));
      enfriamiento.add(phoneTail(r.phone));
    }
  }

  // Agrupado: si un cliente tiene varias propuestas en etapa, se le manda un
  // solo mensaje de resumen y todas avanzan. Sin esto, el cooldown de 7 dias
  // hacia que la segunda propuesta esperara una semana para su primer aviso.
  const grupos = new Map<string, { ids: string[]; total: number; nombre: string; lang: string; etapaMax: number }>();
  if (WA_ENABLED) {
    const now2 = Date.now();
    for (const p of rows) {
      if (!p.clientPhone) continue;
      const dias = (now2 - new Date(p.createdAt).getTime()) / 86400000;
      if (dias > WA_MAX_DIAS) continue;
      const t = dias >= 17 ? 4 : dias >= 15 ? 3 : dias >= 9 ? 2 : dias >= 5 ? 1 : 0;
      if (t === 0 || t <= (p.whatsappStage ?? 0)) continue;
      const tel = normalizeWhatsAppPhone(p.clientPhone);
      if (!isPlausiblePhone(tel)) continue;
      const g = grupos.get(tel) || { ids: [], total: 0, nombre: "", lang: "es", etapaMax: 0 };
      g.ids.push(p.id);
      g.total += p.total || 0;
      if (!g.nombre) g.nombre = (p.clientName || "").split(" ")[0] || "";
      if (["es", "en", "pt"].includes(p.lang || "")) g.lang = p.lang as string;
      if (t > g.etapaMax) g.etapaMax = t;
      grupos.set(tel, g);
    }
  }

  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();
  let sent = 0;
  let waSent = 0;
  let waFailed = 0;

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
    await db.insert(proposalEvents).values({
      proposalId: p.id, kind: "reminder", channel: "email",
      detail: `Etapa ${target} — ${p.clientEmail}`,
    }).catch(() => {});
    sent++;

    // ── WhatsApp: etapa propia, no depende de que el email haya salido ──
    const waCurrent = p.whatsappStage ?? 0;
    if (WA_ENABLED && p.clientPhone && target > waCurrent && waSent < WA_DAILY_CAP) {
      const phone = normalizeWhatsAppPhone(p.clientPhone);
      const baja = optedOut.has(phone) || optedOut.has(phoneTail(phone));
      const enfriando = enfriamiento.has(phone) || enfriamiento.has(phoneTail(phone));
      if (isPlausiblePhone(phone) && !seenPhones.has(phone) && !baja && !enfriando) {
        seenPhones.add(phone);
        const grupo = grupos.get(phone);
        const agrupar = !!grupo && grupo.ids.length > 1;

        const r = agrupar
          ? await sendWhatsAppTemplate({
              toPhone: phone,
              templateName: WA_TPL_RESUMEN,
              languageCode: WA_LANG[lang] || "es",
              bodyParams: [
                grupo!.nombre || firstName || "",
                String(grupo!.ids.length),
                grupo!.total.toLocaleString("en-US"),
              ],
            })
          : await sendWhatsAppTemplate({
              toPhone: phone,
              templateName: WA_TEMPLATE[target as 1 | 2 | 3 | 4],
              languageCode: WA_LANG[lang] || "es",
              bodyParams: [firstName || "", p.proposalNum],
              urlParam: p.confirmToken || "",
            });
        if (r.ok) {
          // Con resumen, todas las del grupo avanzan: el mensaje las cubre a todas
          const cubiertas = agrupar ? grupo!.ids : [p.id];
          for (const pid of cubiertas) {
            await db.update(proposals)
              .set({
                whatsappStage: pid === p.id ? target : grupo!.etapaMax,
                whatsappLastWamid: pid === p.id ? (r.metaMessageId ?? null) : null,
                whatsappLastSentAt: new Date(),
              })
              .where(eq(proposals.id, pid));
            if (pid !== p.id) {
              await db.insert(proposalEvents).values({
                proposalId: pid, kind: "reminder", channel: "whatsapp",
                detail: `Cubierta por resumen de ${grupo!.ids.length} propuestas`,
              }).catch(() => {});
            }
          }
          await db.insert(proposalEvents).values({
            proposalId: p.id, kind: "reminder", channel: "whatsapp",
            detail: `Etapa ${target} — ${WA_TEMPLATE[target as 1 | 2 | 3 | 4]} (${WA_LANG[lang] || "es"})`,
          }).catch(() => {});
          waSent++;
          enfriamiento.add(phone);
          enfriamiento.add(phoneTail(phone));

          // Registrar en el hilo de Adriana para que el recordatorio se vea
          // en el panel y la respuesta del cliente caiga en la misma conversacion.
          try {
            const conv = await getOrCreateConversation(phone, p.clientName || undefined);
            const tpl = agrupar ? WA_TPL_RESUMEN : WA_TEMPLATE[target as 1 | 2 | 3 | 4];
            // Guardamos el texto que efectivamente ve el cliente, no un marcador
            const textoReal = agrupar
              ? renderTemplate(tpl, WA_LANG[lang] || "es",
                  [grupo!.nombre || firstName || "", String(grupo!.ids.length), grupo!.total.toLocaleString("en-US")])
              : renderTemplate(tpl, WA_LANG[lang] || "es",
                  [firstName || "", p.proposalNum], p.confirmToken || undefined);
            await appendMessage({
              conversationId: conv.id,
              role: "assistant",
              content: [{ type: "text", text: textoReal }],
              waMessageId: r.metaMessageId ?? null,
            });
            await updateConversation(conv.id, {
              lastAssistantMsgAt: new Date(),
              ...(conv.leadName ? {} : { leadName: p.clientName || null }),
              ...(conv.leadEmail ? {} : { leadEmail: p.clientEmail || null }),
              ...(conv.language ? {} : { language: lang as "es" | "en" | "pt" }),
            });
          } catch (logErr) {
            console.error("[wa-reminder] no se pudo registrar en Adriana:", logErr);
          }
        } else {
          waFailed++;
          await db.insert(proposalEvents).values({
            proposalId: p.id, kind: "reminder_failed", channel: "whatsapp",
            detail: String(r.error).slice(0, 300),
          }).catch(() => {});
          console.error("[wa-reminder]", p.proposalNum, lang, "->", r.error);
        }
      }
    }

    if (sent >= DAILY_CAP) break;
  }

  return NextResponse.json({ ok: true, sent, checked: rows.length, waEnabled: WA_ENABLED, waSent, waFailed, waOptedOut: optedOut.size });
}
