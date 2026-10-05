// Reasigna todos los filings abiertos de Tomás Marino a Francisco Logarzo en el portal.
// Uso (el día que se vaya): node --env-file=.env.local scripts/reasignar-tomas.cjs apply
const postgres = require("postgres");
const sql = postgres(process.env.PORTAL_DATABASE_URL, { max: 1 });
const apply = process.argv[2] === "apply";
(async () => {
  const [de] = await sql`select id, name from users where lower(email) = 'tmarino@fastfwdus.com'`;
  const [a] = await sql`select id, name from users where lower(email) = 'flogarzo@fastfwdus.com'`;
  if (!de || !a) { console.error("No encuentro a Tomás o Francisco en users del portal"); process.exit(1); }
  const rows = await sql`select f.id, f.name_es from filings f where f.assigned_agent_id = ${de.id} and f.status not in ('completed','cancelled')`;
  console.log(`${rows.length} filings abiertos de ${de.name} → ${a.name}${apply ? "" : " (simulación; agrega 'apply' para ejecutar)"}`);
  if (apply && rows.length) {
    await sql.begin(async (tx) => {
      await tx`update filings set assigned_agent_id = ${a.id} where assigned_agent_id = ${de.id} and status not in ('completed','cancelled')`;
      await tx`update clients set owner_agent_id = ${a.id} where owner_agent_id = ${de.id}`;
      for (const r of rows) {
        await tx`insert into case_comments (filing_id, author_email, author_name, kind, body) values (${r.id}, 'system', 'Sistema', 'system', ${`Caso reasignado de ${de.name} a ${a.name}`})`;
        await tx`insert into case_events (filing_id, actor_name, action, before, after) values (${r.id}, 'Sistema', 'reassign', ${tx.json({ agent: de.name })}, ${tx.json({ agent: a.name })})`;
      }
    });
    console.log("Reasignación aplicada.");
  }
  await sql.end();
})();
