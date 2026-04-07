# t3-server

Backend API for T3 (Express, Drizzle ORM, PostgreSQL).

## Database timestamp conventions (audit)

**Static audit (Drizzle + migrations):**

- `timestamp()` from `drizzle-orm/pg-core` is used **without** `withTimezone: true`, so PostgreSQL columns are **`timestamp without time zone`** (naive wall time / literals preserved as intended for business datetimes).
- Many calendar-only fields use **`date()`** (PostgreSQL `date`).
- SQL files under `src/drizzle/migrations/` contain **no** `timestamptz` / `timestamp with time zone` DDL (aside from unrelated `AT TIME ZONE` in legacy display logic).
- [src/config/db.ts](src/config/db.ts) configures `pg` parsers so TIMESTAMP, DATE, and TIMESTAMPTZ OIDs are returned as **raw strings**, avoiding silent shifts when reading stored values.

**Live verification (per environment):**

Run against the database you want to check (staging, production, local):

```bash
pnpm run db:audit-timestamptz
```

Requires `DATABASE_URL`. If it is unset, the script prints the SQL below and exits successfully so you can run it manually.

Manual query:

```sql
SELECT table_schema, table_name, column_name, data_type
FROM information_schema.columns
WHERE data_type = 'timestamp with time zone'
  AND table_schema NOT IN ('pg_catalog', 'information_schema');
```

- **No rows:** deployed schema matches the repo audit (no `timestamptz` in user schemas).
- **Any rows:** decide per column whether `timestamptz` is intentional (true instants) or should be migrated to `timestamp` / `date` for naive business semantics.

**Note:** System columns such as `createdAt` are also modeled as naive `timestamp` in Drizzle; treating them as UTC at the application layer is a serialization choice, not a different PG type in the current schema.

## Documentation

- [docs/server-pdf-setup.md](docs/server-pdf-setup.md)
- [docs/bids-erd.md](docs/bids-erd.md)
