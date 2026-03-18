import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/google";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = getAuthUrl(session.id);
  return NextResponse.redirect(url);
}
