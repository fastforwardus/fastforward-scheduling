const QB_BASE = `https://quickbooks.api.intuit.com/v3/company/${process.env.QB_REALM_ID}`;


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

  // Save new refresh token if rotated
  if (data.refresh_token && data.refresh_token !== process.env.QB_REFRESH_TOKEN) {
    console.log("QB refresh token rotated — update QB_REFRESH_TOKEN in env");
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

  // Get all paid invoices
  const res = await fetch(
    `${QB_BASE}/query?query=SELECT * FROM Invoice MAXRESULTS 1000&minorversion=65`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
  );
  const data = await res.json();
  const invoices = data.QueryResponse?.Invoice || [];

  // Group by customer
  const customerMap: Record<string, QBCustomer> = {};

  for (const inv of invoices) {
    const custId = inv.CustomerRef?.value;
    const custName = inv.CustomerRef?.name;
    if (!custId || !custName) continue;

    if (!customerMap[custId]) {
      // Get customer email
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

    // Add services from this invoice
    const lines = inv.Line?.filter((l: { DetailType: string; Description?: string; SalesItemLineDetail?: { ItemRef?: { name?: string } } }) => l.DetailType === "SalesItemLineDetail") || [];
    for (const line of lines) {
      const svc = line.Description || line.SalesItemLineDetail?.ItemRef?.name || "";
      if (svc && svc !== "General Services:Discount" && !svc.includes("Discount")) {
        if (!customerMap[custId].services.includes(svc)) {
          customerMap[custId].services.push(svc);
        }
      }
    }

    // Track paid amounts
    if (inv.Balance === 0) {
      customerMap[custId].totalPaid += inv.TotalAmt || 0;
    } else {
      customerMap[custId].hasPendingBalance = true;
    }
  }

  return Object.values(customerMap).filter(c => c.email && c.services.length > 0);
}
