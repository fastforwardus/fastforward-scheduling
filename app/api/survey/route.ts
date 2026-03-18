import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { surveys, appointments, remindersLog, clientProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { token, rating, feedback } = await req.json();
    if (!token || !rating) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });

    // Buscar cita por confirmToken
    const [appt] = await db.select().from(appointments)
      .where(eq(appointments.confirmToken, token)).limit(1);
    if (!appt) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Guardar encuesta
    await db.insert(surveys).values({
      appointmentId: appt.id,
      clientEmail: appt.clientEmail,
      rating: parseInt(rating),
      feedback: feedback || null,
    });

    // Actualizar satisfaction promedio en client profile
    const allSurveys = await db.select({ rating: surveys.rating })
      .from(surveys).where(eq(surveys.clientEmail, appt.clientEmail));
    const avg = allSurveys.reduce((sum, s) => sum + s.rating, 0) / allSurveys.length;
    await db.update(clientProfiles)
      .set({ satisfactionAvg: avg.toFixed(2) })
      .where(eq(clientProfiles.email, appt.clientEmail))
      .catch(() => {});

    // Si rating <= 3, notificar a admin y manager
    if (parseInt(rating) <= 3) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";
      await resend.emails.send({
        from: "FastForward Scheduling <noreply@fastfwdus.com>",
        to: ["info@fastfwdus.com", "tmarino@fastfwdus.com"],
        subject: `Calificacion baja: ${rating}/5 - ${appt.clientName} (${appt.clientCompany})`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  <div style="background:#27295C;border-radius:12px;padding:20px;text-align:center;margin-bottom:20px;">
    <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="28" alt="FastForward">
  </div>
  <div style="background:white;border-radius:12px;padding:24px;border:1px solid #E5E7EB;">
    <div style="background:#FEE2E2;border-radius:8px;padding:12px;margin-bottom:16px;">
      <p style="font-size:16px;font-weight:700;color:#991B1B;margin:0;">Calificacion baja recibida: ${"⭐".repeat(parseInt(rating))}</p>
    </div>
    <p style="color:#374151;font-size:14px;"><strong>Cliente:</strong> ${appt.clientName} — ${appt.clientCompany}</p>
    <p style="color:#374151;font-size:14px;"><strong>Email:</strong> ${appt.clientEmail}</p>
    ${feedback ? `<p style="color:#374151;font-size:14px;"><strong>Comentario:</strong> "${feedback}"</p>` : ""}
    <a href="${appUrl}/dashboard" style="display:block;text-align:center;background:#27295C;color:white;padding:12px;border-radius:8px;font-weight:700;text-decoration:none;font-size:14px;margin-top:16px;">Ver en dashboard</a>
  </div>
</div>`,
      }).catch(console.error);
    }

    await db.insert(remindersLog).values({
      appointmentId: appt.id,
      type: "survey",
      channel: "email",
      sentAt: new Date(),
      status: "sent",
    }).catch(() => {});

    const googleReviewUrl = process.env.GOOGLE_BUSINESS_REVIEW_URL || "https://g.page/r/review";
    return NextResponse.json({ ok: true, showGoogleReview: parseInt(rating) >= 4, googleReviewUrl });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
