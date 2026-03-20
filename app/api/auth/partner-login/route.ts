import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { partners } from "@/db/schema";
import { eq } from "drizzle-orm";
import { compare } from "bcryptjs";
import { SignJWT } from "jose";

export async function POST(req: NextRequest) {
  const { slug, password } = await req.json();

  const [partner] = await db.select().from(partners)
    .where(eq(partners.slug, slug)).limit(1);

  if (!partner || !partner.isActive) {
    return NextResponse.json({ error: "Partner no encontrado" }, { status: 404 });
  }

  const valid = await compare(password, partner.passwordHash);
  if (!valid) return NextResponse.json({ error: "Contrasena incorrecta" }, { status: 401 });

  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || "ff-secret");
  const token = await new SignJWT({ id: partner.id, slug: partner.slug, name: partner.name, email: partner.email })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);

  const res = NextResponse.json({ ok: true });
  res.cookies.set("ff-partner-session", token, { httpOnly: true, maxAge: 60 * 60 * 24 * 7, path: "/" });
  return res;
}
