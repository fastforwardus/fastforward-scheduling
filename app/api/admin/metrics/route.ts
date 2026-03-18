import { NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session || session.role === "sales_rep") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [allAppts, allUsers] = await Promise.all([
    db.select({
      id: appointments.id,
      status: appointments.status,
      outcome: appointments.outcome,
      assignedTo: appointments.assignedTo,
      scheduledAt: appointments.scheduledAt,
      createdAt: appointments.createdAt,
      platform: appointments.platform,
      leadScore: appointments.leadScore,
      bookedVia: appointments.bookedVia,
    }).from(appointments),
    db.select({ id: users.id, fullName: users.fullName, role: users.role, slug: users.slug })
      .from(users).where(eq(users.isActive, true)),
  ]);

  const last30 = allAppts.filter(a => new Date(a.createdAt) >= thirtyDaysAgo);
  const last7  = allAppts.filter(a => new Date(a.createdAt) >= sevenDaysAgo);

  // Funnel
  const total        = allAppts.length;
  const assigned     = allAppts.filter(a => a.assignedTo).length;
  const completed    = allAppts.filter(a => a.status === "completed").length;
  const noShow       = allAppts.filter(a => a.status === "no_show").length;
  const withOutcome  = allAppts.filter(a => a.outcome).length;
  const proposalSent = allAppts.filter(a => a.outcome === "proposal_sent" || a.outcome === "closed").length;
  const closed       = allAppts.filter(a => a.outcome === "closed").length;
  const interested   = allAppts.filter(a => a.outcome === "interested").length;

  // Show rate
  const showRate = completed + noShow > 0
    ? Math.round((completed / (completed + noShow)) * 100) : 0;

  // Conversion rate
  const conversionRate = completed > 0
    ? Math.round((closed / completed) * 100) : 0;

  // Por plataforma
  const byPlatform = {
    meet:      allAppts.filter(a => a.platform === "meet").length,
    zoom:      allAppts.filter(a => a.platform === "zoom").length,
    whatsapp:  allAppts.filter(a => a.platform === "whatsapp").length,
  };

  // Por booking source
  const bySource = {
    general:  allAppts.filter(a => a.bookedVia === "general").length,
    personal: allAppts.filter(a => a.bookedVia !== "general").length,
  };

  // Por lead score
  const byScore = {
    hot:  allAppts.filter(a => a.leadScore === "hot").length,
    warm: allAppts.filter(a => a.leadScore === "warm").length,
    cold: allAppts.filter(a => a.leadScore === "cold").length,
  };

  // Por rep
  const reps = allUsers.filter(u => u.role !== "admin");
  const byRep = reps.map(rep => {
    const mine = allAppts.filter(a => a.assignedTo === rep.id);
    const myCompleted = mine.filter(a => a.status === "completed").length;
    const myNoShow    = mine.filter(a => a.status === "no_show").length;
    const myClosed    = mine.filter(a => a.outcome === "closed").length;
    const myProposal  = mine.filter(a => a.outcome === "proposal_sent").length;
    return {
      id: rep.id,
      name: rep.fullName,
      slug: rep.slug,
      role: rep.role,
      total: mine.length,
      completed: myCompleted,
      noShow: myNoShow,
      closed: myClosed,
      proposal: myProposal,
      showRate: myCompleted + myNoShow > 0 ? Math.round((myCompleted / (myCompleted + myNoShow)) * 100) : 0,
      convRate: myCompleted > 0 ? Math.round((myClosed / myCompleted) * 100) : 0,
    };
  });

  // Citas por dia (ultimos 14 dias)
  const dailyMap: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    dailyMap[key] = 0;
  }
  allAppts.forEach(a => {
    const key = new Date(a.scheduledAt).toISOString().split("T")[0];
    if (dailyMap[key] !== undefined) dailyMap[key]++;
  });
  const daily = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

  return NextResponse.json({
    summary: { total, assigned, completed, noShow, withOutcome, proposalSent, closed, interested, showRate, conversionRate },
    last30: { total: last30.length },
    last7:  { total: last7.length },
    byPlatform, bySource, byScore, byRep, daily,
  });
}
