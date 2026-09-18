export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { findZohoLeadOwnerEmail } from "@/lib/zoho";

const EXCLUDED_AUTO_ASSIGN_EMAILS = ["info@fastfwdus.com"];

// Devuelve el slug del rep dueño del lead en Zoho, si existe y esta activo.
// El wizard lo usa para mostrar SOLO la agenda de ese rep.
export async function GET(req: NextRequest) {
  try {
    const email = new URL(req.url).searchParams.get("email")?.toLowerCase().trim();
    if (!email) return NextResponse.json({});
    const ownerEmail = await findZohoLeadOwnerEmail(email);
    if (!ownerEmail) return NextResponse.json({});
    const allUsers = await db.select().from(users);
    const owner = allUsers.find(u => u.email?.toLowerCase() === ownerEmail.toLowerCase());
    if (!owner || !owner.isActive || !owner.slug) return NextResponse.json({});
    const excluded = owner.fullName?.toLowerCase().includes("carlos bisio") ||
      EXCLUDED_AUTO_ASSIGN_EMAILS.includes(owner.email?.toLowerCase() || "");
    if (excluded) return NextResponse.json({});
    return NextResponse.json({ slug: owner.slug });
  } catch (err) {
    console.error("owner-rep error:", err);
    return NextResponse.json({});
  }
}
