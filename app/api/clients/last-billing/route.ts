export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { proposals } from "@/db/schema";
import { eq, and, isNotNull, desc, or } from "drizzle-orm";
import { getSession } from "@/lib/session";

// Datos de facturacion de la ultima propuesta del cliente, para no
// re-tipear direccion y tax id en cada propuesta nueva.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const email = req.nextUrl.searchParams.get("email")?.toLowerCase().trim();
  if (!email) return NextResponse.json({ error: "email requerido" }, { status: 400 });

  try {
    const [last] = await db
      .select({ clientAddress: proposals.clientAddress, clientTaxId: proposals.clientTaxId })
      .from(proposals)
      .where(and(
        eq(proposals.clientEmail, email),
        or(isNotNull(proposals.clientAddress), isNotNull(proposals.clientTaxId)),
      ))
      .orderBy(desc(proposals.createdAt))
      .limit(1);

    return NextResponse.json({
      clientAddress: last?.clientAddress || "",
      clientTaxId: last?.clientTaxId || "",
    });
  } catch (err) {
    console.error("last-billing error:", err);
    return NextResponse.json({ clientAddress: "", clientTaxId: "" });
  }
}
