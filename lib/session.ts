import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || "ff-secret");

export async function getSession() {
  const token = cookies().get("ff-session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as { id: string; email: string; fullName: string; role: string; slug: string };
  } catch {
    return null;
  }
}
