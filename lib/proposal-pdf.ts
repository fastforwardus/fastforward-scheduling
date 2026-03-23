import PDFDocument from "pdfkit";

const NAVY = "#27295C";
const GOLD = "#C9A84C";

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

const TRANSLATIONS = {
  es: {
    headerTitle: "PROPUESTA COMERCIAL", confidential: "CONFIDENCIAL",
    title: "Propuesta Comercial", subtitle: "Preparada exclusivamente para su empresa",
    client: "CLIENTE", expert: "EXPERTO ASIGNADO", data: "DATOS",
    date: "Fecha", validUntil: "Válida hasta", proposalNum: "Propuesta N°",
    salesRep: "Sales Representative",
    services: "SERVICIOS INCLUIDOS EN ESTA PROPUESTA",
    service: "SERVICIO", description: "DESCRIPCIÓN", price: "PRECIO USD",
    subtotal: "Subtotal", discount: "Descuento especial aplicado", total: "TOTAL DE LA PROPUESTA",
    paymentTitle: "Términos de pago",
    paymentText: "100% del total al confirmar la propuesta. Medios de pago: Tarjeta de crédito (Visa, Mastercard, Amex), Zelle, Wire Transfer / ACH, PayPal.",
    timelineTitle: "Tiempo estimado",
    timelineText: "Estimamos completar todos los servicios en 15-20 días hábiles desde la confirmación del pago.",
    validityTitle: "Validez de la propuesta", validityText: "Esta propuesta es válida por 15 días desde la fecha de emisión.",
    nextStepTitle: "Próximo paso",
    nextStepText: "Para confirmar esta propuesta responda este email o comuníquese con su asesor asignado.",
    ctaBtn: "Confirmar propuesta: scheduling.fastfwdus.com",
    stats: ["+14.000 empresas asesoradas", "+10 años de experiencia", "100% aprobaciones FDA", "Miami, Florida EE.UU."],
    footer: "FastForward Trading Company LLC  ·  Miami, Florida 33131  ·  info@fastfwdus.com  ·  fastfwdus.com",
  },
  en: {
    headerTitle: "COMMERCIAL PROPOSAL", confidential: "CONFIDENTIAL",
    title: "Commercial Proposal", subtitle: "Prepared exclusively for your company",
    client: "CLIENT", expert: "ASSIGNED EXPERT", data: "DETAILS",
    date: "Date", validUntil: "Valid until", proposalNum: "Proposal No.",
    salesRep: "Sales Representative",
    services: "SERVICES INCLUDED IN THIS PROPOSAL",
    service: "SERVICE", description: "DESCRIPTION", price: "PRICE USD",
    subtotal: "Subtotal", discount: "Special discount applied", total: "TOTAL PROPOSAL AMOUNT",
    paymentTitle: "Payment Terms",
    paymentText: "100% of the total upon confirming the proposal. Accepted payment methods: Credit card (Visa, Mastercard, Amex), Zelle, Wire Transfer / ACH, PayPal.",
    timelineTitle: "Estimated Timeline",
    timelineText: "We estimate completing all services within 15-20 business days from payment confirmation.",
    validityTitle: "Proposal Validity", validityText: "This proposal is valid for 15 days from the date of issue.",
    nextStepTitle: "Next Step",
    nextStepText: "To confirm this proposal, reply to this email or contact your assigned advisor.",
    ctaBtn: "Confirm proposal: scheduling.fastfwdus.com",
    stats: ["+14,000 companies advised", "+10 years of experience", "100% FDA approvals", "Miami, Florida USA"],
    footer: "FastForward Trading Company LLC  ·  Miami, Florida 33131  ·  info@fastfwdus.com  ·  fastfwdus.com",
  },
  pt: {
    headerTitle: "PROPOSTA COMERCIAL", confidential: "CONFIDENCIAL",
    title: "Proposta Comercial", subtitle: "Preparada exclusivamente para sua empresa",
    client: "CLIENTE", expert: "ESPECIALISTA DESIGNADO", data: "DADOS",
    date: "Data", validUntil: "Válida até", proposalNum: "Proposta N°",
    salesRep: "Representante de Vendas",
    services: "SERVIÇOS INCLUÍDOS NESTA PROPOSTA",
    service: "SERVIÇO", description: "DESCRIÇÃO", price: "PREÇO USD",
    subtotal: "Subtotal", discount: "Desconto especial aplicado", total: "TOTAL DA PROPOSTA",
    paymentTitle: "Condições de pagamento",
    paymentText: "100% do total ao confirmar a proposta. Formas de pagamento: Cartão de crédito (Visa, Mastercard, Amex), Zelle, Wire Transfer / ACH, PayPal.",
    timelineTitle: "Prazo estimado",
    timelineText: "Estimamos concluir todos os serviços em 15-20 dias úteis a partir da confirmação do pagamento.",
    validityTitle: "Validade da proposta", validityText: "Esta proposta é válida por 15 dias a partir da data de emissão.",
    nextStepTitle: "Próximo passo",
    nextStepText: "Para confirmar esta proposta, responda a este email ou entre em contato com seu consultor.",
    ctaBtn: "Confirmar proposta: scheduling.fastfwdus.com",
    stats: ["+14.000 empresas assessoradas", "+10 anos de experiência", "100% aprovações FDA", "Miami, Florida EUA"],
    footer: "FastForward Trading Company LLC  ·  Miami, Florida 33131  ·  info@fastfwdus.com  ·  fastfwdus.com",
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

export async function generateProposalPDF(data: ProposalData): Promise<Buffer> {
  const t = TRANSLATIONS[data.lang || "es"];
  const subtotal = data.services.reduce((s, svc) => s + svc.price, 0);
  const total = subtotal - (data.discount || 0);
  const W = 612; const H = 792;
  const ML = 45; const MR = 45; const CW = W - ML - MR;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margins: { top: 88, bottom: 52, left: ML, right: MR } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const navy = hexToRgb(NAVY);
    const gold = hexToRgb(GOLD);

    function drawHeader() {
      doc.rect(0, 0, W, 76).fill(NAVY);
      doc.rect(0, 76, W, 3).fill(GOLD);
      // Logo text (since we cant embed external image easily)
      doc.fillColor("white").font("Helvetica-Bold").fontSize(18).text(">> FASTFORWARD", ML, 22);
      doc.fillColor(GOLD).font("Helvetica").fontSize(10).text("FDA Experts  |  Miami, Florida", ML, 46);
      doc.fillColor("white").font("Helvetica-Bold").fontSize(11)
        .text(t.headerTitle, 0, 30, { align: "right", width: W - MR });
      doc.fillColor("white");
    }

    function drawFooter() {
      doc.rect(0, H - 38, W, 38).fill(NAVY);
      doc.rect(0, H - 40, W, 2).fill(GOLD);
      doc.fillColor("white").font("Helvetica").fontSize(7.5).text(t.footer, ML, H - 24);
      doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(7.5).text(t.confidential, 0, H - 24, { align: "right", width: W - MR });
    }

    drawHeader();

    let y = 100;

    // Title
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(20).text(t.title, ML, y); y += 26;
    doc.fillColor("#6B7280").font("Helvetica").fontSize(10).text(t.subtitle, ML, y); y += 16;
    doc.moveTo(ML, y).lineTo(W - MR, y).strokeColor("#E5E7EB").lineWidth(0.5).stroke(); y += 12;

    // Info box
    const boxH = 80;
    doc.rect(ML, y, CW, boxH).fill("#F8F9FB").stroke("#E5E7EB");
    const col = CW / 3;

    // Client
    doc.fillColor("#6B7280").font("Helvetica").fontSize(7).text(t.client, ML + 10, y + 8);
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(9.5).text(data.clientName, ML + 10, y + 18, { width: col - 15 });
    doc.fillColor("#6B7280").font("Helvetica").fontSize(8).text(data.contactName, ML + 10, y + 32, { width: col - 15 });
    doc.text(data.contactEmail, ML + 10, y + 43, { width: col - 15 });
    doc.text(data.contactPhone, ML + 10, y + 54, { width: col - 15 });

    // Rep
    const c2x = ML + col;
    doc.moveTo(c2x, y + 5).lineTo(c2x, y + boxH - 5).strokeColor("#E5E7EB").lineWidth(0.5).stroke();
    doc.fillColor("#6B7280").font("Helvetica").fontSize(7).text(t.expert, c2x + 10, y + 8);
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(9.5).text(data.repName, c2x + 10, y + 18);
    doc.fillColor("#6B7280").font("Helvetica").fontSize(8).text(t.salesRep, c2x + 10, y + 32);
    doc.text(data.repEmail, c2x + 10, y + 43);
    doc.text("FastForward FDA Experts", c2x + 10, y + 54);

    // Meta
    const c3x = ML + col * 2;
    doc.moveTo(c3x, y + 5).lineTo(c3x, y + boxH - 5).strokeColor("#E5E7EB").lineWidth(0.5).stroke();
    doc.fillColor("#6B7280").font("Helvetica").fontSize(7).text(t.data, c3x + 10, y + 8);
    const meta = [[t.date, data.dateStr], [t.validUntil, data.validUntil], [t.proposalNum, data.proposalNum]];
    meta.forEach(([label, val], i) => {
      doc.fillColor("#6B7280").font("Helvetica").fontSize(8).text(label, c3x + 10, y + 20 + i * 16);
      doc.fillColor("#111827").font("Helvetica-Bold").fontSize(8).text(val, c3x + 10, y + 20 + i * 16, { align: "right", width: col - 20 });
    });
    y += boxH + 12;

    // Intro box
    doc.rect(ML, y, CW, 36).fill("#EEF2FF");
    doc.rect(ML, y, 3, 36).fill(NAVY);
    doc.fillColor("#374151").font("Helvetica").fontSize(9).text(data.introText, ML + 12, y + 6, { width: CW - 16, height: 30 });
    y += 48;

    // Services header
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(8)
      .text(t.services, ML, y, { characterSpacing: 0.8 }); y += 14;

    // Table header
    const namW = CW * 0.28; const desW = CW * 0.57; const priW = CW * 0.15;
    doc.rect(ML, y, CW, 24).fill(NAVY);
    doc.fillColor("white").font("Helvetica-Bold").fontSize(8);
    doc.text(t.service, ML + 8, y + 8, { width: namW });
    doc.text(t.description, ML + namW + 8, y + 8, { width: desW });
    doc.text(t.price, ML + namW + desW, y + 8, { width: priW, align: "right" });
    y += 24;

    // Table rows
    data.services.forEach((svc, i) => {
      const rowH = 32;
      if (i % 2 === 0) doc.rect(ML, y, CW, rowH).fill("white");
      else doc.rect(ML, y, CW, rowH).fill("#F8F9FB");
      doc.rect(ML, y, CW, rowH).stroke("#E5E7EB");
      doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9).text(svc.name, ML + 8, y + 6, { width: namW - 10 });
      doc.fillColor("#374151").font("Helvetica").fontSize(8).text(svc.description, ML + namW + 8, y + 6, { width: desW - 10 });
      doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9.5)
        .text(`$${svc.price.toLocaleString("en-US")}`, ML + namW + desW, y + 8, { width: priW - 4, align: "right" });
      y += rowH;
    });
    y += 4;

    // Subtotal
    doc.fillColor("#6B7280").font("Helvetica").fontSize(9).text(t.subtotal, ML, y);
    doc.fillColor("#6B7280").font("Helvetica").fontSize(9).text(`$${subtotal.toLocaleString("en-US")}`, 0, y, { align: "right", width: W - MR });
    y += 16;

    // Discount
    if ((data.discount || 0) > 0) {
      doc.rect(ML, y, CW, 20).fill("#DCFCE7");
      doc.fillColor("#166534").font("Helvetica-Bold").fontSize(9).text(t.discount, ML + 8, y + 5);
      doc.text(`-$${(data.discount || 0).toLocaleString("en-US")}`, 0, y + 5, { align: "right", width: W - MR });
      y += 24;
    }

    // Total
    doc.rect(ML, y, CW, 34).fill(NAVY);
    doc.fillColor("white").font("Helvetica-Bold").fontSize(11).text(t.total, ML + 12, y + 10);
    doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(16)
      .text(`USD $${total.toLocaleString("en-US")}`, 0, y + 8, { align: "right", width: W - MR });
    y += 46;

    // Terms 2 columns
    const halfW = (CW - 8) / 2;
    const termsY = y;
    // Left col
    doc.rect(ML, termsY, halfW, 110).fill("#F8F9FB").stroke("#E5E7EB");
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(9).text(t.paymentTitle, ML + 10, termsY + 8);
    doc.fillColor("#374151").font("Helvetica").fontSize(8).text(t.paymentText, ML + 10, termsY + 20, { width: halfW - 15 });
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(9).text(t.timelineTitle, ML + 10, termsY + 55);
    doc.fillColor("#374151").font("Helvetica").fontSize(8).text(t.timelineText, ML + 10, termsY + 67, { width: halfW - 15 });
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(9).text(t.validityTitle, ML + 10, termsY + 90);
    doc.fillColor("#374151").font("Helvetica").fontSize(8).text(t.validityText, ML + 10, termsY + 100, { width: halfW - 15 });

    // Right col
    const rx = ML + halfW + 8;
    doc.rect(rx, termsY, halfW, 110).fill("#EEF2FF").stroke("#E5E7EB");
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(9).text(t.nextStepTitle, rx + 10, termsY + 8);
    doc.fillColor("#374151").font("Helvetica").fontSize(8).text(t.nextStepText, rx + 10, termsY + 20, { width: halfW - 15 });
    doc.rect(rx + 10, termsY + 68, halfW - 20, 26).fill(GOLD);
    doc.fillColor("#1A1C3E").font("Helvetica-Bold").fontSize(9).text(t.ctaBtn, rx + 10, termsY + 76, { width: halfW - 20, align: "center" });
    y = termsY + 122;

    // Stats
    doc.moveTo(ML, y).lineTo(W - MR, y).strokeColor("#E5E7EB").lineWidth(0.5).stroke(); y += 10;
    const sw = CW / 4;
    t.stats.forEach((stat, i) => {
      const sx = ML + sw * i;
      const [num, ...rest] = stat.split(" ");
      doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(14).text(num, sx, y, { width: sw, align: "center" });
      doc.fillColor("#6B7280").font("Helvetica").fontSize(8).text(rest.join(" "), sx, y + 18, { width: sw, align: "center" });
      if (i < 3) doc.moveTo(sx + sw, y - 2).lineTo(sx + sw, y + 30).strokeColor("#E5E7EB").lineWidth(0.5).stroke();
    });

    drawFooter();
    doc.end();
  });
}
