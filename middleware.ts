import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || "ff-secret");

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("ff-session")?.value;

  let isValid = false;
  let role = "";
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret);
      isValid = true;
      role = String((payload as { role?: string }).role || "");
    } catch {}
  }

  // El rol de recupero solo accede a su vista: sin esto entraria a
  // cualquier pantalla del dashboard escribiendo la URL a mano.
  if (isValid && role === "recovery"
      && pathname.startsWith("/dashboard")
      && !pathname.startsWith("/dashboard/recovery")) {
    return NextResponse.redirect(new URL("/dashboard/recovery", req.url));
  }

  if (pathname.startsWith("/dashboard") && !isValid) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname === "/login" && isValid) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
