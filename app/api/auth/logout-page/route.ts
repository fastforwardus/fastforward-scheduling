import { NextResponse } from "next/server";

export async function GET() {
  const res = NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL || "https://fastforward-scheduling.vercel.app"));
  res.cookies.delete("ff-session");
  return res;
}
