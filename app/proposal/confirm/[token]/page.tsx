import { db } from "@/db";
import { proposals, appointments, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import ProposalConfirmClient from "@/components/proposal/ProposalConfirmClient";

export const dynamic = "force-dynamic";

export default async function ProposalConfirmPage({ params }: { params: { token: string } }) {
  const [proposal] = await db.select().from(proposals)
    .where(eq(proposals.confirmToken, params.token)).limit(1);

  if (!proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F8F9FB" }}>
        <div className="text-center p-8">
          <p className="text-2xl mb-2">❌</p>
          <p className="font-bold" style={{ color: "#27295C" }}>Propuesta no encontrada</p>
          <p className="text-sm mt-2" style={{ color: "#6B7280" }}>El link puede haber expirado o ser inválido.</p>
        </div>
      </div>
    );
  }

  const [appt] = await db.select({
    clientName: appointments.clientName,
    clientCompany: appointments.clientCompany,
    clientEmail: appointments.clientEmail,
    assignedTo: appointments.assignedTo,
  }).from(appointments).where(eq(appointments.id, proposal.appointmentId as string)).limit(1);

  let repName = "FastForward FDA Experts";
  if (appt?.assignedTo) {
    const [rep] = await db.select({ fullName: users.fullName }).from(users)
      .where(eq(users.id, appt.assignedTo)).limit(1);
    if (rep) repName = rep.fullName;
  }

  const services = JSON.parse((proposal.services as string) || "[]") as { name: string; description: string; price: number }[];

  return (
    <ProposalConfirmClient
      token={params.token}
      proposalNum={proposal.proposalNum}
      clientName={appt?.clientName || ""}
      clientCompany={appt?.clientCompany || ""}
      services={services}
      discount={proposal.discount || 0}
      total={proposal.total}
      lang={(proposal.lang || "es") as "es" | "en" | "pt"}
      status={proposal.status || "pending"}
      repName={repName}
    />
  );
}
