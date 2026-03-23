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
  const data = await res.json();
  if (!data.access_token) throw new Error(`Zoho auth failed: ${JSON.stringify(data)}`);
  return data.access_token;
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
};

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
  appointmentId?: string;
  scheduledAt?: string;
}) {
  const token = await getZohoToken();

  const nameParts = params.clientName.trim().split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ") || "-";

  const langLabels: Record<string, string> = { es: "Español", en: "English", pt: "Português" };

  const leadData: Record<string, string> = {
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

  if (params.serviceInterest) {
    leadData.Industry = SERVICE_TO_INDUSTRY[params.serviceInterest] || "Other";
  }
  if (params.clientLanguage) {
    leadData["Idioma_Language"] = langLabels[params.clientLanguage] || "Español";
  }

  // Search if lead already exists by email
  const searchRes = await fetch(
    `${ZOHO_BASE}/Leads/search?email=${encodeURIComponent(params.clientEmail)}`,
    { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
  );
  const searchData = await searchRes.json();
  const existingId = searchData.data?.[0]?.id;

  if (existingId) {
    // Update existing lead
    const updateRes = await fetch(`${ZOHO_BASE}/Leads/${existingId}`, {
      method: "PUT",
      headers: { Authorization: `Zoho-oauthtoken ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ data: [leadData] }),
    });
    const updateData = await updateRes.json();
    console.log("Zoho lead updated:", existingId, updateData.data?.[0]?.status);
    return { id: existingId, action: "updated" };
  } else {
    // Create new lead
    const createRes = await fetch(`${ZOHO_BASE}/Leads`, {
      method: "POST",
      headers: { Authorization: `Zoho-oauthtoken ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ data: [leadData] }),
    });
    const createData = await createRes.json();
    const newId = createData.data?.[0]?.details?.id;
    console.log("Zoho lead created:", newId);
    return { id: newId, action: "created" };
  }
}
