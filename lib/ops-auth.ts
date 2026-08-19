import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";

/** Autoriza rutas operativas: cron con secreto, o admin logueado. */
export async function autorizarOps(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get("authorization") || "";
  const token = req.headers.get("x-manual-token")
    || new URL(req.url).searchParams.get("t") || "";

  const secretos = [process.env.CRON_SECRET, process.env.OPS_TOKEN, process.env.MANUAL_RUN_TOKEN]
    .filter(Boolean) as string[];

  if (secretos.some(s => auth === `Bearer ${s}` || token === s)) return true;

  const session = await getSession();
  return session?.role === "admin";
}
