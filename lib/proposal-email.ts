import { Resend } from "resend";
import { generateProposalPDF, ProposalData } from "@/lib/proposal-pdf";

const resend = new Resend(process.env.RESEND_API_KEY);

export interface EnvioPropuesta {
  proposalData: ProposalData;
  proposalNum: string;
  total: number;
  lang: "es" | "en" | "pt";
  clienteNombre: string;
  clienteEmpresa: string;
  clienteEmail: string;
  repNombre: string;
  repEmail: string;
  confirmUrl: string;
  validUntilStr: string;
  esReenvio?: boolean;
}

function textos(lang: string, firstName: string, empresa: string, total: number, num: string, validUntil: string) {
  const monto = total.toLocaleString("en-US");
  if (lang === "en") return {
    greeting: `Hello, ${firstName}`,
    body: `Please find attached the commercial proposal we have prepared for ${empresa || "your company"}. It includes all agreed services with a total of <strong>USD $${monto}</strong>.<br><br>This proposal is valid for 15 days. To confirm it and begin the process, simply click the button below.`,
    cta: "Accept proposal",
    ctaNote: "By clicking you confirm the services and total indicated in the attached PDF.",
    totalLabel: "Proposal total",
    validLabel: `Proposal ${num} · Valid until ${validUntil}`,
    contact: "For any questions, do not hesitate to contact us.",
    subject: `Commercial proposal for ${empresa || firstName} — FastForward`,
    subjectRe: `Updated proposal for ${empresa || firstName} — FastForward`,
  };
  if (lang === "pt") return {
    greeting: `Olá, ${firstName}`,
    body: `Em anexo, encontrará a proposta comercial personalizada que preparamos para ${empresa || "sua empresa"}. Ela inclui todos os serviços acordados com um total de <strong>USD $${monto}</strong>.<br><br>A proposta é válida por 15 dias. Para confirmá-la e iniciar os trâmites, clique no botão abaixo.`,
    cta: "Aceitar proposta",
    ctaNote: "Ao clicar, você confirma os serviços e o total indicados no PDF em anexo.",
    totalLabel: "Total da proposta",
    validLabel: `Proposta ${num} · Válida até ${validUntil}`,
    contact: "Para qualquer dúvida, não hesite em nos contactar.",
    subject: `Proposta comercial para ${empresa || firstName} — FastForward`,
    subjectRe: `Proposta atualizada para ${empresa || firstName} — FastForward`,
  };
  return {
    greeting: `Estimado/a ${firstName}`,
    body: `Adjunto encontrará la propuesta comercial personalizada que preparamos para ${empresa || "su empresa"}. Incluye todos los servicios acordados con un total de <strong>USD $${monto}</strong>.<br><br>La propuesta tiene una vigencia de 15 días. Para confirmarla e iniciar los trámites, haga clic en el botón a continuación.`,
    cta: "Aceptar propuesta",
    ctaNote: "Al hacer clic confirma los servicios y el total indicado en el PDF adjunto.",
    totalLabel: "Total de la propuesta",
    validLabel: `Propuesta ${num} · Vigente hasta ${validUntil}`,
    contact: "Para cualquier consulta, no dude en contactarnos.",
    subject: `Propuesta comercial para ${empresa || firstName} — FastForward`,
    subjectRe: `Propuesta actualizada para ${empresa || firstName} — FastForward`,
  };
}

export function armarHtmlPropuesta(p: EnvioPropuesta): string {
  const firstName = (p.clienteNombre || "").split(" ")[0];
  const L = textos(p.lang, firstName, p.clienteEmpresa, p.total, p.proposalNum, p.validUntilStr);
  return `
<div style="font-family:system-ui,sans-serif;max-width:580px;margin:0 auto;padding:24px;">
  <div style="background:#27295C;border-radius:16px 16px 0 0;padding:28px;text-align:center;">
    <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="34" alt="FastForward">
  </div>
  <div style="background:white;border-radius:0 0 16px 16px;padding:32px;border:1px solid #E5E7EB;border-top:none;">
    <p style="font-size:18px;font-weight:700;color:#27295C;margin:0 0 8px;">${L.greeting}</p>
    <div style="font-size:14px;color:#374151;line-height:1.6;margin-bottom:24px;">${L.body}</div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${p.confirmUrl}" style="display:inline-block;background:#27295C;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;">${L.cta}</a>
      <p style="font-size:11px;color:#9CA3AF;margin:10px 0 0;">${L.ctaNote}</p>
    </div>
    <div style="background:#F8F9FB;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
      <p style="font-size:12px;color:#6B7280;margin:0 0 4px;">${L.totalLabel}</p>
      <p style="font-size:24px;font-weight:700;color:#C9A84C;margin:0;">USD $${p.total.toLocaleString("en-US")}</p>
      <p style="font-size:12px;color:#6B7280;margin:4px 0 0;">${L.validLabel}</p>
    </div>
    <p style="font-size:13px;color:#6B7280;margin:0 0 4px;">${L.contact}</p>
    <p style="font-size:13px;font-weight:600;color:#27295C;margin:0;">${p.repNombre} · FastForward FDA Experts</p>
    <div style="border-top:1px solid #F0F0F0;padding-top:20px;margin-top:24px;text-align:center;">
      <p style="font-size:12px;color:#9CA3AF;margin:0;">FastForward Trading Company LLC · Miami, FL</p>
      <a href="https://fastfwdus.com" style="font-size:12px;color:#C9A84C;">fastfwdus.com</a>
    </div>
  </div>
</div>`;
}

/** Genera el PDF y manda el mail. Usado por el envio original y por el reenvio. */
export async function enviarPropuestaPorEmail(p: EnvioPropuesta): Promise<void> {
  const pdf = await generateProposalPDF(p.proposalData);
  const firstName = (p.clienteNombre || "").split(" ")[0];
  const L = textos(p.lang, firstName, p.clienteEmpresa, p.total, p.proposalNum, p.validUntilStr);

  await resend.emails.send({
    from: `${p.repNombre} — FastForward <info@fastfwdus.com>`,
    replyTo: p.repEmail,
    to: p.clienteEmail,
    cc: p.repEmail !== "info@fastfwdus.com" ? [p.repEmail] : undefined,
    subject: p.esReenvio ? L.subjectRe : L.subject,
    html: armarHtmlPropuesta(p),
    attachments: [{
      filename: `Propuesta-FastForward-${p.proposalNum}.pdf`,
      content: pdf.toString("base64"),
    }],
  });
}
