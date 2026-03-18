import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

async function check() {
  const appts = await db.execute(
    `SELECT id, client_name, platform, meeting_link, confirm_token
     FROM appointments
     WHERE meeting_link IS NOT NULL
     LIMIT 5`
  );
  appts.forEach(a => {
    console.log(a.client_name, "|", a.platform, "|", a.meeting_link);
    console.log("  Confirm URL: /book/confirm/" + a.confirm_token);
  });
  await client.end();
}
check().catch(console.error);
