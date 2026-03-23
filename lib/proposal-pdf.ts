import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const NAVY = rgb(39/255, 41/255, 92/255);
const GOLD = rgb(201/255, 168/255, 76/255);
const LIGHT = rgb(248/255, 249/255, 251/255);
const GRAY = rgb(107/255, 114/255, 128/255);
const DARK = rgb(17/255, 24/255, 39/255);
const BORDER = rgb(229/255, 231/255, 235/255);
const GREEN = rgb(22/255, 101/255, 52/255);
const GREEN_BG = rgb(220/255, 252/255, 231/255);
const INDIGO = rgb(238/255, 242/255, 255/255);
const WHITE = rgb(1, 1, 1);
const RED_GOLD = rgb(146/255, 64/255, 14/255);

const TRANSLATIONS = {
  es: {
    headerTitle: "PROPUESTA COMERCIAL", confidential: "CONFIDENCIAL",
    title: "Propuesta Comercial", subtitle: "Preparada exclusivamente para su empresa",
    client: "CLIENTE", expert: "EXPERTO ASIGNADO", data: "DATOS",
    date: "Fecha", validUntil: "Valida hasta", proposalNum: "Propuesta N",
    salesRep: "Sales Representative",
    services: "SERVICIOS INCLUIDOS EN ESTA PROPUESTA",
    service: "SERVICIO", description: "DESCRIPCION", price: "PRECIO USD",
    subtotal: "Subtotal", discount: "Descuento especial aplicado", total: "TOTAL DE LA PROPUESTA",
    paymentTitle: "Terminos de pago",
    paymentText: "100% del total al confirmar la propuesta. Medios de pago: Tarjeta de credito (Visa, Mastercard, Amex), Zelle, Wire Transfer / ACH, PayPal.",
    timelineTitle: "Tiempo estimado",
    timelineText: "Estimamos completar todos los servicios en 15-20 dias habiles desde la confirmacion del pago.",
    validityTitle: "Validez de la propuesta", validityText: "Esta propuesta es valida por 15 dias desde la fecha de emision.",
    nextStepTitle: "Proximo paso",
    nextStepText: "Para confirmar esta propuesta responda este email o comuniquese con su asesor asignado.",
    ctaBtn: "Confirmar: scheduling.fastfwdus.com",
    stats: ["+14.000", "empresas asesoradas", "+10 anos", "de experiencia", "100%", "aprobaciones FDA", "Miami, FL", "Estados Unidos"],
    footer: "FastForward Trading Company LLC  |  Miami, Florida 33131  |  info@fastfwdus.com  |  fastfwdus.com",
  },
  en: {
    headerTitle: "COMMERCIAL PROPOSAL", confidential: "CONFIDENTIAL",
    title: "Commercial Proposal", subtitle: "Prepared exclusively for your company",
    client: "CLIENT", expert: "ASSIGNED EXPERT", data: "DETAILS",
    date: "Date", validUntil: "Valid until", proposalNum: "Proposal No",
    salesRep: "Sales Representative",
    services: "SERVICES INCLUDED IN THIS PROPOSAL",
    service: "SERVICE", description: "DESCRIPTION", price: "PRICE USD",
    subtotal: "Subtotal", discount: "Special discount applied", total: "TOTAL PROPOSAL AMOUNT",
    paymentTitle: "Payment Terms",
    paymentText: "100% of the total upon confirming the proposal. Payment methods: Credit card (Visa, Mastercard, Amex), Zelle, Wire Transfer / ACH, PayPal.",
    timelineTitle: "Estimated Timeline",
    timelineText: "We estimate completing all services within 15-20 business days from payment confirmation.",
    validityTitle: "Proposal Validity", validityText: "This proposal is valid for 15 days from the date of issue.",
    nextStepTitle: "Next Step",
    nextStepText: "To confirm this proposal, reply to this email or contact your assigned advisor.",
    ctaBtn: "Confirm: scheduling.fastfwdus.com",
    stats: ["+14,000", "companies advised", "+10 years", "of experience", "100%", "FDA approvals", "Miami, FL", "United States"],
    footer: "FastForward Trading Company LLC  |  Miami, Florida 33131  |  info@fastfwdus.com  |  fastfwdus.com",
  },
  pt: {
    headerTitle: "PROPOSTA COMERCIAL", confidential: "CONFIDENCIAL",
    title: "Proposta Comercial", subtitle: "Preparada exclusivamente para sua empresa",
    client: "CLIENTE", expert: "ESPECIALISTA DESIGNADO", data: "DADOS",
    date: "Data", validUntil: "Valida ate", proposalNum: "Proposta N",
    salesRep: "Representante de Vendas",
    services: "SERVICOS INCLUIDOS NESTA PROPOSTA",
    service: "SERVICO", description: "DESCRICAO", price: "PRECO USD",
    subtotal: "Subtotal", discount: "Desconto especial aplicado", total: "TOTAL DA PROPOSTA",
    paymentTitle: "Condicoes de pagamento",
    paymentText: "100% do total ao confirmar a proposta. Formas de pagamento: Cartao de credito (Visa, Mastercard, Amex), Zelle, Wire Transfer / ACH, PayPal.",
    timelineTitle: "Prazo estimado",
    timelineText: "Estimamos concluir todos os servicos em 15-20 dias uteis a partir da confirmacao do pagamento.",
    validityTitle: "Validade da proposta", validityText: "Esta proposta e valida por 15 dias a partir da data de emissao.",
    nextStepTitle: "Proximo passo",
    nextStepText: "Para confirmar esta proposta, responda a este email ou entre em contato com seu consultor.",
    ctaBtn: "Confirmar: scheduling.fastfwdus.com",
    stats: ["+14.000", "empresas assessoradas", "+10 anos", "de experiencia", "100%", "aprovacoes FDA", "Miami, FL", "Estados Unidos"],
    footer: "FastForward Trading Company LLC  |  Miami, Florida 33131  |  info@fastfwdus.com  |  fastfwdus.com",
  },
};

export interface ProposalService { name: string; description: string; price: number; }
export interface ProposalData {
  clientName: string; contactName: string; contactEmail: string; contactPhone: string;
  repName: string; repEmail: string; repSlug: string;
  proposalNum: string; dateStr: string; validUntil: string;
  introText: string; services: ProposalService[]; discount: number;
  emailText?: string; lang?: "es" | "en" | "pt";
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.substring(0, maxLen - 2) + ".." : text;
}

export async function generateProposalPDF(data: ProposalData): Promise<Buffer> {
  const t = TRANSLATIONS[data.lang || "es"];
  const subtotal = data.services.reduce((s, svc) => s + svc.price, 0);
  const total = subtotal - (data.discount || 0);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const { width, height } = page.getSize();
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const ML = 45; const MR = 45; const CW = width - ML - MR;

  // Header
  page.drawRectangle({ x: 0, y: height - 76, width, height: 76, color: NAVY });
  page.drawRectangle({ x: 0, y: height - 79, width, height: 3, color: GOLD });

  // Logo text
  page.drawText(">> FASTFORWARD", { x: ML, y: height - 42, size: 17, font: bold, color: WHITE });
  page.drawText("FDA Experts  |  Miami, Florida", { x: ML, y: height - 58, size: 9, font: regular, color: GOLD });
  const htW = bold.widthOfTextAtSize(t.headerTitle, 11);
  page.drawText(t.headerTitle, { x: width - MR - htW, y: height - 44, size: 11, font: bold, color: WHITE });

  // Footer
  page.drawRectangle({ x: 0, y: 0, width, height: 38, color: NAVY });
  page.drawRectangle({ x: 0, y: 38, width, height: 2, color: GOLD });
  page.drawText(t.footer, { x: ML, y: 14, size: 7, font: regular, color: WHITE });
  const confW = bold.widthOfTextAtSize(t.confidential, 7);
  page.drawText(t.confidential, { x: width - MR - confW, y: 14, size: 7, font: bold, color: GOLD });

  let y = height - 98;

  // Title
  page.drawText(t.title, { x: ML, y, size: 20, font: bold, color: NAVY }); y -= 22;
  page.drawText(t.subtitle, { x: ML, y, size: 9, font: regular, color: GRAY }); y -= 14;
  page.drawLine({ start: { x: ML, y }, end: { x: width - MR, y }, thickness: 0.5, color: BORDER }); y -= 12;

  // Info box
  const boxH = 78;
  page.drawRectangle({ x: ML, y: y - boxH, width: CW, height: boxH, color: LIGHT });
  page.drawRectangle({ x: ML, y: y - boxH, width: CW, height: boxH, borderColor: BORDER, borderWidth: 0.5 });
  const col = CW / 3;

  const drawInfoCol = (label: string, lines: string[], cx: number) => {
    page.drawText(label, { x: cx + 8, y: y - 14, size: 7, font: bold, color: GRAY });
    lines.forEach((line, i) => {
      const f = i === 0 ? bold : regular;
      const sz = i === 0 ? 9.5 : 8;
      const c = i === 0 ? DARK : GRAY;
      page.drawText(truncate(line, 32), { x: cx + 8, y: y - 26 - i * 12, size: sz, font: f, color: c });
    });
  };

  drawInfoCol(t.client, [data.clientName, data.contactName, data.contactEmail, data.contactPhone], ML);
  page.drawLine({ start: { x: ML + col, y: y - 6 }, end: { x: ML + col, y: y - boxH + 6 }, thickness: 0.5, color: BORDER });
  drawInfoCol(t.expert, [data.repName, t.salesRep, data.repEmail, "FastForward FDA Experts"], ML + col);
  page.drawLine({ start: { x: ML + col * 2, y: y - 6 }, end: { x: ML + col * 2, y: y - boxH + 6 }, thickness: 0.5, color: BORDER });

  const c3x = ML + col * 2 + 8;
  page.drawText(t.data, { x: c3x, y: y - 14, size: 7, font: bold, color: GRAY });
  [[t.date, data.dateStr], [t.validUntil, data.validUntil], [t.proposalNum, data.proposalNum]].forEach(([label, val], i) => {
    page.drawText(label, { x: c3x, y: y - 26 - i * 14, size: 8, font: regular, color: GRAY });
    const vw = bold.widthOfTextAtSize(val, 8);
    page.drawText(val, { x: ML + CW - 8 - vw, y: y - 26 - i * 14, size: 8, font: bold, color: DARK });
  });

  y -= boxH + 10;

  // Intro
  page.drawRectangle({ x: ML, y: y - 34, width: CW, height: 34, color: INDIGO });
  page.drawRectangle({ x: ML, y: y - 34, width: 3, height: 34, color: NAVY });
  page.drawText(truncate(data.introText, 110), { x: ML + 10, y: y - 14, size: 8.5, font: regular, color: DARK });
  if (data.introText.length > 110) {
    page.drawText(truncate(data.introText.substring(110), 110), { x: ML + 10, y: y - 26, size: 8.5, font: regular, color: DARK });
  }
  y -= 46;

  // Services section label
  page.drawText(t.services, { x: ML, y, size: 8, font: bold, color: NAVY }); y -= 14;

  // Table header
  const namW = CW * 0.28; const desW = CW * 0.57; const priW = CW * 0.15;
  page.drawRectangle({ x: ML, y: y - 22, width: CW, height: 22, color: NAVY });
  page.drawText(t.service, { x: ML + 6, y: y - 15, size: 8, font: bold, color: WHITE });
  page.drawText(t.description, { x: ML + namW + 6, y: y - 15, size: 8, font: bold, color: WHITE });
  const prW = bold.widthOfTextAtSize(t.price, 8);
  page.drawText(t.price, { x: ML + namW + desW + priW - prW - 4, y: y - 15, size: 8, font: bold, color: WHITE });
  y -= 22;

  // Table rows
  data.services.forEach((svc, i) => {
    const rowH = 26;
    const rowColor = i % 2 === 0 ? WHITE : LIGHT;
    page.drawRectangle({ x: ML, y: y - rowH, width: CW, height: rowH, color: rowColor });
    page.drawRectangle({ x: ML, y: y - rowH, width: CW, height: rowH, borderColor: BORDER, borderWidth: 0.3 });
    page.drawText(truncate(svc.name, 28), { x: ML + 6, y: y - 10, size: 8.5, font: bold, color: NAVY });
    if (svc.name.length > 28) page.drawText(truncate(svc.name.substring(28), 28), { x: ML + 6, y: y - 20, size: 8.5, font: bold, color: NAVY });
    page.drawText(truncate(svc.description, 52), { x: ML + namW + 6, y: y - 10, size: 8, font: regular, color: DARK });
    if (svc.description.length > 52) page.drawText(truncate(svc.description.substring(52), 52), { x: ML + namW + 6, y: y - 20, size: 8, font: regular, color: DARK });
    const priceStr = `$${svc.price.toLocaleString("en-US")}`;
    const pw = bold.widthOfTextAtSize(priceStr, 9);
    page.drawText(priceStr, { x: ML + namW + desW + priW - pw - 4, y: y - 10, size: 9, font: bold, color: NAVY });
    y -= rowH;
  });
  y -= 4;

  // Subtotal
  page.drawText(t.subtotal, { x: ML, y, size: 9, font: regular, color: GRAY });
  const subStr = `$${subtotal.toLocaleString("en-US")}`;
  const sw = regular.widthOfTextAtSize(subStr, 9);
  page.drawText(subStr, { x: ML + CW - sw, y, size: 9, font: regular, color: GRAY }); y -= 14;

  // Discount
  if ((data.discount || 0) > 0) {
    page.drawRectangle({ x: ML, y: y - 18, width: CW, height: 18, color: GREEN_BG });
    page.drawText(t.discount, { x: ML + 6, y: y - 12, size: 9, font: bold, color: GREEN });
    const dStr = `-$${(data.discount || 0).toLocaleString("en-US")}`;
    const dw = bold.widthOfTextAtSize(dStr, 9);
    page.drawText(dStr, { x: ML + CW - dw, y: y - 12, size: 9, font: bold, color: GREEN }); y -= 22;
  }

  // Total
  page.drawRectangle({ x: ML, y: y - 32, width: CW, height: 32, color: NAVY });
  page.drawText(t.total, { x: ML + 10, y: y - 20, size: 10, font: bold, color: WHITE });
  const totStr = `USD $${total.toLocaleString("en-US")}`;
  const tw = bold.widthOfTextAtSize(totStr, 15);
  page.drawText(totStr, { x: ML + CW - tw - 6, y: y - 22, size: 15, font: bold, color: GOLD }); y -= 44;

  // Terms 2 cols
  const halfW = (CW - 8) / 2;
  const termsH = 108;
  page.drawRectangle({ x: ML, y: y - termsH, width: halfW, height: termsH, color: LIGHT, borderColor: BORDER, borderWidth: 0.5 });
  page.drawRectangle({ x: ML + halfW + 8, y: y - termsH, width: halfW, height: termsH, color: INDIGO, borderColor: BORDER, borderWidth: 0.5 });

  const drawTermsText = (title: string, body: string, cx: number, startY: number) => {
    page.drawText(title, { x: cx + 8, y: startY - 12, size: 9, font: bold, color: DARK });
    const words = body.split(" "); let line = ""; let ly = startY - 24;
    words.forEach(word => {
      const test = line + word + " ";
      if (regular.widthOfTextAtSize(test, 7.5) > halfW - 16) {
        page.drawText(line.trim(), { x: cx + 8, y: ly, size: 7.5, font: regular, color: DARK }); ly -= 10; line = word + " ";
      } else { line = test; }
    });
    if (line.trim()) page.drawText(line.trim(), { x: cx + 8, y: ly, size: 7.5, font: regular, color: DARK });
    return ly - 10;
  };

  let leftY = y;
  leftY = drawTermsText(t.paymentTitle, t.paymentText, ML, leftY) - 4;
  leftY = drawTermsText(t.timelineTitle, t.timelineText, ML, leftY) - 4;
  drawTermsText(t.validityTitle, t.validityText, ML, leftY);

  let rightY = y;
  rightY = drawTermsText(t.nextStepTitle, t.nextStepText, ML + halfW + 8, rightY) - 4;
  page.drawRectangle({ x: ML + halfW + 18, y: rightY - 22, width: halfW - 20, height: 22, color: GOLD });
  const cbW = bold.widthOfTextAtSize(t.ctaBtn, 8.5);
  const cbX = ML + halfW + 18 + (halfW - 20 - cbW) / 2;
  page.drawText(t.ctaBtn, { x: cbX, y: rightY - 15, size: 8.5, font: bold, color: rgb(26/255, 28/255, 62/255) });
  y -= termsH + 14;

  // Stats
  page.drawLine({ start: { x: ML, y }, end: { x: width - MR, y }, thickness: 0.5, color: BORDER }); y -= 12;
  const sw2 = CW / 4;
  for (let i = 0; i < 4; i++) {
    const sx = ML + sw2 * i;
    const num = t.stats[i * 2];
    const label = t.stats[i * 2 + 1];
    const nw = bold.widthOfTextAtSize(num, 14);
    page.drawText(num, { x: sx + (sw2 - nw) / 2, y, size: 14, font: bold, color: NAVY });
    const lw = regular.widthOfTextAtSize(label, 8);
    page.drawText(label, { x: sx + (sw2 - lw) / 2, y: y - 14, size: 8, font: regular, color: GRAY });
    if (i < 3) page.drawLine({ start: { x: sx + sw2, y: y + 4 }, end: { x: sx + sw2, y: y - 20 }, thickness: 0.5, color: BORDER });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
