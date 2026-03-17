import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var _pgClient: postgres.Sql | undefined;
}

const client = global._pgClient ?? postgres(process.env.DATABASE_URL!, { max: 10 });

if (process.env.NODE_ENV !== "production") {
  global._pgClient = client;
}

export const db = drizzle(client, { schema });
export type DbClient = typeof db;
