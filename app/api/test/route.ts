import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function GET() {
  try {
    const result = await db.select({
      email: users.email,
      role: users.role,
      active: users.isActive,
    }).from(users).limit(6);

    return NextResponse.json({ ok: true, users: result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
