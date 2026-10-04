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
  const insights: Record<string, unknown>[] = [];
  for (const c of calls.filter((x) => x.direction === "outbound-dial").slice(0, 3)) {
    try {
      const sm = (await client.insights.v1.calls(c.sid).summary().fetch()) as unknown as Record<string, unknown>;
      const ce = (sm.carrierEdge as Record<string, unknown>) || {};
      insights.push({ to: c.to, at: c.dateCreated, callState: sm.callState, disconnectedBy: sm.disconnectedBy, carrier: ce.properties, lastSip: (ce.properties as Record<string, unknown>)?.last_sip_response_num, q850: (ce.properties as Record<string, unknown>)?.q850_cause });
    } catch (e) { insights.push({ to: c.to, insightsError: String(e).slice(0, 120) }); }
  }
  let geoAR: unknown = null;
  try { const g = await client.voice.v1.dialingPermissions.countries("AR").fetch(); geoAR = { lowRisk: g.lowRiskNumbersEnabled, highRiskSpecial: g.highRiskSpecialNumbersEnabled, highRiskTollfraud: g.highRiskTollfraudNumbersEnabled }; } catch (e) { geoAR = String(e).slice(0, 120); }
  return NextResponse.json({
    insights, geoAR,
    callerId: TWILIO_CALLER_ID,
    calls: calls.map((c) => { const x = c as unknown as Record<string, unknown>; return { at: c.dateCreated, direction: c.direction, from: c.from, to: c.to, status: c.status, duration: c.duration, errorCode: x.errorCode ?? null, errorMessage: x.errorMessage ?? null }; }),
    alerts: alerts.map((a) => ({ at: a.dateCreated, code: a.errorCode, text: a.alertText?.slice(0, 300) })),
  });
}
