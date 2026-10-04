export const runtime = "nodejs";
import { NextResponse } from "next/server";
import twilio from "twilio";
import { getSession } from "@/lib/session";

/** Diagnóstico de voz: últimas llamadas con código de error y alertas de Twilio. Solo admin. */
export async function GET() {
  const s = await getSession();
  if (!s || s.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET, TWILIO_CALLER_ID } = process.env;
  const client = twilio(TWILIO_API_KEY!, TWILIO_API_SECRET!, { accountSid: TWILIO_ACCOUNT_SID! });
  const calls = await client.calls.list({ limit: 6 });
  const alerts = await client.monitor.v1.alerts.list({ limit: 5 }).catch(() => []);
  return NextResponse.json({
    callerId: TWILIO_CALLER_ID,
    calls: calls.map((c) => { const x = c as unknown as Record<string, unknown>; return { at: c.dateCreated, direction: c.direction, from: c.from, to: c.to, status: c.status, duration: c.duration, errorCode: x.errorCode ?? null, errorMessage: x.errorMessage ?? null }; }),
    alerts: alerts.map((a) => ({ at: a.dateCreated, code: a.errorCode, text: a.alertText?.slice(0, 300) })),
  });
}
