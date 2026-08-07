export const runtime = "nodejs";

import { NextResponse } from "next/server";
import twilio from "twilio";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "sales_rep") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (process.env.VOICE_CALLS_ENABLED !== "true") {
    return NextResponse.json({ error: "Llamadas deshabilitadas" }, { status: 503 });
  }

  const { TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET, TWILIO_TWIML_APP_SID } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY || !TWILIO_API_SECRET || !TWILIO_TWIML_APP_SID) {
    return NextResponse.json({ error: "Faltan credenciales de Twilio" }, { status: 500 });
  }

  const AccessToken = twilio.jwt.AccessToken;
  const token = new AccessToken(TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET, {
    identity: `user-${session.id}`,
    ttl: 3600,
  });
  token.addGrant(new AccessToken.VoiceGrant({
    outgoingApplicationSid: TWILIO_TWIML_APP_SID,
    incomingAllow: false,
  }));

  return NextResponse.json({ token: token.toJwt(), identity: `user-${session.id}` });
}
