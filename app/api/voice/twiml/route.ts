export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { db } from "@/db";
import { callLogs } from "@/db/schema";

// Twilio pega aca cuando el navegador inicia la llamada. Devuelve el TwiML
// que marca al lead. No usa getSession: la request viene de Twilio, no del
// browser — la identidad viaja en los parametros del cliente JS.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const to = String(form.get("To") || "");
  const callSid = String(form.get("CallSid") || "");
  const sourceType = String(form.get("sourceType") || "");
  const sourceId = String(form.get("sourceId") || "");
  const userId = String(form.get("userId") || "");
  const userName = String(form.get("userName") || "");

  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const clean = to.replace(/[^\d+]/g, "");
  if (!clean || clean.replace(/\D/g, "").length < 8) {
    twiml.say({ language: "es-MX" }, "Numero invalido.");
  } else {
    const target = clean.startsWith("+") ? clean : "+" + clean.replace(/\D/g, "");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";
    const dial = twiml.dial({
      callerId: process.env.TWILIO_CALLER_ID,
      answerOnBridge: true,
      action: `${appUrl}/api/voice/status`,
      method: "POST",
    });
    dial.number(target);

    try {
      await db.insert(callLogs).values({
        callSid: callSid || null,
        sourceType: sourceType || null,
        sourceId: sourceId || null,
        userId: userId || null,
        userName: userName || null,
        toPhone: target,
        status: "initiated",
      }).onConflictDoNothing({ target: callLogs.callSid });
    } catch (err) {
      console.error("[voice] no se pudo registrar la llamada:", err);
    }
  }

  return new NextResponse(twiml.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
}
