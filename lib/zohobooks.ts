import { db } from "@/db";
import { systemConfig } from "@/db/schema";
import { eq } from "drizzle-orm";

const ZOHO_TOKEN_URL = "https://accounts.zoho.com/oauth/v2/token";
const ZOHO_BOOKS_BASE = "https://www.zohoapis.com/books/v3";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getStoredRefreshToken(): Promise<string> {
  // Primero intentar desde DB
  try {
    const [row] = await db.select().from(systemConfig)
      .where(eq(systemConfig.key, "ZOHO_REFRESH_TOKEN")).limit(1);
    if (row?.value) return row.value;
  } catch {}
  // Fallback a env var
  return process.env.ZOHO_REFRESH_TOKEN!;
}

async function storeRefreshToken(token: string): Promise<void> {
  try {
    await db.insert(systemConfig)
      .values({ key: "ZOHO_REFRESH_TOKEN", value: token })
      .onConflictDoUpdate({ target: systemConfig.key, set: { value: token } });
  } catch (err) {
    console.error("Error storing Zoho refresh token:", err);
  }
}

export async function getZohoBooksToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  const refreshToken = await getStoredRefreshToken();

  const res = await fetch(ZOHO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.ZOHO_CLIENT_ID!,
      client_secret: process.env.ZOHO_CLIENT_SECRET!,
      refresh_token: refreshToken,
    }),
  });

  const text = await res.text();
  let data: Record<string, string>;
  try { data = JSON.parse(text); } catch { throw new Error(`Zoho token parse error: ${text}`); }

  if (!data.access_token) throw new Error(`Zoho Books token error: ${JSON.stringify(data)}`);

  // Si Zoho rotó el refresh token, guardarlo
  if (data.refresh_token && data.refresh_token !== refreshToken) {
    await storeRefreshToken(data.refresh_token);
    console.log("Zoho refresh token rotado y guardado en DB");
  }

  cachedToken = { token: data.access_token, expiresAt: Date.now() + 3600 * 1000 };
  return data.access_token;
}

function orgId(): string {
  const id = process.env.ZOHO_BOOKS_ORG_ID;
  if (!id) throw new Error("ZOHO_BOOKS_ORG_ID no configurado");
  return id;
}

async function booksReq(method: string, path: string, body?: unknown) {
  const token = await getZohoBooksToken();
  const url = `${ZOHO_BOOKS_BASE}${path}${path.includes("?") ? "&" : "?"}organization_id=${orgId()}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
      Accept: "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { throw new Error(`Zoho Books parse error: ${text}`); }
}

export async function findOrCreateZohoBooksContact(params: {
  name: string;
  email: string;
  company?: string;
  phone?: string;
}): Promise<{ contact_id: string }> {
  const token = await getZohoBooksToken();
  const searchRes = await fetch(
    `${ZOHO_BOOKS_BASE}/contacts?organization_id=${orgId()}&email=${encodeURIComponent(params.email)}`,
    { headers: { Authorization: `Zoho-oauthtoken ${token}`, Accept: "application/json" } }
  );
  const searchText = await searchRes.text();
  const searchData = searchText ? JSON.parse(searchText) : null;
  const existing = searchData?.contacts?.[0];
  if (existing) return { contact_id: existing.contact_id };

  const data = await booksReq("POST", "/contacts", {
    contact_name: params.name,
    company_name: params.company || params.name,
    contact_type: "customer",
    email: params.email,
    ...(params.phone ? { mobile: params.phone } : {}),
  });

  if (data?.contact?.contact_id) return { contact_id: data.contact.contact_id };

  // Si falla por duplicado de nombre, buscar por nombre
  if (data?.code === 3062) {
    const token = await getZohoBooksToken();
    const nameRes = await fetch(
      `${ZOHO_BOOKS_BASE}/contacts?organization_id=${orgId()}&contact_name=${encodeURIComponent(params.name)}`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}`, Accept: "application/json" } }
    );
    const nameText = await nameRes.text();
    const nameData = nameText ? JSON.parse(nameText) : null;
    const found = nameData?.contacts?.[0];
    if (found) return { contact_id: found.contact_id };
  }

  throw new Error(`No se pudo crear contacto en Zoho Books: ${JSON.stringify(data)}`);
}

export interface ZBLineItem {
  name: string;
  rate: number;
  quantity?: number;
}

export async function createZohoBooksInvoice(params: {
  contactId: string;
  invoiceNumber: string;
  lineItems: ZBLineItem[];
  notes?: string;
}): Promise<{ invoice_id: string; invoice_number: string; total: number; invoice_url: string }> {
  const data = await booksReq("POST", "/invoices", {
    customer_id: params.contactId,
    reference_number: params.invoiceNumber,
    payment_options: {
      payment_gateways: [{ gateway_name: "stripe", configured: true }],
    },
    line_items: params.lineItems.map((item) => ({
      name: item.name,
      rate: item.rate,
      quantity: item.quantity ?? 1,
    })),
    ...(params.clientAddress ? { billing_address: { address: params.clientAddress, country: "US" } } : {}),
    notes: params.notes ?? "",
    ...(params.clientTaxId ? { custom_fields: [{ label: "Tax ID / Identificación Tributaria", value: params.clientTaxId }] } : {}),
    terms: "El pago es requerido para iniciar los servicios. Para transferencia bancaria: info@fastfwdus.com",
  });

  if (!data?.invoice?.invoice_id)
    throw new Error(`No se pudo crear invoice en Zoho Books: ${JSON.stringify(data)}`);

  const inv = data.invoice;
  return {
    invoice_id: inv.invoice_id,
    invoice_number: inv.invoice_number,
    total: inv.total,
    invoice_url: inv.invoice_url ?? "",
  };
}

export async function getZohoBooksInvoice(invoiceId: string) {
  const data = await booksReq("GET", `/invoices/${invoiceId}`);
  return data?.invoice ?? null;
}

export async function getZohoBooksInvoicePdf(invoiceId: string): Promise<Buffer> {
  const token = await getZohoBooksToken();
  const res = await fetch(
    `${ZOHO_BOOKS_BASE}/invoices/${invoiceId}?accept=pdf&organization_id=${orgId()}`,
    { headers: { Authorization: `Zoho-oauthtoken ${token}`, Accept: "application/pdf" } }
  );
  if (!res.ok) throw new Error(`Zoho Books PDF ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function listZohoBooksInvoices() {
  const data = await booksReq("GET", "/invoices?sort_column=created_time&sort_order=D&per_page=50");
  return data?.invoices ?? [];
}

export async function markZohoBooksInvoiceSent(invoiceId: string): Promise<void> {
  await booksReq("POST", `/invoices/${invoiceId}/status/sent`);
}
