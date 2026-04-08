import { db } from "@/db";
import { proposals } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import ProposalConfirmClient from "@/components/proposal/ProposalConfirmClient";

export const dynamic = "force-dynamic";

export default async function ProposalConfirmPage({ params }: { params: { token: string } }) {
  try {
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

    // Raw query para evitar el problema UUID
    const apptRows = await db.execute(
      sql`SELECT client_name, client_company, client_email, assigned_to FROM appointments WHERE id = ${proposal.appointmentId}::uuid LIMIT 1`
    ) as unknown as { rows: { client_name: string; client_company: string; client_email: string; assigned_to: string }[] };
    const appt = apptRows.rows?.[0];

    let repName = "FastForward FDA Experts";
    if (appt?.assigned_to) {
      const repRows = await db.execute(
        sql`SELECT full_name FROM users WHERE id = ${appt.assigned_to}::uuid LIMIT 1`
      ) as unknown as { rows: { full_name: string }[] };
      const rep = repRows.rows?.[0];
      if (rep) repName = rep.full_name;
    }

    const services = (typeof proposal.services === "string"
      ? JSON.parse(proposal.services || "[]")
      : proposal.services) as { name: string; description: string; price: number }[];

    return (
      <ProposalConfirmClient
        token={params.token}
        proposalNum={proposal.proposalNum}
        clientName={appt?.client_name || ""}
        clientCompany={appt?.client_company || ""}
        services={services}
        discount={proposal.discount || 0}
        total={proposal.total}
        lang={(proposal.lang || "es") as "es" | "en" | "pt"}
        status={proposal.status || "pending"}
        repName={repName}
      />
    );
  } catch (err) {
    console.error("ProposalConfirmPage error:", err);
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F8F9FB" }}>
        <div className="text-center p-8">
          <p className="text-2xl mb-2">⚠️</p>
          <p className="font-bold" style={{ color: "#27295C" }}>Error cargando la propuesta</p>
          <p className="text-sm mt-2" style={{ color: "#6B7280" }}>Por favor contactanos a info@fastfwdus.com</p>
        </div>
      </div>
    );
  }
}
