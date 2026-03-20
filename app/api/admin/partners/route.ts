import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { partners } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { hash } from "bcryptjs";
import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);

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
  // Email de bienvenida al partner
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";
  await resend.emails.send({
    from: "Carlos Bisio — FastForward <info@fastfwdus.com>",
    replyTo: "info@fastfwdus.com",
    to: email,
    subject: `Bienvenido al equipo, ${name} — FastForward FDA Experts`,
    html: `
<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <div style="background:#27295C;border-radius:16px 16px 0 0;padding:32px;text-align:center;">
    <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="36" alt="FastForward">
  </div>
  <div style="background:white;border-radius:0 0 16px 16px;padding:32px;border:1px solid #E5E7EB;border-top:none;">
    <p style="font-size:22px;font-weight:700;color:#27295C;margin:0 0 8px;">Hola, ${name}! 👋</p>
    <p style="color:#6B7280;font-size:14px;margin:0 0 24px;">
      Nos alegra darte la bienvenida al <strong style="color:#27295C;">Programa de Partners de FastForward FDA Experts</strong>.
      Ya tenes acceso a tu portal exclusivo.
    </p>

    <div style="background:#F8F9FB;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #E5E7EB;">
      <p style="font-size:13px;font-weight:700;color:#27295C;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.05em;">Tus datos de acceso</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:6px 0;border-bottom:1px solid #F0F0F0;">
          <span style="font-size:11px;color:#9CA3AF;text-transform:uppercase;">Portal de partner</span><br>
          <a href="${appUrl}/partner/${slug}" style="font-size:14px;font-weight:600;color:#C9A84C;">${appUrl}/partner/${slug}</a>
        </td></tr>
        <tr><td style="padding:6px 0;border-bottom:1px solid #F0F0F0;">
          <span style="font-size:11px;color:#9CA3AF;text-transform:uppercase;">Tu link exclusivo de referidos</span><br>
          <a href="${appUrl}/book/partner/${slug}" style="font-size:14px;font-weight:600;color:#C9A84C;">${appUrl}/book/partner/${slug}</a>
        </td></tr>
        <tr><td style="padding:6px 0;">
          <span style="font-size:11px;color:#9CA3AF;text-transform:uppercase;">Contrasena</span><br>
          <span style="font-size:14px;font-weight:600;color:#27295C;">${password}</span>
        </td></tr>
      </table>
    </div>

    <div style="background:#EEF2FF;border-radius:12px;padding:16px;margin-bottom:24px;border-left:4px solid #6366F1;">
      <p style="font-size:13px;font-weight:700;color:#27295C;margin:0 0 8px;">Proximos pasos</p>
      <p style="font-size:13px;color:#374151;margin:0 0 6px;">1. Ingresa a tu portal con la contrasena indicada</p>
      <p style="font-size:13px;color:#374151;margin:0 0 6px;">2. Lee y acepta los Terminos y Condiciones del programa</p>
      <p style="font-size:13px;color:#374151;margin:0 0 6px;">3. Explora el catalogo completo de servicios y precios</p>
      <p style="font-size:13px;color:#374151;margin:0;">4. Comparte tu link exclusivo con tus contactos</p>
    </div>

    <a href="${appUrl}/partner/${slug}"
       style="display:block;text-align:center;background:#C9A84C;color:#1A1C3E;padding:14px;border-radius:10px;font-weight:700;text-decoration:none;font-size:14px;margin-bottom:16px;">
      Ingresar a mi portal →
    </a>

    <div style="border-top:1px solid #F0F0F0;padding-top:20px;margin-top:8px;text-align:center;">
      <p style="font-size:12px;color:#9CA3AF;margin:0 0 4px;">FastForward Trading Company LLC · Miami, FL</p>
      <p style="font-size:12px;color:#9CA3AF;margin:0;">
        Consultas: <a href="mailto:info@fastfwdus.com" style="color:#C9A84C;">info@fastfwdus.com</a> |
        <a href="https://fastfwdus.com" style="color:#C9A84C;">fastfwdus.com</a>
      </p>
    </div>
  </div>
</div>`,
  }).catch(console.error);

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
