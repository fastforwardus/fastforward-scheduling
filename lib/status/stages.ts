import { portal } from "./portal-db";
import { logEvent, touch } from "./queries";

export type StageResult =
  | { ok: true; filingCompleted: boolean; completedStage: string; nextStage: string | null }
  | { ok: false; error: string };

/** Replica completeStage del portal: completa la etapa activa, activa la siguiente o cierra el filing. */
export async function completeActiveStage(filingId: string, actor: { email: string; name: string }): Promise<StageResult> {
  const stages = await portal`SELECT id, position, name_es, name_en, status FROM filing_stages WHERE filing_id = ${filingId} ORDER BY position`;
  const current = stages.find((s) => s.status === "active");
  if (!current) return { ok: false, error: "No hay etapa activa en este trámite" };
  const next = stages.filter((s) => s.position > current.position).find((s) => s.status === "pending");

  const result = await portal.begin(async (t) => {
    const tx = t as unknown as typeof portal;
    await tx`UPDATE filing_stages SET status = 'completed', completed_at = now() WHERE id = ${current.id}`;
    let filingCompleted = false;
    if (next) {
      await tx`UPDATE filing_stages SET status = 'active', started_at = now() WHERE id = ${next.id}`;
    } else {
      await tx`UPDATE filings SET status = 'completed', actual_end_date = now() WHERE id = ${filingId}`;
      await tx`INSERT INTO case_meta (filing_id, closed_reason, closed_at, closed_by) VALUES (${filingId}, 'completed', now(), ${actor.name})
               ON CONFLICT (filing_id) DO UPDATE SET closed_reason = 'completed', closed_at = now(), closed_by = ${actor.name}, updated_at = now()`;
      filingCompleted = true;
    }
    // activity_log del portal (misma forma que el portal; user_id solo si el email existe allá)
    const [u] = await tx`SELECT id FROM users WHERE lower(email) = lower(${actor.email}) LIMIT 1`;
    const [f] = await tx`SELECT name_es, name_en FROM filings WHERE id = ${filingId}`;
    await tx`INSERT INTO activity_log (actor_type, user_id, action, entity_type, entity_id, description_es, description_en, metadata)
             VALUES ('agent', ${u?.id ?? null}, ${filingCompleted ? "filing_completed" : "stage_completed"}, ${filingCompleted ? "filing" : "stage"},
                     ${filingCompleted ? filingId : current.id},
                     ${filingCompleted ? `Completó el trámite "${f.name_es}" (desde Status)` : `Completó la etapa "${current.name_es}" de "${f.name_es}" (desde Status)`},
                     ${filingCompleted ? `Completed filing "${f.name_en}" (from Status)` : `Completed stage "${current.name_en}" of "${f.name_en}" (from Status)`},
                     ${tx.json({ filingId, stageId: current.id, stageName: current.name_es, filingCompleted, actor: actor.name })})`;
    await tx`INSERT INTO case_comments (filing_id, author_email, author_name, kind, body)
             VALUES (${filingId}, ${actor.email}, ${actor.name}, 'system',
                     ${filingCompleted ? `Trámite completado (última etapa: ${current.name_es})` : `Etapa completada: ${current.name_es} → ahora en: ${next!.name_es}`})`;
    return { filingCompleted };
  });

  await touch(filingId);
  await logEvent(filingId, actor, "stage_complete", { stage: current.name_es }, { next: next?.name_es ?? null, filingCompleted: result.filingCompleted });
  return { ok: true, filingCompleted: result.filingCompleted, completedStage: current.name_es, nextStage: next?.name_es ?? null };
}
