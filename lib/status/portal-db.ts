import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var _portalPg: postgres.Sql | undefined;
}

/** Conexión de solo-uso a la base del portal (clients, filings, filing_stages + tablas case_*). */
export const portal: postgres.Sql =
  global._portalPg ?? postgres(process.env.PORTAL_DATABASE_URL!, { max: 5, prepare: false });

if (process.env.NODE_ENV !== "production") global._portalPg = portal;
