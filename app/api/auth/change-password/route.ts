import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { compare, hash } from "bcryptjs";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  if (newPassword.length < 8) return NextResponse.json({ error: "Minimo 8 caracteres" }, { status: 400 });

  const [user] = await db.select().from(users).where(eq(users.id, session.id)).limit(1);
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const valid = await compare(currentPassword, user.passwordHash);
  if (!valid) return NextResponse.json({ error: "Contrasena actual incorrecta" }, { status: 400 });

  const newHash = await hash(newPassword, 12);
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, session.id));

  return NextResponse.json({ ok: true });
}
