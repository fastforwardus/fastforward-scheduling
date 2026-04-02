import { db } from "@/db";
import { systemConfig } from "@/db/schema";
import { eq } from "drizzle-orm";

const QB_BASE = `https://quickbooks.api.intuit.com/v3/company/${process.env.QB_REALM_ID}`;

async function saveNewRefreshToken(newToken: string) {
  // Update QB_REFRESH_TOKEN in Vercel automatically
  try {
    const projectId = process.env.VERCEL_PROJECT_ID || "fastforward-scheduling";
    const teamId = process.env.VERCEL_TEAM_ID || "";
    const vercelToken = process.env.VERCEL_TOKEN;
    if (!vercelToken) { console.log("No VERCEL_TOKEN — cannot auto-update QB_REFRESH_TOKEN"); return; }

    const url = `https://api.vercel.com/v10/projects/${projectId}/env${teamId ? `?teamId=${teamId}` : ""}`;
    // Get existing env vars to find the ID of QB_REFRESH_TOKEN
    const listRes = await fetch(url, {
      headers: { Authorization: `Bearer ${vercelToken}` }
    });
    const listData = await listRes.json();
    const envVar = listData.envs?.find((e: { key: string }) => e.key === "QB_REFRESH_TOKEN");

    if (envVar?.id) {
      await fetch(`https://api.vercel.com/v10/projects/${projectId}/env/${envVar.id}${teamId ? `?teamId=${teamId}` : ""}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${vercelToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ value: newToken }),
      });
      console.log("QB_REFRESH_TOKEN auto-updated in Vercel");
    }
  } catch (err) {
    console.error("Failed to auto-update QB_REFRESH_TOKEN:", err);
  }
}

async function getStoredRefreshToken(): Promise<string> {
  try {
    const [row] = await db.select().from(systemConfig).where(eq(systemConfig.key, "QB_REFRESH_TOKEN")).limit(1);
    if (row?.value) return row.value;
  } catch (e) {
    console.error("getStoredRefreshToken error:", e);
  }
  return process.env.QB_REFRESH_TOKEN || "";
}

export async function getQBToken(): Promise<string> {
  const credentials = Buffer.from(
    `${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: { "Authorization": `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: await getStoredRefreshToken() }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`QB auth failed: ${JSON.stringify(data)}`);

  // Auto-save new refresh token if rotated
  if (data.refresh_token && data.refresh_token !== process.env.QB_REFRESH_TOKEN) {
    process.env.QB_REFRESH_TOKEN = data.refresh_token;
    await saveNewRefreshToken(data.refresh_token);
  }

  return data.access_token;
}

export interface QBCustomer {
  id: string;
  name: string;
  email: string;
  services: string[];
  totalPaid: number;
  hasPendingBalance: boolean;
}

export async function getQBCustomersWithServices(): Promise<QBCustomer[]> {
  const token = await getQBToken();

  const res = await fetch(
    `${QB_BASE}/query?query=SELECT * FROM Invoice MAXRESULTS 1000&minorversion=65`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
  );
  const data = await res.json();
  const invoices = data.QueryResponse?.Invoice || [];

  const customerMap: Record<string, QBCustomer> = {};

  for (const inv of invoices) {
    const custId = inv.CustomerRef?.value;
    const custName = inv.CustomerRef?.name;
    if (!custId || !custName) continue;

    if (!customerMap[custId]) {
      const custRes = await fetch(
        `${QB_BASE}/customer/${custId}?minorversion=65`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
      );
      const custData = await custRes.json();
      const email = custData.Customer?.PrimaryEmailAddr?.Address || "";

      customerMap[custId] = {
        id: custId,
        name: custName,
        email,
        services: [],
        totalPaid: 0,
        hasPendingBalance: false,
      };
    }

    const lines = inv.Line?.filter((l: { DetailType: string; Description?: string; SalesItemLineDetail?: { ItemRef?: { name?: string } } }) => l.DetailType === "SalesItemLineDetail") || [];
    for (const line of lines) {
      const svc = line.Description || line.SalesItemLineDetail?.ItemRef?.name || "";
      if (svc && svc !== "General Services:Discount" && !svc.includes("Discount")) {
        if (!customerMap[custId].services.includes(svc)) {
          customerMap[custId].services.push(svc);
        }
      }
    }

    if (inv.Balance === 0) {
      customerMap[custId].totalPaid += inv.TotalAmt || 0;
    } else {
      customerMap[custId].hasPendingBalance = true;
    }
  }

  return Object.values(customerMap).filter(c => c.email && c.services.length > 0);
}
