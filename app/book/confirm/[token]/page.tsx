import { db } from "@/db";
import { appointments, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Image from "next/image";
import { formatInTimeZone } from "date-fns-tz";

export default async function ConfirmPage({ params }: { params: { token: string } }) {
  const [appt] = await db
    .select({
      id: appointments.id,
      clientName: appointments.clientName,
      clientEmail: appointments.clientEmail,
      clientCompany: appointments.clientCompany,
      clientWhatsapp: appointments.clientWhatsapp,
      clientTimezone: appointments.clientTimezone,
      clientLanguage: appointments.clientLanguage,
      platform: appointments.platform,
      scheduledAt: appointments.scheduledAt,
      status: appointments.status,
      assignedTo: appointments.assignedTo,
      serviceInterest: appointments.serviceInterest,
    })
    .from(appointments)
    .where(eq(appointments.confirmToken, params.token))
    .limit(1);

  if (!appt) notFound();

  // Get assigned user name
  let expertName = "";
  if (appt.assignedTo) {
    const [rep] = await db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, appt.assignedTo))
      .limit(1);
    if (rep) expertName = rep.fullName;
  }

  const tz = appt.clientTimezone || "America/New_York";
  const lang = appt.clientLanguage || "es";
  const slotDate = new Date(appt.scheduledAt);

  const locale = lang === "pt" ? "pt-BR" : lang === "en" ? "en-US" : "es-ES";
  const formattedDate = slotDate.toLocaleDateString(locale, {
    weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: tz,
  });
  const formattedTime = formatInTimeZone(slotDate, tz, "h:mm a");

  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const end = new Date(slotDate.getTime() + 30 * 60 * 1000);
  const googleCalUrl = `https://calendar.google.com/calendar/r/eventedit?text=Reuni%C3%B3n+FastForward&dates=${fmt(slotDate)}/${fmt(end)}&details=FastForward+%C2%AE+%7C+FDA+Experts+%C2%B7+fastfwdus.com`;

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FastForward LLC//Scheduling//EN",
    "BEGIN:VEVENT",
    `DTSTART:${fmt(slotDate)}`,
    `DTEND:${fmt(end)}`,
    "SUMMARY:Reunión FastForward ® | FDA Experts",
    "DESCRIPTION:FastForward ® | FDA Experts · Miami FL · fastfwdus.com",
    "ORGANIZER:MAILTO:info@fastfwdus.com",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const platformLabel = appt.platform === "meet" ? "🎥 Google Meet"
    : appt.platform === "zoom" ? "📹 Zoom"
    : "💬 WhatsApp";

  const copy = {
    es: { title: "Tu cita está confirmada", sub: "Aquí tenés todos los detalles", date: "Fecha y hora", platform: "Plataforma", expert: "Tu experto", timezone: "Zona horaria", addGoogle: "Agregar a Google Calendar", addApple: "Agregar a Apple Calendar", pending: "En breve te confirmamos quién te atenderá.", service: "Servicio", footer: "Todos los derechos reservados." },
    en: { title: "Your meeting is confirmed", sub: "Here are all the details", date: "Date & Time", platform: "Platform", expert: "Your expert", timezone: "Timezone", addGoogle: "Add to Google Calendar", addApple: "Add to Apple Calendar", pending: "We will confirm who will assist you shortly.", service: "Service", footer: "All rights reserved." },
    pt: { title: "Sua reunião está confirmada", sub: "Aqui estão todos os detalhes", date: "Data e Hora", platform: "Plataforma", expert: "Seu especialista", timezone: "Fuso horário", addGoogle: "Adicionar ao Google Calendar", addApple: "Adicionar ao Apple Calendar", pending: "Em breve confirmaremos quem vai atendê-lo.", service: "Serviço", footer: "Todos os direitos reservados." },
  };
  const t = copy[lang as keyof typeof copy] || copy.es;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F8F9FB" }}>

      {/* Header */}
      <header className="h-14 flex items-center justify-center px-4" style={{ background: "#27295C" }}>
        <Image
          src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png"
          alt="FastForward ® | FDA Experts"
          width={150} height={34}
          className="object-contain"
          priority unoptimized
        />
      </header>

      {/* Content */}
      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-lg">

          {/* Card */}
          <div className="rounded-2xl overflow-hidden"
               style={{ background: "white", boxShadow: "0 4px 32px rgba(39,41,92,0.08)", border: "1px solid rgba(39,41,92,0.06)" }}>

            {/* Top bar */}
            <div className="px-8 py-6 text-center" style={{ background: "#27295C" }}>
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                   style={{ background: "#C9A84C", fontSize: "24px", color: "white", fontWeight: 700, lineHeight: "56px" }}>
                ✓
              </div>
              <h1 className="text-xl font-bold text-white mb-1">{t.title}</h1>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>{t.sub}</p>
            </div>

            {/* Details */}
            <div className="px-8 py-6 space-y-4">

              {/* Date */}
              <div className="flex items-start gap-4 p-4 rounded-xl" style={{ background: "#F8F9FB", border: "1px solid #E5E7EB" }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-lg"
                     style={{ background: "#27295C" }}>
                  📅
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: "#9CA3AF" }}>{t.date}</p>
                  <p className="font-semibold text-sm capitalize" style={{ color: "#27295C" }}>{formattedDate}</p>
                  <p className="font-bold" style={{ color: "#C9A84C" }}>{formattedTime}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{tz}</p>
                </div>
              </div>

              {/* Platform */}
              <div className="flex items-start gap-4 p-4 rounded-xl" style={{ background: "#F8F9FB", border: "1px solid #E5E7EB" }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-lg"
                     style={{ background: "#27295C" }}>
                  🎥
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: "#9CA3AF" }}>{t.platform}</p>
                  <p className="font-semibold text-sm" style={{ color: "#27295C" }}>{platformLabel}</p>
                  <p className="text-xs mt-1" style={{ color: "#6B7280" }}>
                    {lang === "es" ? "El link será enviado 15 min antes de la reunión." : lang === "en" ? "The link will be sent 15 min before the meeting." : "O link será enviado 15 min antes da reunião."}
                  </p>
                </div>
              </div>

              {/* Expert */}
              <div className="flex items-start gap-4 p-4 rounded-xl" style={{ background: "#F8F9FB", border: "1px solid #E5E7EB" }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
                     style={{ background: "#27295C" }}>
                  {expertName ? expertName[0] : "FF"}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: "#9CA3AF" }}>{t.expert}</p>
                  {expertName
                    ? <p className="font-semibold text-sm" style={{ color: "#27295C" }}>{expertName}</p>
                    : <p className="text-sm" style={{ color: "#6B7280" }}>{t.pending}</p>
                  }
                  <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>FastForward ® | FDA Experts</p>
                </div>
              </div>

              {/* Calendar buttons */}
              <div className="flex flex-col gap-2.5 pt-2">
                <a href={googleCalUrl} target="_blank" rel="noreferrer"
                   className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5"
                   style={{ background: "#27295C", color: "white" }}>
                  📅 {t.addGoogle}
                </a>
                <a href={`data:text/calendar;charset=utf8,${encodeURIComponent(icsLines)}`}
                   download="cita-fastforward.ics"
                   className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 transition-all hover:-translate-y-0.5"
                   style={{ borderColor: "#E5E7EB", color: "#374151" }}>
                  🍎 {t.addApple}
                </a>
              </div>

              {/* Client info */}
              <div className="pt-2 pb-1 text-center">
                <p className="text-xs" style={{ color: "#9CA3AF" }}>
                  {appt.clientName} · {appt.clientEmail}
                </p>
              </div>

            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-xs mt-6" style={{ color: "#9CA3AF" }}>
            © {new Date().getFullYear()} FastForward ® | FDA Experts · Miami, FL ·{" "}
            <a href="https://fastfwdus.com" style={{ color: "#C9A84C" }}>fastfwdus.com</a>
            {" "}· {t.footer}
          </p>
        </div>
      </main>
    </div>
  );
}
