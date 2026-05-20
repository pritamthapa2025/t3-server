# Environment variables and configuration — T3 Server

This guide lists environment variables read by **t3-server** (`C:\Users\ASCE\Desktop\t3-server`), what each is for, and safe defaults. It also references the **Next.js frontend** (`t3-frontend`) variables that must point at this API.

**Security:** Never commit real `.env` files. Use your host’s secret store (EasyPanel, Doppler, etc.) in production.

---

## 1. Required for server boot

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string for Drizzle ORM and `pg` pool. Validated in `src/server.ts` and `src/config/db.ts`. |
| `REDIS_URL` | **Yes** | Redis connection for 2FA codes, password reset, email-change flows, token blacklist patterns, etc. Server exits if unset (`src/server.ts`). |

---

## 2. Core HTTP server

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `4000` | HTTP listen port (`src/server.ts`). Align `NEXT_PUBLIC_API_URL` on the frontend with this value. |
| `NODE_ENV` | — | `production` enables stricter cookies, HSTS (`src/app.ts`), and controls error detail in JSON (`src/middleware/errorHandler.ts`). |
| `GLOBAL_RATE_LIMIT_MAX` | `2000` | Max HTTP requests per client IP per 15 minutes (`src/middleware/rateLimiter.ts`). Use `2000` in production; raise on staging only for load tests (e.g. `50000`–`100000`). Invalid or non-positive values fall back to `2000`. |

---

## 3. CORS, client URL, and reverse proxy

| Variable | Purpose |
|----------|---------|
| `CLIENT_URL` | Primary browser origin for the SPA (CORS + Socket.IO + email links). Default fallback `http://localhost:3000` in `src/app.ts`, `src/config/socket.ts`, several services. |
| `CLIENT_URL_Old` | Optional second origin (legacy migration); included in CORS/Socket allowlist when set (`src/app.ts`, `src/config/socket.ts`). |

Express uses `trust proxy` = **1** so `X-Forwarded-For` / `X-Forwarded-Proto` work behind EasyPanel/Traefik (`src/app.ts`).

---

## 4. Authentication and JWT

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Signs and verifies access JWTs (`src/utils/jwt.ts`). **Must** be a long random string in production. |

### Trusted device / 2FA encryption

| Variable | Purpose |
|----------|---------|
| `TWO_FA_ENCRYPTION_KEY` | Encrypts 2FA secrets in Redis (`src/utils/twoFactor.ts`). If unset, a random key is generated at startup (unsuitable for multi-instance production unless synchronized). |

### Auth middleware tuning (`src/middleware/auth.ts`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `AUTH_CACHE_TTL` | `300000` (5 min) | In-memory auth resolution cache TTL (ms). |
| `AUTH_CACHE_MAX_SIZE` | `10000` | Max cache entries. |
| `AUTH_CACHE_ENABLED` | enabled | Set to `false` to disable cache. |
| `AUTH_DB_TIMEOUT` | `5000` | DB timeout for auth lookups (ms). |

---

## 5. Socket.IO

| Variable | Purpose |
|----------|---------|
| `SOCKET_IO_URL` | Public WebSocket base URL returned to clients from `GET /api/v1/config/client` (`src/routes/config/configRoutes.ts`). If unset, derived from request `Host` + `X-Forwarded-Proto`. |
| `SOCKET_IO_PING_TIMEOUT` | `60000` | Socket.IO server option (`src/config/socket.ts`). |
| `SOCKET_IO_PING_INTERVAL` | `25000` | Socket.IO server option. |

**Frontend:** set `NEXT_PUBLIC_SOCKET_URL` to the same origin the browser should use (see frontend `lib/socket/socket-client.ts`).

---

## 6. DigitalOcean Spaces (S3-compatible storage)

Used by `src/services/storage.service.ts` (uploads, presigned URLs, file pipeline).

| Variable | Default | Purpose |
|----------|---------|---------|
| `DO_SPACES_ENDPOINT` | `""` | S3 API endpoint URL. |
| `DO_SPACES_REGION` | `nyc3` | Region slug. |
| `DO_SPACES_ACCESS_KEY_ID` | `""` | Access key. |
| `DO_SPACES_SECRET_ACCESS_KEY` | `""` | Secret key. |
| `DO_SPACES_BUCKET` | `""` | Bucket name. |
| `DO_SPACES_CDN_URL` | `""` | Optional CDN base for public URLs. |
| `DO_SPACES_UPLOAD_TIMEOUT` | `30000` | Upload timeout (ms). |

---

## 7. Email (Brevo)

| Variable | Default | Purpose |
|----------|---------|---------|
| `BREVO_API_KEY` | — | API key (`src/services/email.service.ts`, `src/services/notification-email.service.ts`). |
| `BREVO_SENDER_EMAIL` | `noreply@example.com` / `notifications@t3mechanical.com` | From address (varies by service file). |
| `BREVO_SENDER_NAME` | `T3 Mechanical` | Display name (`email.service.ts`). |

---

## 8. SMS (Twilio)

| Variable | Purpose |
|----------|---------|
| `TWILIO_ACCOUNT_SID` | Account SID (`src/services/notification-sms.service.ts`). |
| `TWILIO_AUTH_TOKEN` | Auth token. |
| `TWILIO_PHONE_NUMBER` | Sender number. |

If unset, SMS sending is effectively disabled (service should no-op or fail gracefully depending on call path).

---

## 9. Google Calendar (Workspace)

| Variable | Purpose |
|----------|---------|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Inline JSON for a Google service account (preferred for containers). |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | Path to JSON key file on disk. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Standard Google env; used as fallback path. |
| `GOOGLE_WORKSPACE_DOMAIN` | Workspace domain for user lookup / calendar delegation. |
| `NAIVE_APP_TIMEZONE` | Default IANA timezone for “naive” date handling in calendar flows. |

---

## 10. Cron (external schedulers)

| Variable | Purpose |
|----------|---------|
| `CRON_SECRET` | Required for **any** `/api/v1/cron/*` route. Send as `X-Cron-Secret` or `Authorization: Bearer <CRON_SECRET>`. If unset, cron returns **503** (`src/routes/cron/cronRoutes.ts`). |
| `CRON_SYSTEM_USER_ID` | User UUID used when cron jobs attribute actions to a system user (`src/services/bid.service.ts` — bid expiry, etc.). |

---

## 11. PDF / Puppeteer

| Variable | Purpose |
|----------|---------|
| `PUPPETEER_EXECUTABLE_PATH` | Chromium path in constrained environments (`src/services/pdf.service.ts`). |
| `PATH` | Standard OS path; consulted when resolving browser binary. |

---

## 12. Payroll and business defaults

| Variable | Default | Purpose |
|----------|---------|---------|
| `T3_PAYROLL_DEFAULT_DEDUCTION_RATE` | `0` | Parsed as float; default deduction rate in payroll calculations (`src/services/payroll.service.ts`). |

---

## 13. Caching TTLs (performance tuning)

| Variable | Default | Source |
|----------|---------|--------|
| `SETTINGS_READ_CACHE_TTL_MS` | `30000` | `src/services/settings.service.ts` |
| `UI_PERMISSIONS_CACHE_TTL_MS` | `90000` | `src/services/uiPermissions.service.ts` |
| `ROLE_CONTEXT_CACHE_TTL_MS` | `60000` | `src/services/featurePermission.service.ts` |
| `HAS_FEATURE_ACCESS_CACHE_TTL_MS` | `20000` | `featurePermission.service.ts` |
| `MODULE_FEATURES_CACHE_TTL_MS` | `60000` | `featurePermission.service.ts` |
| `ORG_AGGREGATE_CACHE_TTL_MS` | `0` (disabled) | `src/utils/org-aggregate-cache.ts` |

---

## 14. Tooling / scripts only

These appear in `drizzle.config.ts`, `scripts/*`, or one-off migrations — not required for normal `node dist/server.js` runtime unless you run those tools:

- `DATABASE_URL` (again) for Drizzle CLI, `scripts/health-check.ts`, `scripts/migrate.ts`, etc.

---

## 15. Frontend (Next.js) alignment

Configure in **`t3-frontend`** (typically `.env.local`):

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | Base URL of this API, e.g. `https://api.example.com` or `http://localhost:4000`. Must match `PORT` / reverse-proxy path. |
| `NEXT_PUBLIC_APP_URL` | Public URL of the Next app (deep links, file share URLs). |
| `NEXT_PUBLIC_SOCKET_URL` | Socket.IO URL the browser connects to (often same host as API or explicit `wss://`). |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Maps client key where used (Places, etc.). |

---

## 16. Quick production checklist

1. Set `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `CRON_SECRET` (if using cron), `CLIENT_URL`.  
2. Set all `DO_SPACES_*` variables if file uploads are required.  
3. Set `BREVO_*` for outbound email; `TWILIO_*` if SMS notifications are required.  
4. Set Google variables if calendar integration is required.  
5. Set `SOCKET_IO_URL` if the browser cannot infer the correct WebSocket origin behind your proxy.  
6. Set `TWO_FA_ENCRYPTION_KEY` to a stable secret before scaling to multiple API instances.  
7. Run migrations: `npm run db:migrate` (or your deployment equivalent).

---

## 17. Generating a template `.env.example`

The repository may not ship `.env.example` (gitignored secrets). To create one for onboarding, copy the tables above into a file with empty values and comments, or run:

```bash
# From t3-server root — audit only, does not print secret values
npm run health-check
```

`scripts/health-check.ts` validates `DATABASE_URL`, `REDIS_URL`, `PORT`, and `NODE_ENV` presence patterns.
