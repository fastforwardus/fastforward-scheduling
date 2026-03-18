import { db } from "@/db";
import { appointments, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Image from "next/image";
import { CheckCircle } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";

export default async function ConfirmAttendancePage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { confirmed?: string };
}) {
  const [appt] = await db
    .select({
      id: appointments.id,
      clientName: appointments.clientName,
      clientEmail: appointments.clientEmail,
      clientCompany: appointments.clientCompany,
      clientTimezone: appointments.clientTimezone,
      clientLanguage: appointments.clientLanguage,
      platform: appointments.platform,
      meetingLink: appointments.meetingLink,
      scheduledAt: appointments.scheduledAt,
      status: appointments.status,
      confirmToken: appointments.confirmToken,
      assignedTo: appointments.assignedTo,
    })
    .from(appointments)
    .where(eq(appointments.confirmToken, params.token))
    .limit(1);

  if (!appt) notFound();

  // Si viene sin ?confirmed=1, confirmar automaticamente
  if (!searchParams.confirmed) {
    await db.update(appointments)
      .set({ status: "confirmed" })
      .where(eq(appointments.confirmToken, params.token));
  }

  let repName = "";
  if (appt.assignedTo) {
    const [rep] = await db.select({ fullName: users.fullName })
      .from(users).where(eq(users.id, appt.assignedTo)).limit(1);
    if (rep) repName = rep.fullName;
  }

  const tz = appt.clientTimezone || "America/New_York";
  const lang = appt.clientLanguage || "es";
  const slotDate = new Date(appt.scheduledAt);

  const dateLocale = lang === "pt" ? "pt-BR" : lang === "en" ? "en-US" : "es-ES";
  const formattedDate = slotDate.toLocaleDateString(dateLocale, {
    weekday: "long", day: "numeric", month: "long", timeZone: tz,
  });
  const formattedTime = formatInTimeZone(slotDate, tz, "h:mm a");
  const platformLabel = appt.platform === "meet" ? "Google Meet" : appt.platform === "zoom" ? "Zoom" : "WhatsApp";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";

  const copy = {
    es: { title: "Asistencia confirmada", sub: "Te esperamos en la reunion", date: "Fecha y hora", platform: "Plataforma", expert: "Tu experto", join: "Unirse a la reunion", details: "Ver detalles completos" },
    en: { title: "Attendance confirmed", sub: "We look forward to meeting you", date: "Date & Time", platform: "Platform", expert: "Your expert", join: "Join meeting", details: "View full details" },
    pt: { title: "Presenca confirmada", sub: "Esperamos voce na reuniao", date: "Data e Hora", platform: "Plataforma", expert: "Seu especialista", join: "Entrar na reuniao", details: "Ver detalhes completos" },
  };
  const t = copy[lang as keyof typeof copy] || copy.es;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
         style={{ background: "#F8F9FB" }}>
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src="https://fastfwdus.com/wp-content/uploads/2025/05/logoR.png"
            alt="FastForward" width={160} height={36} className="object-contain dark:hidden" unoptimized
          />
          <Image
            src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png"
            alt="FastForward" width={160} height={36} className="object-contain hidden dark:block" unoptimized
          />
        </div>

        <div className="bg-white rounded-2xl overflow-hidden"
             style={{ boxShadow: "0 4px 32px rgba(39,41,92,0.08)", border: "1px solid #E5E7EB" }}>

          {/* Header */}
          <div className="px-6 py-5 text-center" style={{ background: "#27295C" }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                 style={{ background: "#C9A84C" }}>
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-lg font-bold text-white">{t.title}</h1>
            <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>{t.sub}</p>
          </div>

          {/* Details */}
          <div className="p-6 space-y-4">
            <div className="p-4 rounded-xl" style={{ background: "#F8F9FB", border: "1px solid #E5E7EB" }}>
              <table className="w-full">
                <tbody>
                  <tr>
                    <td className="py-2 border-b" style={{ borderColor: "#F0F0F0" }}>
                      <p className="text-xs uppercase tracking-widest" style={{ color: "#9CA3AF" }}>{t.date}</p>
                      <p className="font-semibold text-sm capitalize mt-0.5" style={{ color: "#27295C" }}>{formattedDate}</p>
                      <p className="font-bold" style={{ color: "#C9A84C" }}>{formattedTime}</p>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 border-b" style={{ borderColor: "#F0F0F0" }}>
                      <p className="text-xs uppercase tracking-widest" style={{ color: "#9CA3AF" }}>{t.platform}</p>
                      <p className="font-semibold text-sm mt-0.5" style={{ color: "#27295C" }}>{platformLabel}</p>
                    </td>
                  </tr>
                  {repName && (
                    <tr>
                      <td className="py-2">
                        <p className="text-xs uppercase tracking-widest" style={{ color: "#9CA3AF" }}>{t.expert}</p>
                        <p className="font-semibold text-sm mt-0.5" style={{ color: "#27295C" }}>{repName}</p>
                        <p className="text-xs" style={{ color: "#9CA3AF" }}>FastForward FDA Experts</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2.5">
              {appt.meetingLink && appt.platform !== "whatsapp" && (
                <a href={appt.meetingLink} target="_blank" rel="noreferrer"
                   className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
                   style={{ background: "#27295C", color: "white" }}>
                  🎥 {t.join}
                </a>
              )}
              <a href={`${appUrl}/book/confirm/${appt.confirmToken}`}
                 className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2"
                 style={{ borderColor: "#E5E7EB", color: "#374151" }}>
                {t.details}
              </a>
            </div>
          </div>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "#9CA3AF" }}>
          FastForward FDA Experts · Miami, FL ·{" "}
          <a href="https://fastfwdus.com" style={{ color: "#C9A84C" }}>fastfwdus.com</a>
        </p>
      </div>
    </div>
  );
}
