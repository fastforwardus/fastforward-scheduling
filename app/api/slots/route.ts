import { NextRequest, NextResponse } from "next/server";
import { generateAvailableSlots, MIAMI } from "@/lib/slots";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientTz = searchParams.get("timezone") || MIAMI;

    const result = await generateAvailableSlots(clientTz);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Slots error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
