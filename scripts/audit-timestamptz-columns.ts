#!/usr/bin/env tsx
/**
 * Lists PostgreSQL columns with type `timestamp with time zone` (timestamptz).
 * Drizzle schema in this repo uses `timestamp()` without withTimezone — i.e. PG
 * `timestamp without time zone`. This script catches environment drift.
 *
 * Usage: pnpm exec tsx scripts/audit-timestamptz-columns.ts
 * Requires: DATABASE_URL in .env or environment.
 */

import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

const QUERY = `
SELECT table_schema, table_name, column_name, data_type
FROM information_schema.columns
WHERE data_type = 'timestamp with time zone'
  AND table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name, ordinal_position;
`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log(
      "DATABASE_URL is not set — skipping live audit. Set it and re-run, or run the SQL manually:\n",
    );
    console.log(QUERY.trim());
    process.exit(0);
  }

  const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 15000 });
  try {
    const client = await pool.connect();
    try {
      const { rows } = await client.query<{
        table_schema: string;
        table_name: string;
        column_name: string;
        data_type: string;
      }>(QUERY);
      if (rows.length === 0) {
        console.log(
          "OK: No `timestamp with time zone` columns in user schemas (matches Drizzle static audit).",
        );
        process.exit(0);
      }
      console.error(
        `Found ${rows.length} timestamptz column(s) — review each for business vs instant semantics:\n`,
      );
      for (const r of rows) {
        console.error(
          `  ${r.table_schema}.${r.table_name}.${r.column_name} (${r.data_type})`,
        );
      }
      process.exit(1);
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Live audit failed:", msg);
    process.exit(2);
  } finally {
    await pool.end();
  }
}

await main();
