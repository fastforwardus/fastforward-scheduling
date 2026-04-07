// lib/zohobooks.ts
const ZOHO_TOKEN_URL = "https://accounts.zoho.com/oauth/v2/token";
const ZOHO_BOOKS_BASE = "https://www.zohoapis.com/books/v3";

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getZohoBooksToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }
  const res = await fetch(ZOHO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.ZOHO_CLIENT_ID!,
      client_secret: process.env.ZOHO_CLIENT_SECRET!,
      refresh_token: process.env.ZOHO_REFRESH_TOKEN!,
    }),
  });
  const text = await res.text();
  let data: Record<string, string>;
  try { data = JSON.parse(text); } catch { throw new Error(`Zoho token parse error: ${text}`); }
  if (!data.access_token) throw new Error(`Zoho Books token error: ${JSON.stringify(data)}`);
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

// ── CONTACTOS ──────────────────────────────────────────────────────

export async function findOrCreateZohoBooksContact(params: {
  name: string;
  email: string;
  company?: string;
  phone?: string;
}): Promise<{ contact_id: string }> {
  const token = await getZohoBooksToken();
  // Buscar por email
  const searchRes = await fetch(
    `${ZOHO_BOOKS_BASE}/contacts?organization_id=${orgId()}&email=${encodeURIComponent(params.email)}`,
    { headers: { Authorization: `Zoho-oauthtoken ${token}`, Accept: "application/json" } }
  );
  const searchText = await searchRes.text();
  const searchData = searchText ? JSON.parse(searchText) : null;
  const existing = searchData?.contacts?.[0];
  if (existing) return { contact_id: existing.contact_id };

  // Crear nuevo
  const data = await booksReq("POST", "/contacts", {
    contact_name: params.name,
    company_name: params.company || params.name,
    contact_type: "customer",
    email: params.email,
    ...(params.phone ? { mobile: params.phone } : {}),
  });
  if (!data?.contact?.contact_id)
    throw new Error(`No se pudo crear contacto en Zoho Books: ${JSON.stringify(data)}`);
  return { contact_id: data.contact.contact_id };
}

// ── FACTURAS ──────────────────────────────────────────────────────

export interface ZBLineItem {
  name: string;
  rate: number;
  quantity?: number;
  description?: string;
}

export async function createZohoBooksInvoice(params: {
  contactId: string;
  invoiceNumber: string;
  lineItems: ZBLineItem[];
  notes?: string;
}): Promise<{ invoice_id: string; invoice_number: string; total: number; invoice_url: string }> {
  const data = await booksReq("POST", "/invoices", {
    customer_id: params.contactId,
    invoice_number: params.invoiceNumber,
    payment_options: {
      payment_gateways: [{ configured: true, gateway_name: "zohopayments" }],
    },
    line_items: params.lineItems.map((item) => ({
      name: item.name,
      rate: item.rate,
      quantity: item.quantity ?? 1,
      description: item.description ?? "",
    })),
    notes: params.notes ?? "",
    terms:
      "El pago es requerido para iniciar los servicios. Para transferencia bancaria: info@fastfwdus.com",
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
