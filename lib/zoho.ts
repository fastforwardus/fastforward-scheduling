const ZOHO_BASE = "https://www.zohoapis.com/crm/v2";

async function getZohoToken(): Promise<string> {
  const res = await fetch("https://accounts.zoho.com/oauth/v2/token", {
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
  if (!text) throw new Error("Zoho auth returned empty response");
  let data: { access_token?: string; error?: string };
  try { data = JSON.parse(text); } catch { throw new Error(`Zoho auth invalid JSON: ${text.substring(0, 100)}`); }
  if (!data.access_token) throw new Error(`Zoho auth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

// Get Zoho user ID by email (to assign lead owner)
async function getZohoUserId(token: string, email: string): Promise<string | null> {
  try {
    const res = await fetch(`${ZOHO_BASE}/users?type=AllUsers`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` }
    });
    const text = await res.text();
    if (!text) return null;
    const data = JSON.parse(text);
    const user = data.users?.find((u: { email: string; id: string }) => u.email === email);
    return user?.id || null;
  } catch { return null; }
}

const SERVICE_TO_INDUSTRY: Record<string, string> = {
  fda_fsma:         "Food & Beverage",
  register_company: "Finance",
  market_entry:     "Retail",
  not_sure:         "Other",
};

const OUTCOME_TO_STATUS: Record<string, string> = {
  interested:    "Not Contacted",
  needs_time:    "Contacted",
  proposal_sent: "Lost Lead",
  closed:        "Pre-Qualified",
  not_qualified: "Not Qualified",
  no_show:       "Not Contacted",
};

export async function addZohoNote(leadId: string, note: string): Promise<void> {
  try {
    const token = await getZohoToken();
    await fetch(`${ZOHO_BASE}/Leads/${leadId}/Notes`, {
      method: "POST",
      headers: { Authorization: `Zoho-oauthtoken ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ data: [{ Note_Title: "FastForward System", Note_Content: note }] }),
    });
  } catch (err) { console.error("Zoho note error:", err); }
}

export async function logZohoEmail(leadId: string, params: {
  subject: string;
  body: string;
  fromEmail: string;
  fromName: string;
  toEmail: string;
  toName: string;
}): Promise<void> {
  try {
    const token = await getZohoToken();
    await fetch(`${ZOHO_BASE}/Leads/${leadId}/Emails`, {
      method: "POST",
      headers: { Authorization: `Zoho-oauthtoken ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [{
          from: { email: params.fromEmail, user_name: params.fromName },
          to: [{ email: params.toEmail, user_name: params.toName }],
          subject: params.subject,
          content: params.body,
          mail_format: "html",
          date_time: new Date().toISOString(),
          sent_by_system: true,
        }]
      }),
    });
  } catch (err) { console.error("Zoho email log error:", err); }
}

export async function createOrUpdateZohoLead(params: {
  clientName: string;
  clientEmail: string;
  clientCompany: string;
  clientWhatsapp: string;
  clientLanguage?: string;
  serviceInterest?: string;
  exportVolume?: string;
  clientNotes?: string;
  outcome?: string;
  repName?: string;
  repEmail?: string;
  appointmentId?: string;
  scheduledAt?: string;
  noteToAdd?: string;
}) {
  const token = await getZohoToken();

  const nameParts = params.clientName.trim().split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ") || "-";

  const langLabels: Record<string, string> = { es: "Español", en: "English", pt: "Português" };

  const leadData: Record<string, unknown> = {
    First_Name: firstName,
    Last_Name: lastName,
    Email: params.clientEmail,
    Phone: params.clientWhatsapp,
    Company: params.clientCompany,
    Lead_Source: "Web Site",
    Lead_Status: params.outcome ? (OUTCOME_TO_STATUS[params.outcome] || "Not Contacted") : "Not Contacted",
    Description: [
      params.clientNotes ? `Consulta del cliente: ${params.clientNotes}` : "",
      params.exportVolume ? `Volumen de exportacion: ${params.exportVolume}` : "",
      params.repName ? `Rep asignado: ${params.repName}` : "",
      params.scheduledAt ? `Fecha de cita: ${new Date(params.scheduledAt).toLocaleString("es-ES", { timeZone: "America/New_York" })}` : "",
      params.appointmentId ? `ID Cita: ${params.appointmentId}` : "",
    ].filter(Boolean).join("\n"),
  };

  if (params.serviceInterest) leadData.Industry = SERVICE_TO_INDUSTRY[params.serviceInterest] || "Other";
  if (params.clientLanguage) leadData["Idioma_Language"] = langLabels[params.clientLanguage] || "Español";

  // Assign lead owner to rep
  if (params.repEmail) {
    const ownerId = await getZohoUserId(token, params.repEmail);
    if (ownerId) leadData.Owner = { id: ownerId };
  }

  // Search existing lead
  const searchRes = await fetch(
    `${ZOHO_BASE}/Leads/search?email=${encodeURIComponent(params.clientEmail)}`,
    { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
  );
  const searchText = await searchRes.text();
  let searchData: { data?: Array<{ id: string }> } = {};
  try { if (searchText) searchData = JSON.parse(searchText); } catch { searchData = {}; }
  const existingId = searchData?.data?.[0]?.id;

  let leadId: string;

  if (existingId) {
    await fetch(`${ZOHO_BASE}/Leads/${existingId}`, {
      method: "PUT",
      headers: { Authorization: `Zoho-oauthtoken ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ data: [leadData] }),
    });
    leadId = existingId;
    console.log("Zoho lead updated:", leadId);
  } else {
    const createRes = await fetch(`${ZOHO_BASE}/Leads`, {
      method: "POST",
      headers: { Authorization: `Zoho-oauthtoken ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ data: [leadData] }),
    });
    const createText = await createRes.text();
    const createData = createText ? JSON.parse(createText) : {};
    leadId = createData.data?.[0]?.details?.id;
    console.log("Zoho lead created:", leadId);
  }

  // Add note if provided
  if (params.noteToAdd && leadId) {
    await addZohoNote(leadId, params.noteToAdd);
  }

  return { id: leadId, action: existingId ? "updated" : "created" };
}
