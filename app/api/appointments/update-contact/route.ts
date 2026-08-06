export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, clientProfiles, proposals } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { appointmentId, clientEmail, clientLanguage } = await req.json();
  if (!appointmentId || (!clientEmail && !clientLanguage)) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }

  const email = clientEmail ? String(clientEmail).toLowerCase().trim() : null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: "Email invalido" }, { status: 400 });
  }

  const lang = clientLanguage ? String(clientLanguage) : null;
  if (lang && !["es", "en", "pt"].includes(lang)) {
    return NextResponse.json({ error: "Idioma invalido" }, { status: 400 });
  }

  try {
    const [appt] = await db.select().from(appointments)
      .where(eq(appointments.id, appointmentId)).limit(1);
    if (!appt) return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });

    // Los reps solo pueden editar sus propias citas
    if (session.role === "sales_rep" && appt.assignedTo !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Idioma: override manual de lo que se adivino al agendar
    if (lang && lang !== appt.clientLanguage) {
      await db.update(appointments)
        .set({ clientLanguage: lang as "es" | "en" | "pt" })
        .where(eq(appointments.id, appointmentId));
      if (appt.clientEmail) {
        await db.update(clientProfiles)
          .set({ language: lang as "es" | "en" | "pt" })
          .where(eq(clientProfiles.email, appt.clientEmail.toLowerCase()));
      }
      console.log("Idioma actualizado:", appt.clientLanguage, "->", lang);
    }

    if (!email) return NextResponse.json({ ok: true, languageUpdated: !!lang });

    if (appt.clientEmail?.toLowerCase() === email) {
      return NextResponse.json({ ok: true, unchanged: true });
    }

    await db.update(appointments).set({ clientEmail: email })
      .where(eq(appointments.id, appointmentId));

    // El perfil viejo no se renombra: email tiene indice unico y podria
    // chocar con uno existente. Se crea/reutiliza el del email nuevo.
    await db.insert(clientProfiles).values({
      email,
      name: appt.clientName,
      company: appt.clientCompany,
      whatsapp: appt.clientWhatsapp,
      timezone: appt.clientTimezone,
      language: appt.clientLanguage,
      isB2b: appt.isB2b,
    }).onConflictDoNothing({ target: clientProfiles.email });

    // Propuestas pendientes de esta cita: si no, los recordatorios
    // siguen yendo al email viejo.
    const upd = await db.update(proposals).set({ clientEmail: email })
      .where(and(
        sql`${proposals.appointmentId} = ${appointmentId}`,
        eq(proposals.status, "pending"),
      )).returning({ id: proposals.id });

    console.log("Email actualizado:", appt.clientEmail, "->", email, "| propuestas:", upd.length);
    return NextResponse.json({ ok: true, previousEmail: appt.clientEmail, proposalsUpdated: upd.length });
  } catch (err) {
    console.error("update-contact error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
