export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql, eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let soloMio: string | null = null;
  if (session.role === "sales_rep") {
    const [u] = await db.select({ can: users.canRecovery }).from(users)
      .where(eq(users.id, session.id)).limit(1);
    if (!u?.can) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    soloMio = session.id;
  } else if (session.role === "sales_manager") {
    // Los managers gestionan su propio recupero, no el del equipo entero.
    // Solo admin y el rol recovery dedicado ven la lista completa.
    soloMio = session.id;
  }

  try {
    // Universo 1: propuestas enviadas y no aceptadas.
    // Universo 2: citas completadas sin cierre que no tengan ya una
    // propuesta pendiente — si no, la misma gestion aparece dos veces.
    const res = await db.execute(sql`
      with notas as (
        select source_type, source_id,
               count(*)::int n,
               max(created_at) last_at,
               (array_agg(content order by created_at desc))[1] last_content
        from recovery_notes group by source_type, source_id
      )
      select 'proposal' as source_type,
             p.id::text as source_id,
             coalesce(p.client_name, a.client_name) as client_name,
             a.client_company, a.client_whatsapp as client_phone,
             p.client_email,
             coalesce(u.full_name, ua.full_name) as rep_name,
             coalesce(p.lang, a.client_language::text) as client_language,
             a.service_interest, p.total,
             coalesce(p.whatsapp_stage, 0) as wa_stage,
             p.created_at as ref_date,
             n.last_content as last_note, n.last_at as last_note_at,
             coalesce(n.n, 0) as note_count
      from proposals p
      left join appointments a on a.id::text = p.appointment_id
      left join users u on u.id = p.sent_by_id
      left join users ua on ua.id = a.assigned_to
      left join notas n on n.source_type = 'proposal' and n.source_id = p.id::text
      where p.status = 'pending'
        and (${soloMio}::uuid is null or p.sent_by_id = ${soloMio}::uuid)
        and not exists (
          select 1 from call_logs cl
          where cl.source_type = 'proposal' and cl.source_id = p.id::text
        )
      union all
      select 'appointment', a.id::text,
             a.client_name, a.client_company, a.client_whatsapp, a.client_email,
             u.full_name, a.client_language::text, a.service_interest, null,
             null::int as wa_stage,
             a.scheduled_at,
             n.last_content, n.last_at, coalesce(n.n, 0)
      from appointments a
      left join users u on u.id = a.assigned_to
      left join notas n on n.source_type = 'appointment' and n.source_id = a.id::text
      where a.status = 'completed'
        and (a.outcome is null or a.outcome <> 'closed')
        and not exists (
          select 1 from proposals p2
          where p2.appointment_id = a.id::text and p2.status = 'pending'
        )
        and (${soloMio}::uuid is null or a.assigned_to = ${soloMio}::uuid)
        and not exists (
          select 1 from call_logs cl
          where cl.source_type = 'appointment' and cl.source_id = a.id::text
        )
      -- Prioridad: una propuesta que agoto el seguimiento automatico (etapa 4)
      -- no va a recibir nada mas del sistema y depende de que alguien la
      -- trabaje. Dentro de ese grupo manda el monto. Las que siguen en
      -- seguimiento van despues, y las citas al final por fecha.
      order by
        case when source_type = 'proposal' and coalesce(wa_stage, 0) >= 4 then 0
             when source_type = 'proposal' then 1
             else 2 end,
        coalesce(total, 0) desc,
        ref_date desc
      limit 2000
    `);

    // postgres-js devuelve el array directo; otros drivers, { rows: [...] }.
    // Normalizamos para no depender del shape.
    const raw = (Array.isArray(res)
      ? res
      : ((res as unknown as { rows?: Record<string, unknown>[] }).rows ?? [])
    ) as Record<string, unknown>[];

    const items = raw.map((r) => ({
      sourceType: r.source_type as "proposal" | "appointment",
      sourceId: String(r.source_id),
      clientName: (r.client_name as string) ?? null,
      clientCompany: (r.client_company as string) ?? null,
      clientPhone: (r.client_phone as string) ?? null,
      clientEmail: (r.client_email as string) ?? null,
      repName: (r.rep_name as string) ?? null,
      clientLanguage: (r.client_language as string) ?? "es",
      serviceInterest: (r.service_interest as string) ?? null,
      total: r.total != null ? Number(r.total) : null,
      waStage: r.wa_stage != null ? Number(r.wa_stage) : null,
      refDate: new Date(r.ref_date as string).toISOString(),
      lastNote: (r.last_note as string) ?? null,
      lastNoteAt: r.last_note_at ? new Date(r.last_note_at as string).toISOString() : null,
      noteCount: Number(r.note_count ?? 0),
    }));

    return NextResponse.json({ items });
  } catch (err) {
    console.error("recovery/list error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
