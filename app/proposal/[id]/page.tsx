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

  return <AcceptProposalClient proposal={{...proposal, services: proposal.services || "[]"}} client={appt} />;
}
