import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
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
    if (!data.access_token) return NextResponse.json({ ok: false, error: data });

    const lead = await fetch("https://www.zohoapis.com/crm/v2/Leads", {
      method: "POST",
      headers: { Authorization: `Zoho-oauthtoken ${data.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ data: [{ First_Name: "Test", Last_Name: "Prod", Email: "test-prod@fastfwdus.com", Company: "TestProd", Phone: "+1000", Lead_Source: "Web Site" }] }),
    });
    const leadData = await lead.json();
    return NextResponse.json({ ok: true, lead: leadData });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) });
  }
}
