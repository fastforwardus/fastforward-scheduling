import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const NAVY  = rgb(39/255,  41/255,  92/255);
const GOLD  = rgb(201/255, 168/255, 76/255);
const LIGHT = rgb(248/255, 249/255, 251/255);
const GRAY  = rgb(107/255, 114/255, 128/255);
const DARK  = rgb(17/255,  24/255,  39/255);
const BORD  = rgb(229/255, 231/255, 235/255);
const IBLUE = rgb(238/255, 242/255, 255/255);
const WHITE = rgb(1, 1, 1);
const GREEN     = rgb(22/255,  101/255, 52/255);
const GREEN_BG  = rgb(220/255, 252/255, 231/255);

const T = {
  es: {
    hdr: "PROPUESTA COMERCIAL",    conf: "CONFIDENCIAL",
    ttl: "Propuesta Comercial",    sub: "Preparada exclusivamente para su empresa",
    cli: "CLIENTE",                exp: "EXPERTO ASIGNADO",       dat: "DATOS",
    dte: "Fecha",                  vld: "V\u00e1lida hasta",      num: "Propuesta N\u00b0",
    rep: "Sales Representative",
    svc: "SERVICIOS INCLUIDOS EN ESTA PROPUESTA",
    col1: "SERVICIO",              col2: "DESCRIPCI\u00d3N",      col3: "PRECIO USD",
    sub2: "Subtotal",              dis: "Descuento especial aplicado",  tot: "TOTAL DE LA PROPUESTA",
    pt: "T\u00e9rminos de pago",
    pb: "100% del total al confirmar la propuesta. Medios de pago: Tarjeta de cr\u00e9dito (Visa, Mastercard, Amex), Zelle, Wire Transfer / ACH, PayPal.",
    tt: "Tiempo estimado",
    tb: "Estimamos completar todos los servicios en 15-20 d\u00edas h\u00e1biles desde la confirmaci\u00f3n del pago.",
    vt: "Validez de la propuesta", vb: "Esta propuesta es v\u00e1lida por 15 d\u00edas desde la fecha de emisi\u00f3n.",
    nt: "Pr\u00f3ximo paso",
    nb: "Para confirmar esta propuesta responda este email o comun\u00edquese con su asesor asignado.",
    cta: "Confirmar: scheduling.fastfwdus.com",
    stats: ["+14.000","empresas asesoradas","+10 a\u00f1os","de experiencia","100%","aprobaciones FDA","Miami, FL","Estados Unidos"],
    ftr: "FastForward Trading Company LLC  \u00b7  Miami, Florida 33131  \u00b7  info@fastfwdus.com  \u00b7  fastfwdus.com",
  },
  en: {
    hdr: "COMMERCIAL PROPOSAL",   conf: "CONFIDENTIAL",
    ttl: "Commercial Proposal",   sub: "Prepared exclusively for your company",
    cli: "CLIENT",                exp: "ASSIGNED EXPERT",          dat: "DETAILS",
    dte: "Date",                  vld: "Valid until",               num: "Proposal No.",
    rep: "Sales Representative",
    svc: "SERVICES INCLUDED IN THIS PROPOSAL",
    col1: "SERVICE",              col2: "DESCRIPTION",              col3: "PRICE USD",
    sub2: "Subtotal",             dis: "Special discount applied",  tot: "TOTAL PROPOSAL AMOUNT",
    pt: "Payment Terms",
    pb: "100% of the total upon confirming the proposal. Payment methods: Credit card (Visa, Mastercard, Amex), Zelle, Wire Transfer / ACH, PayPal.",
    tt: "Estimated Timeline",
    tb: "We estimate completing all services within 15-20 business days from payment confirmation.",
    vt: "Proposal Validity",      vb: "This proposal is valid for 15 days from the date of issue.",
    nt: "Next Step",
    nb: "To confirm this proposal, reply to this email or contact your assigned advisor.",
    cta: "Confirm: scheduling.fastfwdus.com",
    stats: ["+14,000","companies advised","+10 years","of experience","100%","FDA approvals","Miami, FL","United States"],
    ftr: "FastForward Trading Company LLC  \u00b7  Miami, Florida 33131  \u00b7  info@fastfwdus.com  \u00b7  fastfwdus.com",
  },
  pt: {
    hdr: "PROPOSTA COMERCIAL",    conf: "CONFIDENCIAL",
    ttl: "Proposta Comercial",    sub: "Preparada exclusivamente para sua empresa",
    cli: "CLIENTE",               exp: "ESPECIALISTA DESIGNADO",   dat: "DADOS",
    dte: "Data",                  vld: "V\u00e1lida at\u00e9",   num: "Proposta N\u00b0",
    rep: "Representante de Vendas",
    svc: "SERVI\u00c7OS INCLU\u00cdDOS NESTA PROPOSTA",
    col1: "SERVI\u00c7O",        col2: "DESCRI\u00c7\u00c3O",   col3: "PRE\u00c7O USD",
    sub2: "Subtotal",             dis: "Desconto especial aplicado", tot: "TOTAL DA PROPOSTA",
    pt: "Condi\u00e7\u00f5es de pagamento",
    pb: "100% do total ao confirmar a proposta. Formas de pagamento: Cart\u00e3o de cr\u00e9dito (Visa, Mastercard, Amex), Zelle, Wire Transfer / ACH, PayPal.",
    tt: "Prazo estimado",
    tb: "Estimamos concluir todos os servi\u00e7os em 15-20 dias \u00fateis a partir da confirma\u00e7\u00e3o do pagamento.",
    vt: "Validade da proposta",   vb: "Esta proposta \u00e9 v\u00e1lida por 15 dias a partir da data de emiss\u00e3o.",
    nt: "Pr\u00f3ximo passo",
    nb: "Para confirmar esta proposta, responda a este email ou entre em contato com seu consultor.",
    cta: "Confirmar: scheduling.fastfwdus.com",
    stats: ["+14.000","empresas assessoradas","+10 anos","de experi\u00eancia","100%","aprova\u00e7\u00f5es FDA","Miami, FL","Estados Unidos"],
    ftr: "FastForward Trading Company LLC  \u00b7  Miami, Florida 33131  \u00b7  info@fastfwdus.com  \u00b7  fastfwdus.com",
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

// Wrap text into lines that fit within maxWidth
function wrapText(text: string, font: { widthOfTextAtSize: (s: string, size: number) => number }, size: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? current + " " + word : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}


export async function generateProposalPDF(data: ProposalData): Promise<Buffer> {
  const lang = data.lang || "es";
  const t = T[lang];
  const subtotal = data.services.reduce((s, svc) => s + svc.price, 0);
  const total = subtotal - (data.discount || 0);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Fetch + embed Noto Sans (supports all special chars) from jsDelivr
  let bold: Awaited<ReturnType<typeof pdfDoc.embedFont>>;
  let regular: Awaited<ReturnType<typeof pdfDoc.embedFont>>;
  try {
    const [boldBytes, regularBytes] = await Promise.all([
      fetch("https://fonts.gstatic.com/s/notosans/v36/o-0NIpQlx3QUlC5A4PNjXhFlY9aA5W43_CT5invnDg.ttf").then(r => r.arrayBuffer()),
      fetch("https://fonts.gstatic.com/s/notosans/v36/o-0IIpQlx3QUlC5A4PNr4ARARUM.ttf").then(r => r.arrayBuffer()),
    ]);
    bold    = await pdfDoc.embedFont(boldBytes);
    regular = await pdfDoc.embedFont(regularBytes);
  } catch {
    bold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  // Fetch logo
  let logoImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  try {
    const logoBytes = await fetch("https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png").then(r => r.arrayBuffer());
    logoImage = await pdfDoc.embedPng(logoBytes);
  } catch { logoImage = null; }

  const page = pdfDoc.addPage([612, 792]);
  const W = 612; const H = 792; const ML = 42; const MR = 42; const CW = W - ML - MR;

  // ── HEADER ──────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: H - 76, width: W, height: 76, color: NAVY });
  page.drawRectangle({ x: 0, y: H - 79, width: W, height: 3, color: GOLD });

  if (logoImage) {
    const logoDims = logoImage.scale(0.18);
    page.drawImage(logoImage, { x: ML, y: H - 60, width: logoDims.width, height: logoDims.height });
  } else {
    page.drawText(">> FASTFORWARD", { x: ML, y: H - 42, size: 16, font: bold, color: WHITE });
    page.drawText("FDA Experts  |  Miami, Florida", { x: ML, y: H - 58, size: 9, font: regular, color: GOLD });
  }
  const hw = bold.widthOfTextAtSize(t.hdr, 11);
  page.drawText(t.hdr, { x: W - MR - hw, y: H - 44, size: 11, font: bold, color: WHITE });

  // ── FOOTER ──────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: 0, width: W, height: 38, color: NAVY });
  page.drawRectangle({ x: 0, y: 38, width: W, height: 2, color: GOLD });
  page.drawText(t.ftr, { x: ML, y: 13, size: 7, font: regular, color: WHITE });
  const cw = bold.widthOfTextAtSize(t.conf, 7);
  page.drawText(t.conf, { x: W - MR - cw, y: 13, size: 7, font: bold, color: GOLD });

  let y = H - 96;

  // ── TITLE ───────────────────────────────────────────────────────
  page.drawText(t.ttl, { x: ML, y, size: 19, font: bold, color: NAVY }); y -= 20;
  page.drawText(t.sub, { x: ML, y, size: 9, font: regular, color: GRAY }); y -= 13;
  page.drawLine({ start: { x: ML, y }, end: { x: W - MR, y }, thickness: 0.5, color: BORD }); y -= 11;

  // ── INFO BOX ────────────────────────────────────────────────────
  const BOX_H = 76;
  page.drawRectangle({ x: ML, y: y - BOX_H, width: CW, height: BOX_H, color: LIGHT });
  page.drawRectangle({ x: ML, y: y - BOX_H, width: CW, height: BOX_H, borderColor: BORD, borderWidth: 0.5 });
  const col = CW / 3;

  const drawCol = (label: string, lines: string[], cx: number) => {
    page.drawText(label, { x: cx + 8, y: y - 12, size: 7, font: bold, color: GRAY });
    lines.forEach((line, i) => {
      page.drawText(line.substring(0, 34), { x: cx + 8, y: y - 23 - i * 11, size: i === 0 ? 9 : 7.5, font: i === 0 ? bold : regular, color: i === 0 ? DARK : GRAY });
    });
  };

  drawCol(t.cli, [data.clientName, data.contactName, data.contactEmail, data.contactPhone], ML);
  page.drawLine({ start: { x: ML + col, y: y - 4 }, end: { x: ML + col, y: y - BOX_H + 4 }, thickness: 0.5, color: BORD });
  drawCol(t.exp, [data.repName, t.rep, data.repEmail, "FastForward FDA Experts"], ML + col);
  page.drawLine({ start: { x: ML + col * 2, y: y - 4 }, end: { x: ML + col * 2, y: y - BOX_H + 4 }, thickness: 0.5, color: BORD });

  const cx3 = ML + col * 2 + 8;
  page.drawText(t.dat, { x: cx3, y: y - 12, size: 7, font: bold, color: GRAY });
  [[t.dte, data.dateStr],[t.vld, data.validUntil],[t.num, data.proposalNum]].forEach(([lbl, val], i) => {
    page.drawText(lbl, { x: cx3, y: y - 23 - i * 13, size: 8, font: regular, color: GRAY });
    const vw = bold.widthOfTextAtSize(val, 8);
    page.drawText(val, { x: ML + CW - 8 - vw, y: y - 23 - i * 13, size: 8, font: bold, color: DARK });
  });
  y -= BOX_H + 10;

  // ── INTRO ───────────────────────────────────────────────────────
  const introLines = wrapText(data.introText, regular, 8.5, CW - 20);
  const introH = Math.max(32, introLines.length * 12 + 10);
  page.drawRectangle({ x: ML, y: y - introH, width: CW, height: introH, color: IBLUE });
  page.drawRectangle({ x: ML, y: y - introH, width: 3, height: introH, color: NAVY });
  introLines.forEach((line, i) => {
    page.drawText(line, { x: ML + 10, y: y - 12 - i * 12, size: 8.5, font: regular, color: DARK });
  });
  y -= introH + 10;

  // ── SERVICES ────────────────────────────────────────────────────
  page.drawText(t.svc, { x: ML, y, size: 7.5, font: bold, color: NAVY }); y -= 12;

  const NW = CW * 0.27; const DW = CW * 0.57; const PW = CW * 0.16;
  page.drawRectangle({ x: ML, y: y - 20, width: CW, height: 20, color: NAVY });
  page.drawText(t.col1, { x: ML + 5, y: y - 13, size: 7.5, font: bold, color: WHITE });
  page.drawText(t.col2, { x: ML + NW + 5, y: y - 13, size: 7.5, font: bold, color: WHITE });
  const pw0 = bold.widthOfTextAtSize(t.col3, 7.5);
  page.drawText(t.col3, { x: ML + NW + DW + PW - pw0 - 4, y: y - 13, size: 7.5, font: bold, color: WHITE });
  y -= 20;

  data.services.forEach((svc, i) => {
    const nameLines = wrapText(svc.name, bold, 8.5, NW - 8);
    const descLines = wrapText(svc.description, regular, 7.5, DW - 8);
    const rowH = Math.max(nameLines.length, descLines.length) * 11 + 10;
    const rowColor = i % 2 === 0 ? WHITE : LIGHT;
    page.drawRectangle({ x: ML, y: y - rowH, width: CW, height: rowH, color: rowColor });
    page.drawRectangle({ x: ML, y: y - rowH, width: CW, height: rowH, borderColor: BORD, borderWidth: 0.3 });
    nameLines.forEach((line, li) => page.drawText(line, { x: ML + 5, y: y - 9 - li * 11, size: 8.5, font: bold, color: NAVY }));
    descLines.forEach((line, li) => page.drawText(line, { x: ML + NW + 5, y: y - 9 - li * 11, size: 7.5, font: regular, color: DARK }));
    const prStr = `$${svc.price.toLocaleString("en-US")}`;
    const prW = bold.widthOfTextAtSize(prStr, 9);
    page.drawText(prStr, { x: ML + NW + DW + PW - prW - 4, y: y - 9, size: 9, font: bold, color: NAVY });
    y -= rowH;
  });
  y -= 4;

  // Subtotal
  page.drawText(t.sub2, { x: ML, y, size: 8.5, font: regular, color: GRAY });
  const subStr = `$${subtotal.toLocaleString("en-US")}`;
  page.drawText(subStr, { x: ML + CW - bold.widthOfTextAtSize(subStr, 8.5), y, size: 8.5, font: regular, color: GRAY });
  y -= 14;

  if ((data.discount || 0) > 0) {
    page.drawRectangle({ x: ML, y: y - 18, width: CW, height: 18, color: GREEN_BG });
    page.drawText(t.dis, { x: ML + 6, y: y - 12, size: 8.5, font: bold, color: GREEN });
    const dStr = `-$${(data.discount || 0).toLocaleString("en-US")}`;
    page.drawText(dStr, { x: ML + CW - bold.widthOfTextAtSize(dStr, 8.5), y: y - 12, size: 8.5, font: bold, color: GREEN });
    y -= 22;
  }

  // Total
  page.drawRectangle({ x: ML, y: y - 30, width: CW, height: 30, color: NAVY });
  page.drawText(t.tot, { x: ML + 10, y: y - 19, size: 10, font: bold, color: WHITE });
  const totStr = `USD $${total.toLocaleString("en-US")}`;
  page.drawText(totStr, { x: ML + CW - bold.widthOfTextAtSize(totStr, 14) - 8, y: y - 21, size: 14, font: bold, color: GOLD });
  y -= 42;

  // ── TERMS 2 COLS ────────────────────────────────────────────────
  const halfW = (CW - 6) / 2;

  const leftBlocks: Array<[string, string]> = [[t.pt, t.pb],[t.tt, t.tb],[t.vt, t.vb]];
  const rightBlocks: Array<[string, string]> = [[t.nt, t.nb]];

  // Calculate heights
  const calcBlockH = (title: string, body: string, w: number): number => {
    const bodyLines = wrapText(body, regular, 7.5, w - 16);
    return 12 + 10 + bodyLines.length * 10 + 8;
  };
  const leftH  = leftBlocks.reduce((sum, [tt, tb]) => sum + calcBlockH(tt, tb, halfW), 0) + 16;
  const rightH = rightBlocks.reduce((sum, [tt, tb]) => sum + calcBlockH(tt, tb, halfW), 0) + 40;
  const termsH = Math.max(leftH, rightH);

  page.drawRectangle({ x: ML, y: y - termsH, width: halfW, height: termsH, color: LIGHT, borderColor: BORD, borderWidth: 0.5 });
  page.drawRectangle({ x: ML + halfW + 6, y: y - termsH, width: halfW, height: termsH, color: IBLUE, borderColor: BORD, borderWidth: 0.5 });

  let ly = y - 10;
  for (const [tt, tb] of leftBlocks) {
    page.drawText(tt, { x: ML + 8, y: ly, size: 8.5, font: bold, color: DARK }); ly -= 12;
    const lines = wrapText(tb, regular, 7.5, halfW - 16);
    lines.forEach(line => { page.drawText(line, { x: ML + 8, y: ly, size: 7.5, font: regular, color: DARK }); ly -= 10; });
    ly -= 8;
  }

  let ry = y - 10;
  const rx = ML + halfW + 14;
  for (const [tt, tb] of rightBlocks) {
    page.drawText(tt, { x: rx, y: ry, size: 8.5, font: bold, color: DARK }); ry -= 12;
    const lines = wrapText(tb, regular, 7.5, halfW - 16);
    lines.forEach(line => { page.drawText(line, { x: rx, y: ry, size: 7.5, font: regular, color: DARK }); ry -= 10; });
    ry -= 8;
  }
  // CTA button
  page.drawRectangle({ x: rx - 6, y: ry - 24, width: halfW - 8, height: 24, color: GOLD });
  const ctaW = bold.widthOfTextAtSize(t.cta, 8.5);
  page.drawText(t.cta, { x: rx - 6 + (halfW - 8 - ctaW) / 2, y: ry - 16, size: 8.5, font: bold, color: rgb(26/255, 28/255, 62/255) });

  y -= termsH + 14;

  // ── STATS ───────────────────────────────────────────────────────
  page.drawLine({ start: { x: ML, y }, end: { x: W - MR, y }, thickness: 0.5, color: BORD }); y -= 10;
  const SW = CW / 4;
  for (let i = 0; i < 4; i++) {
    const sx = ML + SW * i;
    const num = t.stats[i * 2]; const lbl = t.stats[i * 2 + 1];
    const nw = bold.widthOfTextAtSize(num, 13);
    page.drawText(num, { x: sx + (SW - nw) / 2, y, size: 13, font: bold, color: NAVY });
    const lw = regular.widthOfTextAtSize(lbl, 7.5);
    page.drawText(lbl, { x: sx + (SW - lw) / 2, y: y - 13, size: 7.5, font: regular, color: GRAY });
    if (i < 3) page.drawLine({ start: { x: sx + SW, y: y + 2 }, end: { x: sx + SW, y: y - 18 }, thickness: 0.5, color: BORD });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
