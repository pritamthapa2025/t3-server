# T3 Server — documentation index

Backend path: **`C:\Users\ASCE\Desktop\t3-server`**. The root **[README.md](../README.md)** covers database timestamp conventions and links here.

---

## Technical docs (`docs/technical/`)

| Document | Description |
|----------|-------------|
| [technical/database-schema-and-erd.md](./technical/database-schema-and-erd.md) | PostgreSQL schemas, Drizzle tables, ERD notes, migration commands |
| [technical/api-reference.md](./technical/api-reference.md) | HTTP routes under `/api/v1`, auth, examples |
| [technical/environment-variables.md](./technical/environment-variables.md) | All `process.env` variables used by the server |

## Admin & operations (`docs/admin/`)

| Document | Description |
|----------|-------------|
| [admin/user-roles-and-permissions-reference.md](./admin/user-roles-and-permissions-reference.md) | Roles, modules, access levels, SQL for auditing RBAC |
| [admin/system-administrator-guide.md](./admin/system-administrator-guide.md) | Deployment checklist, cron, DB ops, security, support |

**Other** (repo root `docs/`):

| Document | Description |
|----------|-------------|
| [server-pdf-setup.md](../server-pdf-setup.md) | PDF / Puppeteer setup |
| [bids-erd.md](../bids-erd.md) | Bids-focused ERD notes |

**Frontend:** `C:\Users\ASCE\Desktop\t3-frontend\t3-frontend\docs\README.md`

---

## Repository layout (short)

| Path | Role |
|------|------|
| `src/server.ts` | HTTP server bootstrap, DB init, Socket.IO, `PORT` |
| `src/app.ts` | Express app: Helmet, CORS, JSON limits, `/health`, `/api/v1` |
| `src/routes/` | Route modules (`auth/`, `org/`, `config/`, `cron/`) |
| `src/controllers/` | Request handlers |
| `src/services/` | Business logic |
| `src/repositories/` | DB access helpers (where used) |
| `src/drizzle/schema/` | Drizzle table definitions |
| `src/drizzle/migrations/` | SQL migrations |
| `src/middleware/` | Auth, validation, rate limits, errors |
| `src/config/` | DB pool, Redis, Socket.IO |
| `src/validations/` | Zod schemas for HTTP input |
| `dist/` | Compiled output (`npm run build`) |

---

## Scripts (quick reference)

| Command | Purpose |
|---------|---------|
| `npm run dev` | Nodemon dev server |
| `npm run build` / `npm start` | Production compile + run |
| `npm run db:generate` / `db:migrate` | Drizzle migrations |
| `npm run db:studio` | Drizzle Studio |
| `npm run health-check` | Environment smoke checks |

---

## Contributing to docs

- Add new technical pages under **`docs/technical/`**.
- Link them from this index and from the root **README.md** § Documentation when they are stable.
