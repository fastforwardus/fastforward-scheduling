import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, users, remindersLog } from "@/db/schema";
import { and, eq, lte, gte, isNull, inArray } from "drizzle-orm";
import { Resend } from "resend";
import { enviarNoShowCliente } from "@/lib/noshow-cliente";

// Este cron YA NO le escribe al cliente ni marca no-show. Medido el 21-sep-2026:
// 5 de 9 no-show automaticos fueron a clientes que si tuvieron la cita, porque
// el rep aun no habia cargado el resultado. Ahora solo avisa al rep:
//   - aviso a los 45 min de la hora de la cita
//   - reaviso a las 3 h si sigue sin resultado
// El mensaje al cliente sale desde /api/appointments/outcome cuando el rep
// marca No-show.

const AVISO_MIN = 45;
const REAVISO_MIN = 180;
const VENTANA_MIN = 360;

function htmlRep(p: { clientName: string; clientCompany: string; hora: string; reaviso: boolean; appUrl: string }) {
  return `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  <div style="background:#000000;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
    <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="32" alt="FastForward">
  </div>
  <div style="background:white;border-radius:12px;padding:24px;border:1px solid #E5E7EB;">
    <p style="font-size:16px;font-weight:700;color:#000000;margin:0 0 8px;">${p.reaviso ? "Reaviso: falta cargar el resultado" : "Cargue el resultado de la cita"}</p>
    <p style="color:#4B5563;font-size:14px;line-height:1.6;margin:0 0 16px;">
      La cita de las <strong>${p.hora}</strong> (hora Miami) con <strong>${p.clientName}</strong> de <strong>${p.clientCompany}</strong> sigue sin resultado.
    </p>
    <div style="background:#FEF9C3;border-radius:8px;padding:12px;margin-bottom:16px;">
      <p style="font-size:13px;color:#854D0E;margin:0;line-height:1.5;">
        Al cliente no se le envía nada hasta que usted lo indique. Si no se presentó, marque <strong>No-show</strong> y recibirá automáticamente el email y el WhatsApp para reagendar.
      </p>
    </div>
    <a href="${p.appUrl}/dashboard" style="display:block;text-align:center;background:#000000;color:white;padding:12px;border-radius:10px;font-weight:700;text-decoration:none;font-size:14px;">
      Cargar resultado →
    </a>
  </div>
</div>`;
}

export async function GET(req: NextRequest) {
  // ?test=email            -> muestra del email al cliente, solo a esa casilla
  // ?test=email&tipo=rep   -> muestra del aviso y del reaviso al rep
  const params = new URL(req.url).searchParams;
  const test = params.get("test");
  const authHeader = req.headers.get("authorization");
  if (!test && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";
  const now = new Date();

  if (test) {
    if (params.get("tipo") === "rep") {
      for (const reaviso of [false, true]) {
        await resend.emails.send({
          from: "FastForward Scheduling <noreply@fastfwdus.com>",
          to: test,
          subject: reaviso
            ? "Reaviso: falta el resultado de la cita con Cliente de prueba"
            : "¿Se presentó Cliente de prueba? Cargue el resultado de la cita",
          html: htmlRep({ clientName: "Cliente de prueba", clientCompany: "Empresa de prueba", hora: "10:00", reaviso, appUrl }),
        });
      }
      return NextResponse.json({ ok: true, test: "rep", to: test });
    }
    const r = await enviarNoShowCliente({
      id: "00000000-0000-0000-0000-000000000000",
      clientName: "Cliente de prueba",
      clientEmail: test,
      clientWhatsapp: null,
      clientLanguage: "es",
      assignedTo: null,
    }, { test: true });
    return NextResponse.json({ ok: true, test: "cliente", to: test, resultado: r });
  }

  const desde = new Date(now.getTime() - VENTANA_MIN * 60 * 1000);
  const hasta = new Date(now.getTime() - AVISO_MIN * 60 * 1000);

  const pendientes = await db.select({
    id: appointments.id,
    clientName: appointments.clientName,
    clientCompany: appointments.clientCompany,
    scheduledAt: appointments.scheduledAt,
    assignedTo: appointments.assignedTo,
  }).from(appointments).where(
    and(
      lte(appointments.scheduledAt, hasta),
      gte(appointments.scheduledAt, desde),
      inArray(appointments.status, ["scheduled", "confirmed"]),
      isNull(appointments.outcome),
    )
  );

  let avisos = 0;
  let reavisos = 0;

  for (const appt of pendientes) {
    if (!appt.assignedTo) continue;

    const previos = await db.select({ id: remindersLog.id }).from(remindersLog).where(
      and(eq(remindersLog.appointmentId, appt.id),
          eq(remindersLog.type, "noshow_sales"),
          eq(remindersLog.status, "sent"))
    );
    const minutos = (now.getTime() - new Date(appt.scheduledAt).getTime()) / 60000;

    let reaviso: boolean;
    if (previos.length === 0) reaviso = false;
    else if (previos.length === 1 && minutos >= REAVISO_MIN) reaviso = true;
    else continue;

    const [rep] = await db.select({ email: users.email })
      .from(users).where(eq(users.id, appt.assignedTo)).limit(1);
    if (!rep?.email) continue;

    const hora = new Date(appt.scheduledAt).toLocaleTimeString("es-ES", {
      hour: "2-digit", minute: "2-digit", timeZone: "America/New_York",
    });

    try {
      await resend.emails.send({
        from: "FastForward Scheduling <noreply@fastfwdus.com>",
        to: rep.email,
        subject: reaviso
          ? `Reaviso: falta el resultado de la cita con ${appt.clientName}`
          : `¿Se presentó ${appt.clientName}? Cargue el resultado de la cita`,
        html: htmlRep({
          clientName: appt.clientName || "",
          clientCompany: appt.clientCompany || "",
          hora, reaviso, appUrl,
        }),
      });
      await db.insert(remindersLog).values({
        appointmentId: appt.id, type: "noshow_sales",
        channel: "email", sentAt: new Date(), status: "sent",
      });
      if (reaviso) reavisos++; else avisos++;
    } catch (err) {
      console.error("[noshow] aviso al rep:", err);
    }
  }

  return NextResponse.json({ ok: true, revisadas: pendientes.length, avisos, reavisos, timestamp: now.toISOString() });
}
