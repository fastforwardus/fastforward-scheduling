import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { listCases } from "@/lib/status/queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const scope = new URL(req.url).searchParams.get("scope") === "closed" ? "closed" : "open";
  const cases = await listCases(scope);
  return NextResponse.json({ cases });
}
