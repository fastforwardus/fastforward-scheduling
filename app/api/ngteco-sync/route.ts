import { NextRequest, NextResponse } from "next/server";
import { syncNgteco, ngtecoSetCfg } from "@/lib/ngteco";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Cron cada 15 min: importa los punches de huella de NGTeco a time_entries.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const token = req.nextUrl.searchParams.get("token");
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && (!process.env.MANUAL_RUN_TOKEN || token !== process.env.MANUAL_RUN_TOKEN)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const days = Number(req.nextUrl.searchParams.get("days") || 3);
  try {
    const r = await syncNgteco(days);
    return NextResponse.json(r);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await ngtecoSetCfg("NGTECO_LAST_ERROR", `${new Date().toISOString()} ${msg}`).catch(() => {});
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
