import { NextRequest, NextResponse } from "next/server";
import { getQBToken } from "@/lib/quickbooks";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const token = await getQBToken();
    return NextResponse.json({ ok: true, preview: token.substring(0, 10) + "..." });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
