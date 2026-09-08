const postgres = require("postgres");
require("dotenv").config({ path: ".env.production" });
const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });
(async () => {
  const [antes] = await sql`select id, scheduled_at,
    scheduled_at at time zone 'America/Mexico_City' mexico,
    scheduled_at at time zone 'America/New_York' miami
    from appointments where client_email = 'eserrato59@gmail.com'
    order by created_at desc limit 1`;
  console.log("ANTES:", antes);

  const [d] = await sql`update appointments
    set scheduled_at = '2026-09-08T16:00:00Z',
        client_timezone = 'America/Mexico_City'
    where id = ${antes.id}
    returning scheduled_at at time zone 'America/Mexico_City' mexico,
              scheduled_at at time zone 'America/New_York' miami`;
  console.log("DESPUES:", d);
  await sql.end();
})();
