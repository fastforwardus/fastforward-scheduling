import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/google";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const userId = searchParams.get("state");

  if (!code || !userId) {
    return NextResponse.redirect(new URL("/dashboard/settings?google=error", req.url));
  }

  try {
    const client = getOAuthClient();
    const { tokens } = await client.getToken(code);
    await db.update(users)
      .set({ googleRefreshToken: tokens.refresh_token || undefined })
      .where(eq(users.id, userId));
    return NextResponse.redirect(new URL("/dashboard/settings?google=connected", req.url));
  } catch (err) {
    console.error("Google OAuth error:", err);
    return NextResponse.redirect(new URL("/dashboard/settings?google=error", req.url));
  }
}
