import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createOrUpdateZohoLead } from "@/lib/zoho";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { clientName, clientEmail, clientCompany, clientWhatsapp } = await req.json();

  try {
    const result = await createOrUpdateZohoLead({
      clientName,
      clientEmail,
      clientCompany,
      clientWhatsapp,
      noteToAdd: "Test desde produccion",
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
