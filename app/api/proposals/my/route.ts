export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const isAdmin = session.role === "admin";

    const rows = await db.execute(sql`
      SELECT 
        p.id, p.proposal_num, p.total, p.discount, p.status, p.lang,
        p.created_at, p.accepted_at, p.invoice_sent_at, p.payment_confirmed_at,
        p.zoho_invoice_id, p.confirm_token,
        COALESCE(a.client_name, p.client_name) as client_name,
        COALESCE(a.client_company, '') as client_company,
        COALESCE(a.client_email, p.client_email) as client_email,
        u.full_name as rep_name
      FROM proposals p
      LEFT JOIN appointments a ON a.id::text = p.appointment_id::text
      LEFT JOIN users u ON u.id::text = a.assigned_to::text
      WHERE ${isAdmin ? sql`1=1` : sql`a.assigned_to::text = ${session.id} OR (p.appointment_id LIKE 'direct-%' AND p.client_email IS NOT NULL)`}
      ORDER BY p.created_at DESC
      LIMIT 100
    `) as unknown as { rows: Record<string, unknown>[] };

    return NextResponse.json({ proposals: rows.rows });
  } catch (err) {
    console.error("My proposals error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
