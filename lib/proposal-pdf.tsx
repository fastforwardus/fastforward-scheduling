import React from "react";
import {
  Document, Page, Text, View, StyleSheet, Image,
  pdf,
} from "@react-pdf/renderer";

const NAVY = "#27295C";
const GOLD = "#C9A84C";
const LIGHT = "#F8F9FB";
const GRAY = "#6B7280";
const BORDER = "#E5E7EB";
const DARK = "#111827";
const GREEN = "#166534";
const GREEN_BG = "#DCFCE7";
const INDIGO = "#EEF2FF";

const styles = StyleSheet.create({
  page:         { fontFamily: "Helvetica", backgroundColor: "#FFFFFF", paddingTop: 88, paddingBottom: 52, paddingHorizontal: 40 },
  // Header
  header:       { position: "absolute", top: 0, left: 0, right: 0, height: 78, backgroundColor: NAVY },
  headerAccent: { position: "absolute", top: 76, left: 0, right: 0, height: 3, backgroundColor: GOLD },
  logo:         { position: "absolute", top: 20, left: 40, width: 140, height: 36, objectFit: "contain" },
  headerRight:  { position: "absolute", top: 22, right: 40 },
  headerTitle:  { color: "#FFFFFF", fontSize: 12, fontFamily: "Helvetica-Bold", textAlign: "right" },
  // Footer
  footer:       { position: "absolute", bottom: 0, left: 0, right: 0, height: 38, backgroundColor: NAVY },
  footerAccent: { position: "absolute", bottom: 36, left: 0, right: 0, height: 2, backgroundColor: GOLD },
  footerText:   { position: "absolute", bottom: 12, left: 40, color: "#FFFFFF", fontSize: 7.5 },
  footerRight:  { position: "absolute", bottom: 12, right: 40, color: GOLD, fontSize: 7.5, fontFamily: "Helvetica-Bold" },
  // Title area
  h1:           { fontSize: 22, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 4 },
  subtitle:     { fontSize: 10, color: GRAY, marginBottom: 12 },
  divider:      { borderBottomWidth: 0.5, borderBottomColor: BORDER, marginBottom: 14 },
  // Sections
  secLabel:     { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: NAVY, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 16, marginBottom: 6 },
  // Info block
  infoBox:      { flexDirection: "row", backgroundColor: LIGHT, borderWidth: 0.5, borderColor: BORDER, marginBottom: 12 },
  infoCol:      { flex: 1, padding: 12, borderRightWidth: 0.5, borderRightColor: BORDER },
  infoColLast:  { flex: 1, padding: 12 },
  infoLabel:    { fontSize: 7.5, color: GRAY, marginBottom: 3, textTransform: "uppercase" },
  infoName:     { fontSize: 10, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 2 },
  infoText:     { fontSize: 9, color: GRAY, marginBottom: 1 },
  metaRow:      { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  metaLabel:    { fontSize: 8.5, color: GRAY },
  metaValue:    { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: DARK },
  // Intro
  introBox:     { backgroundColor: INDIGO, borderLeftWidth: 3, borderLeftColor: NAVY, padding: 12, marginBottom: 16 },
  introText:    { fontSize: 9.5, color: "#374151", lineHeight: 1.5 },
  // Services table
  tableHeader:  { flexDirection: "row", backgroundColor: NAVY, paddingVertical: 8, paddingHorizontal: 10 },
  tableRow:     { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  tableRowAlt:  { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 0.5, borderBottomColor: BORDER, backgroundColor: LIGHT },
  colName:      { width: "30%", paddingRight: 8 },
  colDesc:      { width: "56%", paddingRight: 8 },
  colPrice:     { width: "14%", textAlign: "right" },
  thText:       { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  tdName:       { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: NAVY, lineHeight: 1.4 },
  tdDesc:       { fontSize: 8.5, color: "#374151", lineHeight: 1.4 },
  tdPrice:      { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: NAVY, textAlign: "right" },
  tableBox:     { borderWidth: 0.5, borderColor: BORDER, marginBottom: 4 },
  // Subtotal / discount / total
  subRow:       { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 5 },
  subLabel:     { fontSize: 9.5, color: GRAY },
  subAmt:       { fontSize: 9.5, color: GRAY },
  discRow:      { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 6, backgroundColor: GREEN_BG, borderWidth: 0.5, borderColor: "#86EFAC", marginBottom: 4 },
  discLabel:    { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: GREEN },
  discAmt:      { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: GREEN },
  totalRow:     { flexDirection: "row", justifyContent: "space-between", backgroundColor: NAVY, paddingHorizontal: 14, paddingVertical: 12, alignItems: "center", marginBottom: 18 },
  totalLabel:   { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  totalAmt:     { fontSize: 16, fontFamily: "Helvetica-Bold", color: GOLD },
  // Terms + CTA
  termsRow:     { flexDirection: "row", marginBottom: 18 },
  termsCol:     { flex: 1, backgroundColor: LIGHT, padding: 14, borderWidth: 0.5, borderColor: BORDER, borderRightWidth: 0, marginRight: 0 },
  ctaCol:       { flex: 1, backgroundColor: INDIGO, padding: 14, borderWidth: 0.5, borderColor: BORDER },
  termTitle:    { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 4 },
  termText:     { fontSize: 8.5, color: "#374151", lineHeight: 1.5, marginBottom: 10 },
  ctaBtn:       { backgroundColor: GOLD, paddingVertical: 10, paddingHorizontal: 14, marginTop: 8, marginBottom: 6 },
  ctaBtnText:   { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: "#1A1C3E", textAlign: "center" },
  ctaUrl:       { fontSize: 7.5, color: GOLD, textAlign: "center" },
  // Stats
  statsRow:     { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 12 },
  statCol:      { flex: 1, alignItems: "center", borderRightWidth: 0.5, borderRightColor: BORDER },
  statColLast:  { flex: 1, alignItems: "center" },
  statNum:      { fontSize: 16, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 2 },
  statLabel:    { fontSize: 8, color: GRAY, textAlign: "center" },
});


const TRANSLATIONS = {
  es: {
    title: "Propuesta Comercial",
    subtitle: "Preparada exclusivamente para su empresa",
    client: "CLIENTE",
    expert: "EXPERTO ASIGNADO",
    data: "DATOS",
    date: "Fecha",
    validUntil: "Válida hasta",
    proposalNum: "Propuesta N°",
    services: "{t.services}",
    service: "SERVICIO",
    description: "DESCRIPCIÓN",
    price: "PRECIO USD",
    subtotal: "Subtotal",
    discount: "Descuento especial aplicado",
    total: "TOTAL DE LA PROPUESTA",
    paymentTitle: "Términos de pago",
    paymentText: "100% del total al confirmar la propuesta. Medios de pago aceptados: Tarjeta de crédito (Visa, Mastercard, Amex), Zelle, Wire Transfer / ACH, PayPal.",
    timelineTitle: "Tiempo estimado",
    timelineText: "Estimamos completar todos los servicios en 15-20 días hábiles desde la confirmación del pago. Este plazo contempla revisión, coordinación con la FDA y eventuales ajustes.",
    validityTitle: "Validez de la propuesta",
    validityText: "Esta propuesta es válida por 15 días desde la fecha de emisión.",
    nextStepTitle: "Próximo paso",
    nextStepText: "Para confirmar esta propuesta y dar inicio a sus trámites, responda este email o comuníquese directamente con su asesor asignado.",
    ctaBtn: "Confirmar y agendar reunión",
    stats: ["+14,000", "empresas asesoradas", "+10 años", "de experiencia", "100%", "aprobaciones FDA", "Miami, FL", "Estados Unidos"],
    confidential: "CONFIDENCIAL",
    footerText: "FastForward Trading Company LLC  ·  Miami, Florida 33131  ·  info@fastfwdus.com  ·  fastfwdus.com",
    headerTitle: "PROPUESTA COMERCIAL",
    salesRep: "Sales Representative",
  },
  en: {
    title: "Commercial Proposal",
    subtitle: "Prepared exclusively for your company",
    client: "CLIENT",
    expert: "ASSIGNED EXPERT",
    data: "DETAILS",
    date: "Date",
    validUntil: "Valid until",
    proposalNum: "Proposal No.",
    services: "SERVICES INCLUDED IN THIS PROPOSAL",
    service: "SERVICE",
    description: "DESCRIPTION",
    price: "PRICE USD",
    subtotal: "Subtotal",
    discount: "Special discount applied",
    total: "TOTAL PROPOSAL AMOUNT",
    paymentTitle: "Payment Terms",
    paymentText: "100% of the total upon confirming the proposal. Accepted payment methods: Credit card (Visa, Mastercard, Amex), Zelle, Wire Transfer / ACH, PayPal.",
    timelineTitle: "Estimated Timeline",
    timelineText: "We estimate completing all services within 15-20 business days from payment confirmation. This timeframe includes review, FDA coordination, and any adjustments.",
    validityTitle: "Proposal Validity",
    validityText: "This proposal is valid for 15 days from the date of issue.",
    nextStepTitle: "Next Step",
    nextStepText: "To confirm this proposal and begin your registration process, reply to this email or contact your assigned advisor directly.",
    ctaBtn: "Confirm and schedule meeting",
    stats: ["+14,000", "companies advised", "+10 years", "of experience", "100%", "FDA approvals", "Miami, FL", "United States"],
    confidential: "CONFIDENTIAL",
    footerText: "FastForward Trading Company LLC  ·  Miami, Florida 33131  ·  info@fastfwdus.com  ·  fastfwdus.com",
    headerTitle: "COMMERCIAL PROPOSAL",
    salesRep: "Sales Representative",
  },
  pt: {
    title: "Proposta Comercial",
    subtitle: "Preparada exclusivamente para sua empresa",
    client: "CLIENTE",
    expert: "ESPECIALISTA DESIGNADO",
    data: "DADOS",
    date: "Data",
    validUntil: "Válida até",
    proposalNum: "Proposta N°",
    services: "SERVIÇOS INCLUÍDOS NESTA PROPOSTA",
    service: "SERVIÇO",
    description: "DESCRIÇÃO",
    price: "PREÇO USD",
    subtotal: "Subtotal",
    discount: "Desconto especial aplicado",
    total: "TOTAL DA PROPOSTA",
    paymentTitle: "Condições de pagamento",
    paymentText: "100% do total ao confirmar a proposta. Formas de pagamento aceitas: Cartão de crédito (Visa, Mastercard, Amex), Zelle, Wire Transfer / ACH, PayPal.",
    timelineTitle: "Prazo estimado",
    timelineText: "Estimamos concluir todos os serviços em 15-20 dias úteis a partir da confirmação do pagamento. Este prazo inclui revisão, coordenação com a FDA e eventuais ajustes.",
    validityTitle: "Validade da proposta",
    validityText: "Esta proposta é válida por 15 dias a partir da data de emissão.",
    nextStepTitle: "Próximo passo",
    nextStepText: "Para confirmar esta proposta e iniciar seus trâmites, responda a este email ou entre em contato diretamente com seu consultor designado.",
    ctaBtn: "Confirmar e agendar reunião",
    stats: ["+14.000", "empresas assessoradas", "+10 anos", "de experiência", "100%", "aprovações FDA", "Miami, FL", "Estados Unidos"],
    confidential: "CONFIDENCIAL",
    footerText: "FastForward Trading Company LLC  ·  Miami, Florida 33131  ·  info@fastfwdus.com  ·  fastfwdus.com",
    headerTitle: "PROPOSTA COMERCIAL",
    salesRep: "Representante de Vendas",
  },
};

export interface ProposalService {
  name: string;
  description: string;
  price: number;
}

export interface ProposalData {
  clientName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  repName: string;
  repEmail: string;
  repSlug: string;
  proposalNum: string;
  dateStr: string;
  validUntil: string;
  introText: string;
  services: ProposalService[];
  discount: number;
  emailText?: string;
  lang?: "es" | "en" | "pt";
}

export function ProposalDocument({ data }: { data: ProposalData }) {
  const subtotal = data.services.reduce((s, svc) => s + svc.price, 0);
  const total = subtotal - (data.discount || 0);
  const t = TRANSLATIONS[data.lang || "es"];

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed />
        <View style={styles.headerAccent} fixed />
        <Image
          style={styles.logo}
          src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png"
        />
        <View style={styles.headerRight} fixed>
          <Text style={styles.headerTitle}>{t.headerTitle}</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed />
        <View style={styles.footerAccent} fixed />
        <Text style={styles.footerText} fixed>
          FastForward Trading Company LLC  ·  Miami, Florida 33131  ·  info@fastfwdus.com  ·  fastfwdus.com
        </Text>
        <Text style={styles.footerRight} fixed>{t.confidential}</Text>

        {/* Title */}
        <Text style={styles.h1}>{t.title}</Text>
        <Text style={styles.subtitle}>{t.subtitle}</Text>
        <View style={styles.divider} />

        {/* Client + Meta */}
        <View style={styles.infoBox}>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>{t.client}</Text>
            <Text style={styles.infoName}>{data.clientName}</Text>
            <Text style={styles.infoText}>{data.contactName}</Text>
            <Text style={styles.infoText}>{data.contactEmail}</Text>
            <Text style={styles.infoText}>{data.contactPhone}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>{t.expert}</Text>
            <Text style={styles.infoName}>{data.repName}</Text>
            <Text style={styles.infoText}>{t.salesRep}</Text>
            <Text style={styles.infoText}>{data.repEmail}</Text>
            <Text style={styles.infoText}>FastForward FDA Experts</Text>
          </View>
          <View style={styles.infoColLast}>
            <Text style={styles.infoLabel}>{t.data}</Text>
            <View style={styles.metaRow}><Text style={styles.metaLabel}>{t.date}</Text><Text style={styles.metaValue}>{data.dateStr}</Text></View>
            <View style={styles.metaRow}><Text style={styles.metaLabel}>{t.validUntil}</Text><Text style={styles.metaValue}>{data.validUntil}</Text></View>
            <View style={styles.metaRow}><Text style={styles.metaLabel}>{t.proposalNum}</Text><Text style={styles.metaValue}>{data.proposalNum}</Text></View>
          </View>
        </View>

        {/* Intro */}
        <View style={styles.introBox}>
          <Text style={styles.introText}>{data.introText}</Text>
        </View>

        {/* Services */}
        <Text style={styles.secLabel}>Servicios incluidos en esta propuesta</Text>
        <View style={styles.tableBox}>
          <View style={styles.tableHeader}>
            <Text style={[styles.thText, styles.colName]}>{t.service}</Text>
            <Text style={[styles.thText, styles.colDesc]}>{t.description}</Text>
            <Text style={[styles.thText, styles.colPrice]}>{t.price}</Text>
          </View>
          {data.services.map((svc, i) => (
            <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={[styles.tdName, styles.colName]}>{svc.name}</Text>
              <Text style={[styles.tdDesc, styles.colDesc]}>{svc.description}</Text>
              <Text style={[styles.tdPrice, styles.colPrice]}>${svc.price.toLocaleString("en-US")}</Text>
            </View>
          ))}
        </View>

        {/* Subtotal */}
        <View style={styles.subRow}>
          <Text style={styles.subLabel}>{t.subtotal}</Text>
          <Text style={styles.subAmt}>${subtotal.toLocaleString("en-US")}</Text>
        </View>

        {/* Discount */}
        {data.discount > 0 && (
          <View style={styles.discRow}>
            <Text style={styles.discLabel}>{t.discount}</Text>
            <Text style={styles.discAmt}>-${data.discount.toLocaleString("en-US")}</Text>
          </View>
        )}

        {/* Total */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t.total}</Text>
          <Text style={styles.totalAmt}>USD ${total.toLocaleString("en-US")}</Text>
        </View>

        {/* Terms + CTA */}
        <View style={styles.termsRow}>
          <View style={styles.termsCol}>
            <Text style={styles.termTitle}>{t.paymentTitle}</Text>
            <Text style={styles.termText}>{t.paymentText}</Text>
            <Text style={styles.termTitle}>{t.timelineTitle}</Text>
            <Text style={styles.termText}>{t.timelineText}</Text>
            <Text style={styles.termTitle}>{t.validityTitle}</Text>
            <Text style={styles.termText}>{t.validityText}</Text>
          </View>
          <View style={styles.ctaCol}>
            <Text style={styles.termTitle}>{t.nextStepTitle}</Text>
            <Text style={[styles.termText, { marginBottom: 6 }]}>{t.nextStepText}</Text>
            <View style={styles.ctaBtn}>
              <Text style={styles.ctaBtnText}>{t.ctaBtn}</Text>
            </View>
            <Text style={styles.ctaUrl}>scheduling.fastfwdus.com/book/{data.repSlug}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            [t.stats[0], t.stats[1]],
            [t.stats[2], t.stats[3]],
            [t.stats[4], t.stats[5]],
            [t.stats[6], t.stats[7]],
          ].map(([val, label], i) => (
            <View key={i} style={i < 3 ? styles.statCol : styles.statColLast}>
              <Text style={styles.statNum}>{val}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

export async function generateProposalPDF(data: ProposalData): Promise<Buffer> {
  const blob = await pdf(<ProposalDocument data={data} />).toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
