import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAccount } from "@/lib/status/queries";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { clientId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const data = await getAccount(params.clientId);
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(data);
}
