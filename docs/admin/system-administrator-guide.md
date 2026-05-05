# System administrator guide — T3 Mechanical

Audience: **IT / DevOps / application administrators** responsible for hosting the API, database, supporting integrations, and day-two operations. End-user “how to click” guides are separate (Google Docs).

**Repositories**

- API: `C:\Users\ASCE\Desktop\t3-server`
- Web app: `C:\Users\ASCE\Desktop\t3-frontend\t3-frontend`

---

## 1. Architecture snapshot

| Component | Role |
|-----------|------|
| **PostgreSQL** | Primary data store; Drizzle ORM + migrations. |
| **Redis** | Required at API boot — 2FA, password reset, email-change flows, token blacklist patterns. |
| **Express API** | REST under `/api/v1`, health at `/health`. |
| **Socket.IO** | Same process as HTTP; browser uses `NEXT_PUBLIC_SOCKET_URL` / `SOCKET_IO_URL`. |
| **Object storage** | S3-compatible (e.g. DigitalOcean Spaces) for uploads. |
| **Next.js** | SPA; calls API with `Authorization: Bearer <JWT>`. |

See also: `docs/technical/environment-variables.md`, `docs/technical/api-reference.md`.

---

## 2. First-time / greenfield deployment checklist

1. **Create PostgreSQL database** and a role with DDL+DML rights for migrations.  
2. **Create Redis instance** (persistent or managed).  
3. **Set core env vars** on the API: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `CLIENT_URL`, Spaces keys if using uploads, `BREVO_*` / `TWILIO_*` as needed, `GOOGLE_*` if using Calendar.  
4. **Run migrations:** `npm run db:migrate` (from `t3-server`).  
5. **Seed** roles, features, and baseline data using project scripts (see `package.json`), e.g. `npm run seed` for full seed, or **`npm run seed:features`** to refresh `auth.features` / `auth.role_features` from `featurePermissions.seed.ts`.  
6. **Create first Executive user** (initial invite / SQL / internal tool — follow your org’s onboarding procedure).  
7. **Configure frontend** `.env.local`: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SOCKET_URL`, Google Maps keys.  
8. **Verify:** `GET /health`, login + 2FA, dashboard load, one file upload if applicable.

---

## 3. Reverse proxy and TLS (EasyPanel / Traefik)

- Terminate **HTTPS** at the proxy; forward to Node with `X-Forwarded-Proto` and `X-Forwarded-Host`.  
- The API sets **`trust proxy` = 1** so client IP and URL generation behave correctly.  
- Align **`CLIENT_URL`** with the **browser origin** of the Next app (including `https://`).  
- If WebSocket connections fail, set **`SOCKET_IO_URL`** explicitly to the public URL clients should use.

---

## 4. Cron jobs

Scheduled tasks live under **`GET /api/v1/cron/*`** (see `src/routes/cron/cronRoutes.ts`).

| Requirement | Detail |
|-------------|--------|
| Secret | Set `CRON_SECRET`. Callers send `X-Cron-Secret` or `Authorization: Bearer <CRON_SECRET>`. |
| Response | **202 Accepted** — work runs asynchronously; monitor **logs** for failures. |
| Overlap | Avoid hammering the same endpoint with overlapping tight schedules. |

Optional: `CRON_SYSTEM_USER_ID` for jobs that attribute writes to a system user.

---

## 5. Database operations

| Task | Command / note |
|------|----------------|
| Apply migrations | `npm run db:migrate` |
| Generate SQL from schema drift | `npm run db:generate` |
| Inspect DB | `npm run db:studio` |
| Timestamp audit | `npm run db:audit-timestamptz` |

**Backups:** use your host’s PostgreSQL backup (point-in-time recovery recommended). Document **restore drill** separately.

---

## 6. User and access administration

### 6.1 Roles

Use the **[User roles and permissions reference](./user-roles-and-permissions-reference.md)** for the permission model. Practically:

- **Assign roles** only through supported UI or API (`/api/v1/auth/users`, Executive-level `assign_roles` in seed).  
- **Never** hand-edit JWTs — change `user_roles` and have the user **re-login**.

### 6.2 Lockouts and 2FA

- Too many bad 2FA attempts can trigger **account lock** notifications (see `AuthController` / notification service).  
- **Trusted devices** use httpOnly `device_token` cookie — clearing cookies forces full 2FA again.

### 6.3 Inactive users

Inactive or deleted users should fail authentication and Socket.IO connection (see `src/config/socket.ts`).

---

## 7. Observability and support

| Area | What to check |
|------|----------------|
| API logs | Structured API errors via `logger` middleware. |
| Health | `/health` is lightweight (no DB ping). For deeper checks use `npm run health-check`. |
| Redis | Loss of Redis blocks 2FA / reset flows — alert on connection errors at boot. |
| Storage | Spaces credential errors surface on upload routes; watch 5xx and slow requests. |

---

## 8. Security hardening reminders

- Rotate **`JWT_SECRET`** if leaked; invalidate all sessions.  
- Keep **`CRON_SECRET`** long and random; never append it to URLs (cron middleware rejects query-string secrets).  
- **Rate limits** apply to auth endpoints (`src/middleware/rateLimiter.js`).  
- **Helmet** + CORS are enabled on the API; only `CLIENT_URL` (+ localhost dev) are allowed origins by default.

---

## 9. Frontend administration (brief)

- **Build:** `pnpm build` in the frontend repo; serve with `pnpm start` or your edge static host.  
- **CSP / Maps:** `next.config.ts` may reference API and Socket URLs — keep envs in sync when domains change.  
- **Documentation index:** `t3-frontend/docs/README.md`.

---

## 10. Where to get help internally

| Topic | Document |
|-------|----------|
| Every HTTP route | `docs/technical/api-reference.md` |
| Env vars | `docs/technical/environment-variables.md` |
| Tables / Drizzle | `docs/technical/database-schema-and-erd.md` |
| PDF / Puppeteer | `docs/server-pdf-setup.md` |
| Permissions matrix | `docs/admin/user-roles-and-permissions-reference.md` |
