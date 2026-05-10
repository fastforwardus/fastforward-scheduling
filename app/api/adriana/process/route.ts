export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { processUserMessage } from "@/lib/adriana/engine";

export async function POST(req: NextRequest) {
  const secret = process.env.ADRIANA_INTERNAL_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const header = req.headers.get("x-adriana-internal-secret");
  if (header !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    waPhone?: string;
    waProfileName?: string;
    userMessage?: string;
    waMessageId?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.waPhone || !body.userMessage) {
    return NextResponse.json(
      { error: "Missing required fields: waPhone, userMessage" },
      { status: 400 }
    );
  }

  try {
    const result = await processUserMessage({
      waPhone: body.waPhone,
      waProfileName: body.waProfileName,
      userMessage: body.userMessage,
      waMessageId: body.waMessageId,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/adriana/process] unhandled error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
