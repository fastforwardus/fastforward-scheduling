"use client";
import React from "react";
import {
  Document, Page, Text, View, StyleSheet, Image, pdf,
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

const TRANSLATIONS = {
  es: {
    headerTitle: "PROPUESTA COMERCIAL",
    confidential: "CONFIDENCIAL",
    title: "Propuesta Comercial",
    subtitle: "Preparada exclusivamente para su empresa",
    client: "CLIENTE", expert: "EXPERTO ASIGNADO", data: "DATOS",
    date: "Fecha", validUntil: "V\u00e1lida hasta", proposalNum: "Propuesta N\u00b0",
    salesRep: "Sales Representative",
    services: "SERVICIOS INCLUIDOS EN ESTA PROPUESTA",
    service: "SERVICIO", description: "DESCRIPCI\u00d3N", price: "PRECIO USD",
    subtotal: "Subtotal", discount: "Descuento especial aplicado",
    total: "TOTAL DE LA PROPUESTA",
    paymentTitle: "T\u00e9rminos de pago",
    paymentText: "100% del total al confirmar la propuesta. Medios de pago: Tarjeta de cr\u00e9dito (Visa, Mastercard, Amex), Zelle, Wire Transfer / ACH, PayPal.",
    timelineTitle: "Tiempo estimado",
    timelineText: "Estimamos completar todos los servicios en 15-20 d\u00edas h\u00e1biles desde la confirmaci\u00f3n del pago. Este plazo contempla revisi\u00f3n, coordinaci\u00f3n con la FDA y eventuales ajustes.",
    validityTitle: "Validez de la propuesta",
    validityText: "Esta propuesta es v\u00e1lida por 15 d\u00edas desde la fecha de emisi\u00f3n.",
    nextStepTitle: "Pr\u00f3ximo paso",
    nextStepText: "Para confirmar esta propuesta y dar inicio a sus tr\u00e1mites, responda este email o comun\u00edquese directamente con su asesor asignado.",
    ctaBtn: "Confirmar y agendar reuni\u00f3n",
    stats: ["+14.000", "empresas asesoradas", "+10 a\u00f1os", "de experiencia", "100%", "aprobaciones FDA", "Miami, FL", "Estados Unidos"],
    footer: "FastForward Trading Company LLC  \u00b7  Miami, Florida 33131  \u00b7  info@fastfwdus.com  \u00b7  fastfwdus.com",
  },
  en: {
    headerTitle: "COMMERCIAL PROPOSAL",
    confidential: "CONFIDENTIAL",
    title: "Commercial Proposal",
    subtitle: "Prepared exclusively for your company",
    client: "CLIENT", expert: "ASSIGNED EXPERT", data: "DETAILS",
    date: "Date", validUntil: "Valid until", proposalNum: "Proposal No.",
    salesRep: "Sales Representative",
    services: "SERVICES INCLUDED IN THIS PROPOSAL",
    service: "SERVICE", description: "DESCRIPTION", price: "PRICE USD",
    subtotal: "Subtotal", discount: "Special discount applied",
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
    footer: "FastForward Trading Company LLC  \u00b7  Miami, Florida 33131  \u00b7  info@fastfwdus.com  \u00b7  fastfwdus.com",
  },
  pt: {
    headerTitle: "PROPOSTA COMERCIAL",
    confidential: "CONFIDENCIAL",
    title: "Proposta Comercial",
    subtitle: "Preparada exclusivamente para sua empresa",
    client: "CLIENTE", expert: "ESPECIALISTA DESIGNADO", data: "DADOS",
    date: "Data", validUntil: "V\u00e1lida at\u00e9", proposalNum: "Proposta N\u00b0",
    salesRep: "Representante de Vendas",
    services: "SERVI\u00c7OS INCLU\u00cdDOS NESTA PROPOSTA",
    service: "SERVI\u00c7O", description: "DESCRI\u00c7\u00c3O", price: "PRE\u00c7O USD",
    subtotal: "Subtotal", discount: "Desconto especial aplicado",
    total: "TOTAL DA PROPOSTA",
    paymentTitle: "Condi\u00e7\u00f5es de pagamento",
    paymentText: "100% do total ao confirmar a proposta. Formas de pagamento: Cart\u00e3o de cr\u00e9dito (Visa, Mastercard, Amex), Zelle, Wire Transfer / ACH, PayPal.",
    timelineTitle: "Prazo estimado",
    timelineText: "Estimamos concluir todos os servi\u00e7os em 15-20 dias \u00fateis a partir da confirma\u00e7\u00e3o do pagamento. Este prazo inclui revis\u00e3o, coordena\u00e7\u00e3o com a FDA e eventuais ajustes.",
    validityTitle: "Validade da proposta",
    validityText: "Esta proposta \u00e9 v\u00e1lida por 15 dias a partir da data de emiss\u00e3o.",
    nextStepTitle: "Pr\u00f3ximo passo",
    nextStepText: "Para confirmar esta proposta e iniciar seus tr\u00e2mites, responda a este email ou entre em contato diretamente com seu consultor designado.",
    ctaBtn: "Confirmar e agendar reuni\u00e3o",
    stats: ["+14.000", "empresas assessoradas", "+10 anos", "de experi\u00eancia", "100%", "aprova\u00e7\u00f5es FDA", "Miami, FL", "Estados Unidos"],
    footer: "FastForward Trading Company LLC  \u00b7  Miami, Florida 33131  \u00b7  info@fastfwdus.com  \u00b7  fastfwdus.com",
  },
};

const styles = StyleSheet.create({
  page:         { fontFamily: "Helvetica", backgroundColor: "#FFFFFF", paddingTop: 88, paddingBottom: 52, paddingHorizontal: 40 },
  header:       { position: "absolute", top: 0, left: 0, right: 0, height: 78, backgroundColor: NAVY },
  headerAccent: { position: "absolute", top: 76, left: 0, right: 0, height: 3, backgroundColor: GOLD },
  logo:         { position: "absolute", top: 20, left: 40, width: 140, height: 36 },
  headerRight:  { position: "absolute", top: 26, right: 40 },
  headerTitle:  { color: "#FFFFFF", fontSize: 12, fontFamily: "Helvetica-Bold", textAlign: "right" },
  footer:       { position: "absolute", bottom: 0, left: 0, right: 0, height: 38, backgroundColor: NAVY },
  footerAccent: { position: "absolute", bottom: 36, left: 0, right: 0, height: 2, backgroundColor: GOLD },
  footerText:   { position: "absolute", bottom: 12, left: 40, color: "#FFFFFF", fontSize: 7.5 },
  footerRight:  { position: "absolute", bottom: 12, right: 40, color: GOLD, fontSize: 7.5, fontFamily: "Helvetica-Bold" },
  h1:           { fontSize: 20, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 3 },
  subtitle:     { fontSize: 9.5, color: GRAY, marginBottom: 10 },
  divider:      { borderBottomWidth: 0.5, borderBottomColor: BORDER, marginBottom: 10 },
  infoBox:      { flexDirection: "row", backgroundColor: LIGHT, borderWidth: 0.5, borderColor: BORDER, marginBottom: 10 },
  infoCol:      { flex: 1, padding: 10, borderRightWidth: 0.5, borderRightColor: BORDER },
  infoColLast:  { flex: 1, padding: 10 },
  infoLabel:    { fontSize: 7, color: GRAY, marginBottom: 2, textTransform: "uppercase" },
  infoName:     { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 1.5 },
  infoText:     { fontSize: 8.5, color: GRAY, marginBottom: 1 },
  metaRow:      { flexDirection: "row", justifyContent: "space-between", marginBottom: 1.5 },
  metaLabel:    { fontSize: 8, color: GRAY },
  metaValue:    { fontSize: 8, fontFamily: "Helvetica-Bold", color: DARK },
  introBox:     { backgroundColor: INDIGO, borderLeftWidth: 3, borderLeftColor: NAVY, padding: 10, marginBottom: 12 },
  introText:    { fontSize: 9, color: "#374151", lineHeight: 1.5 },
  secLabel:     { fontSize: 8, fontFamily: "Helvetica-Bold", color: NAVY, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 },
  tableBox:     { borderWidth: 0.5, borderColor: BORDER, marginBottom: 3 },
  tableHeader:  { flexDirection: "row", backgroundColor: NAVY, paddingVertical: 7, paddingHorizontal: 8 },
  tableRow:     { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: BORDER, backgroundColor: "#FFFFFF" },
  tableRowAlt:  { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: BORDER, backgroundColor: LIGHT },
  colName:      { width: "30%", paddingRight: 6 },
  colDesc:      { width: "56%", paddingRight: 6 },
  colPrice:     { width: "14%", textAlign: "right" },
  thText:       { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  tdName:       { fontSize: 9, fontFamily: "Helvetica-Bold", color: NAVY, lineHeight: 1.3 },
  tdDesc:       { fontSize: 8, color: "#374151", lineHeight: 1.3 },
  tdPrice:      { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: NAVY, textAlign: "right" },
  subRow:       { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 4 },
  subText:      { fontSize: 9, color: GRAY },
  discRow:      { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 5, backgroundColor: GREEN_BG, borderWidth: 0.5, borderColor: "#86EFAC", marginBottom: 3 },
  discText:     { fontSize: 9, fontFamily: "Helvetica-Bold", color: GREEN },
  totalRow:     { flexDirection: "row", justifyContent: "space-between", backgroundColor: NAVY, paddingHorizontal: 12, paddingVertical: 10, alignItems: "center", marginBottom: 12 },
  totalLabel:   { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  totalAmt:     { fontSize: 15, fontFamily: "Helvetica-Bold", color: GOLD },
  termsRow:     { flexDirection: "row", marginBottom: 12 },
  termsCol:     { flex: 1, backgroundColor: LIGHT, padding: 11, borderWidth: 0.5, borderColor: BORDER },
  ctaCol:       { flex: 1, backgroundColor: INDIGO, padding: 11, borderWidth: 0.5, borderLeftWidth: 0, borderColor: BORDER },
  termTitle:    { fontSize: 9, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 3 },
  termText:     { fontSize: 8, color: "#374151", lineHeight: 1.4, marginBottom: 8 },
  ctaBtn:       { backgroundColor: GOLD, paddingVertical: 8, paddingHorizontal: 10, marginTop: 6, marginBottom: 4 },
  ctaBtnText:   { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#1A1C3E", textAlign: "center" },
  statsRow:     { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 10 },
  statCol:      { flex: 1, alignItems: "center", borderRightWidth: 0.5, borderRightColor: BORDER },
  statColLast:  { flex: 1, alignItems: "center" },
  statNum:      { fontSize: 14, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 1 },
  statLabel:    { fontSize: 7.5, color: GRAY, textAlign: "center" },
});

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
  const t = TRANSLATIONS[data.lang || "es"];
  const subtotal = data.services.reduce((s, svc) => s + svc.price, 0);
  const total = subtotal - (data.discount || 0);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header} fixed />
        <View style={styles.headerAccent} fixed />
        <Image style={styles.logo} src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" />
        <View style={styles.headerRight} fixed>
          <Text style={styles.headerTitle}>{t.headerTitle}</Text>
        </View>
        <View style={styles.footer} fixed />
        <View style={styles.footerAccent} fixed />
        <Text style={styles.footerText} fixed>{t.footer}</Text>
        <Text style={styles.footerRight} fixed>{t.confidential}</Text>

        <Text style={styles.h1}>{t.title}</Text>
        <Text style={styles.subtitle}>{t.subtitle}</Text>
        <View style={styles.divider} />

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

        <View style={styles.introBox}>
          <Text style={styles.introText}>{data.introText}</Text>
        </View>

        <Text style={styles.secLabel}>{t.services}</Text>
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

        <View style={styles.subRow}>
          <Text style={styles.subText}>{t.subtotal}</Text>
          <Text style={styles.subText}>${subtotal.toLocaleString("en-US")}</Text>
        </View>

        {(data.discount || 0) > 0 && (
          <View style={styles.discRow}>
            <Text style={styles.discText}>{t.discount}</Text>
            <Text style={styles.discText}>-${(data.discount || 0).toLocaleString("en-US")}</Text>
          </View>
        )}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t.total}</Text>
          <Text style={styles.totalAmt}>USD ${total.toLocaleString("en-US")}</Text>
        </View>

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
            <Text style={[styles.termText, { marginBottom: 4 }]}>{t.nextStepText}</Text>
            <View style={styles.ctaBtn}>
              <Text style={styles.ctaBtnText}>{t.ctaBtn}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          {[[t.stats[0], t.stats[1]], [t.stats[2], t.stats[3]], [t.stats[4], t.stats[5]], [t.stats[6], t.stats[7]]].map(([val, label], i) => (
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
