import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { partners } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { hash } from "bcryptjs";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const all = await db.select({
    id: partners.id, name: partners.name, slug: partners.slug,
    email: partners.email, company: partners.company,
    isActive: partners.isActive, commissionRate: partners.commissionRate, createdAt: partners.createdAt,
  }).from(partners).orderBy(partners.createdAt);
  return NextResponse.json({ partners: all });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { name, slug, email, company, password, commissionRate } = await req.json();
  if (!name || !slug || !email || !password) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  const passwordHash = await hash(password, 12);
  const [partner] = await db.insert(partners).values({
    name, slug: slug.toLowerCase().replace(/\s+/g, "-"), email, company: company || null,
    passwordHash, commissionRate: commissionRate || "0", isActive: true,
  }).returning();
  return NextResponse.json({ ok: true, partner });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id, isActive, commissionRate, password } = await req.json();
  const updates: Record<string, unknown> = { isActive, commissionRate };
  if (password) updates.passwordHash = await hash(password, 12);
  await db.update(partners).set(updates).where(eq(partners.id, id));
  return NextResponse.json({ ok: true });
}
