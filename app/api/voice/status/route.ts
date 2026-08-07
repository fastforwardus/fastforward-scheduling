export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { callLogs, recoveryNotes, proposalEvents } from "@/db/schema";
import { eq } from "drizzle-orm";

const LABEL: Record<string, string> = {
  completed: "atendida",
  "no-answer": "sin respuesta",
  busy: "ocupado",
  failed: "fallo",
  canceled: "cancelada",
};

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const callSid = String(form.get("CallSid") || "");
  const status = String(form.get("DialCallStatus") || form.get("CallStatus") || "");
  const dur = Number(form.get("DialCallDuration") || 0);

  try {
    const [log] = await db.select().from(callLogs)
      .where(eq(callLogs.callSid, callSid)).limit(1);

    await db.update(callLogs)
      .set({ status, durationSec: dur })
      .where(eq(callLogs.callSid, callSid));

    // La nota se escribe sola: quien llama no registra el resultado a mano,
    // solo agrega contexto si quiere.
    if (log?.sourceType && log?.sourceId) {
      const texto = `Llamada ${LABEL[status] || status}` +
        (dur > 0 ? ` — ${Math.floor(dur / 60)}m ${dur % 60}s` : "");
      await db.insert(recoveryNotes).values({
        sourceType: log.sourceType,
        sourceId: log.sourceId,
        userId: log.userId,
        authorName: log.userName || "Sistema",
        content: texto,
      });
      if (log.sourceType === "proposal") {
        await db.insert(proposalEvents).values({
          proposalId: log.sourceId,
          kind: "call", channel: "telefono", detail: texto,
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error("[voice-status] error:", err);
  }

  return new NextResponse("<Response/>", { headers: { "Content-Type": "text/xml" } });
}
