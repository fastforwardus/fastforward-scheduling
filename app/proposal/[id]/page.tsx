import { db } from "@/db";
import { proposals, appointments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import AcceptProposalClient from "@/components/AcceptProposalClient";

export const dynamic = "force-dynamic";

export default async function ProposalPage({ params }: { params: { id: string } }) {
  const [proposal] = await db.select().from(proposals)
    .where(eq(proposals.id, params.id)).limit(1);

  if (!proposal) notFound();

  const [appt] = await db.select({
    clientName: appointments.clientName,
    clientCompany: appointments.clientCompany,
    clientEmail: appointments.clientEmail,
  }).from(appointments).where(eq(appointments.id, proposal.appointmentId)).limit(1);

  // Las propuestas directas no tienen cita: los datos del cliente viven en la
  // propia propuesta. Sin este respaldo el bloque "Para" salia vacio.
  const cliente = {
    clientName: appt?.clientName || proposal.clientName || "",
    clientCompany: appt?.clientCompany || "",
    clientEmail: appt?.clientEmail || proposal.clientEmail || "",
  };
  return <AcceptProposalClient proposal={{...proposal, services: proposal.services || "[]"}} client={cliente} />;
}
