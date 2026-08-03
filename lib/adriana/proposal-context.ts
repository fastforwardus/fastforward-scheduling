import { db } from "@/db";
import { proposals, appointments } from "@/db/schema";
import { eq, desc, sql, and, isNotNull } from "drizzle-orm";
import { normalizeWhatsAppPhone, phoneTail } from "@/lib/phone";

export interface ProposalContext {
  proposalNum: string;
  total: number;
  services: string;
  lang: string | null;
  stage: number | null;
}

/**
 * Busca una propuesta pendiente asociada al telefono que escribe.
 * Sirve para que Adriana entienda de que habla el cliente cuando responde
 * un recordatorio, en vez de arrancar como si fuera un lead frio.
 *
 * El match se hace en JS por los ultimos 8 digitos: los telefonos guardados
 * tienen formatos mixtos (con/sin +, con/sin 9 en AR) y compararlos en SQL
 * requeriria normalizar del lado del motor. El volumen es chico (~500 filas).
 */
export async function getProposalContext(waPhone: string): Promise<ProposalContext | null> {
  const tail = phoneTail(normalizeWhatsAppPhone(waPhone));
  if (tail.length < 8) return null;

  try {
    const rows = await db
      .select({
        proposalNum: proposals.proposalNum,
        total: proposals.total,
        services: proposals.services,
        lang: proposals.lang,
        stage: proposals.whatsappStage,
        phone: appointments.clientWhatsapp,
      })
      .from(proposals)
      .innerJoin(appointments, sql`${appointments.id}::text = ${proposals.appointmentId}`)
      .where(and(
        eq(proposals.status, "pending"),
        isNotNull(appointments.clientWhatsapp),
      ))
      .orderBy(desc(proposals.createdAt));

    const hit = rows.find((r) => phoneTail(r.phone) === tail);
    if (!hit) return null;

    return {
      proposalNum: hit.proposalNum,
      total: hit.total,
      services: hit.services,
      lang: hit.lang,
      stage: hit.stage,
    };
  } catch (err) {
    console.error("[proposal-context] error:", err);
    return null;
  }
}
