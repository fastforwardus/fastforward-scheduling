import { NextResponse } from "next/server";
import { getQBToken } from "@/lib/quickbooks";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const token = await getQBToken();
    return NextResponse.json({ ok: true, tokenPreview: token.substring(0, 20) + "..." });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) });
  }
}
