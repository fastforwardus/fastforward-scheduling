import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { syncNgteco, ngtecoSetCfg } from "@/lib/ngteco";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { days } = await req.json().catch(() => ({ days: 7 }));
  try {
    return NextResponse.json(await syncNgteco(Number(days) || 7));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await ngtecoSetCfg("NGTECO_LAST_ERROR", `${new Date().toISOString()} ${msg}`).catch(() => {});
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
