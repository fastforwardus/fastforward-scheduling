import { portal } from "@/lib/status/portal-db";

export const dynamic = "force-dynamic";

const REVIEW_GOOGLE = process.env.GOOGLE_BUSINESS_REVIEW_URL || "https://g.page/r/fastforwardfda/review";
const REVIEW_TRUSTPILOT = "https://www.trustpilot.com/evaluate/fastfwdus.com";

function page(title: string, body: string) {
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#F8F9FB;font-family:system-ui,sans-serif;"><div style="max-width:520px;margin:40px auto;padding:24px;">
<div style="background:#0183FF;border-radius:16px 16px 0 0;padding:24px;text-align:center;"><img src="/brand/FF_Logo_06.png" height="32" alt="FastForward"></div>
<div style="background:#fff;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 16px 16px;padding:32px;text-align:center;">${body}</div></div></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const s = Number(new URL(req.url).searchParams.get("s"));
  const [m] = await portal`SELECT m.filing_id, m.survey_score, c.preferred_language AS lang FROM case_meta m JOIN filings f ON f.id = m.filing_id JOIN clients c ON c.id = f.client_id WHERE m.survey_token = ${params.token}`;
  if (!m) return page("FastForward", `<p style="font-size:16px;color:#374151;">Este enlace no es válido o ya expiró.</p>`);
  const en = m.lang === "en";
  if (![1, 2, 3].includes(s)) return page("FastForward", `<p style="font-size:16px;color:#374151;">${en ? "Invalid option." : "Opción no válida."}</p>`);
  if (m.survey_score == null) {
    await portal`UPDATE case_meta SET survey_score = ${s}, survey_at = now(), updated_at = now() WHERE filing_id = ${m.filing_id}`;
    await portal`INSERT INTO case_comments (filing_id, author_email, author_name, kind, body) VALUES (${m.filing_id}, 'system', 'Sistema', 'system', ${`Encuesta de cierre: ${["", "☹️ Mala", "😐 Regular", "😊 Excelente"][s]}`})`;
  }
  const score = m.survey_score ?? s;
  if (score === 3) {
    return page("¡Gracias!", `<div style="font-size:48px;">😊</div><p style="font-size:18px;font-weight:700;color:#000;margin:12px 0 8px;">${en ? "Thank you!" : "¡Muchas gracias!"}</p>
<p style="font-size:14px;color:#374151;line-height:1.6;">${en ? "It would mean a lot to us if you could leave a short public review. It takes one minute:" : "Nos ayudaría muchísimo que deje una breve reseña pública. Toma un minuto:"}</p>
<p><a href="${REVIEW_GOOGLE}" style="display:inline-block;margin:6px;background:#0183FF;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;">Google</a>
<a href="${REVIEW_TRUSTPILOT}" style="display:inline-block;margin:6px;background:#000;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;">Trustpilot</a></p>`);
  }
  return page("Gracias", `<div style="font-size:48px;">${score === 2 ? "😐" : "☹️"}</div><p style="font-size:18px;font-weight:700;color:#000;margin:12px 0 8px;">${en ? "Thank you for your honesty." : "Gracias por su sinceridad."}</p>
<p style="font-size:14px;color:#374151;line-height:1.6;">${en ? "A member of our team will reach out to understand what we can improve." : "Un responsable de nuestro equipo se va a comunicar para entender qué podemos mejorar."}</p>
<p><a href="https://wa.me/17868225585" style="display:inline-block;background:#0183FF;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;">${en ? "Write to us on WhatsApp" : "Escribirnos por WhatsApp"}</a></p>`);
}
