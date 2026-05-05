# HTTP API reference — T3 Server

Base URL pattern:

```text
{ORIGIN}/api/v1/...
```

Examples: `http://localhost:4000/api/v1` (default `PORT`), or your public API host behind EasyPanel/Traefik.

**Also exposed (outside `/api/v1`):**

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/health` | None | Liveness — always 200 JSON (`src/app.ts`). |

---

## 1. Conventions

### 1.1 Authentication

- Most org routes: **`Authorization: Bearer <jwt>`** where JWT is returned from login / 2FA (`src/middleware/auth.js`).
- **Trusted device:** optional `device_token` **httpOnly** cookie set after successful 2FA with `rememberDevice` (`AuthController`).
- **Cron:** `X-Cron-Secret: <CRON_SECRET>` **or** `Authorization: Bearer <CRON_SECRET>` (`src/routes/cron/cronRoutes.ts`). Query string secrets are **not** accepted.

### 1.2 Content types

- **`application/json`** for typical bodies (validated with Zod in `src/middleware/validate.js`).
- **`multipart/form-data`** for uploads; many controllers expect a stringified JSON field named **`data`** merged with files (bids, dispatch tasks, clients, jobs — see respective route files).

### 1.3 Success and error JSON

Controllers generally return `{ success: true, ... }` or `{ success: false, message: "..." }`.

**Global error handler** (`src/middleware/errorHandler.ts`):

- Database errors: `{ success: false, message, errorCode?, suggestions?, technicalDetails? }` (technical fields often dev-only).
- Other errors: `{ success: false, message, stack?, technicalDetails? }` (stack/technicalDetails in development).

**Validation failures** typically **400** with `ValidationError` message.

---

## 2. Request/response examples

### 2.1 Login (step 1 — password ok, 2FA required)

`POST /api/v1/auth/login`

**Request**

```http
POST /api/v1/auth/login HTTP/1.1
Content-Type: application/json

{"email":"user@example.com","password":"SecretStr0ng"}
```

**Response `200`**

```json
{
  "success": true,
  "message": "2FA code sent to email",
  "requiresVerification": true
}
```

**Response `200` (trusted device path — skips 2FA)**

```json
{
  "success": true,
  "message": "Login successful",
  "requiresVerification": false,
  "data": {
    "token": "<jwt>",
    "user": {
      "id": "<uuid>",
      "name": "Jane Doe",
      "email": "user@example.com",
      "role": "Manager",
      "employeeTableId": 42,
      "employeeId": "T3-0042",
      "timesheetBlockedForSafetyInspection": false
    },
    "trustedDevice": true
  }
}
```

### 2.2 Verify 2FA (step 2)

`POST /api/v1/auth/verify-2fa`

```json
{
  "email": "user@example.com",
  "code": "123456",
  "rememberDevice": true
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Verification successful",
  "data": {
    "token": "<jwt>",
    "user": {
      "id": "<uuid>",
      "name": "Jane Doe",
      "email": "user@example.com",
      "role": "Manager"
    },
    "deviceRemembered": true
  }
}
```

### 2.3 Current user profile

`GET /api/v1/auth/me` — header `Authorization: Bearer <jwt>`.

Typical shape: `{ success: true, data: { ...user..., permissions..., employee... } }` (see `getMeProfileBundle` in auth service).

### 2.4 Public client bootstrap

`GET /api/v1/config/client` — no auth.

```json
{
  "success": true,
  "config": {
    "socketUrl": "https://api.example.com"
  }
}
```

### 2.5 Cron job accepted

`GET /api/v1/cron/expire-bids` + cron auth headers → **`202`**

```json
{
  "success": true,
  "accepted": true,
  "job": "expire-bids"
}
```

---

## 3. Route index (complete)

Below, **“Bearer”** means JWT on `Authorization` unless noted. **“Cron”** means cron secret headers. **“Public”** means no JWT.

### 3.1 `/api/v1/config`

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/config/client` | Public |

### 3.2 `/api/v1/cron` (all `GET`; auth: Cron; response **202**)

| Path |
|------|
| `/cron/expire-bids` |
| `/cron/purge-deleted-files` |
| `/cron/purge-deleted-records` |
| `/cron/notify-jobs-overdue` |
| `/cron/notify-invoice-due-tomorrow` |
| `/cron/notify-invoice-overdue` |
| `/cron/notify-dispatch-log-reminder` |
| `/cron/send-weekly-timesheet-email` |
| `/cron/notify-maintenance-due` |
| `/cron/notify-inspection-expired` |
| `/cron/notify-vehicle-expiry` |
| `/cron/notify-performance-reviews` |
| `/cron/notify-inspection-upcoming` |
| `/cron/notify-po-delayed` |

If `CRON_SECRET` is unset → **`503`** `{ "success": false, "message": "Cron endpoints are not configured" }`.

### 3.3 `/api/v1/auth` (shared mount: `authRoutes` + `userRoutes` + `roleRoutes`)

| Method | Path | Auth | Notes |
|--------|------|------|------|
| `POST` | `/auth/login` | Public | Rate limit: login |
| `POST` | `/auth/verify-2fa` | Public | Rate limit |
| `POST` | `/auth/resend-2fa` | Public | Rate limit |
| `POST` | `/auth/request-password-reset` | Public | Rate limit |
| `POST` | `/auth/verify-reset-token` | Public | |
| `POST` | `/auth/confirm-password-reset` | Public | Rate limit |
| `POST` | `/auth/resend-password-reset-otp` | Public | Rate limit |
| `POST` | `/auth/setup-new-password` | Public | |
| `POST` | `/auth/request-change-password` | Bearer | |
| `POST` | `/auth/change-password` | Bearer | |
| `POST` | `/auth/resend-change-password-otp` | Bearer | Rate limit |
| `GET` | `/auth/me` | Bearer | |
| `GET` | `/auth/trusted-devices` | Bearer | |
| `DELETE` | `/auth/trusted-devices` | Bearer | Revoke all |
| `DELETE` | `/auth/trusted-devices/:deviceId` | Bearer | Revoke one |
| `POST` | `/auth/logout` | Public/cookie | Blacklists JWT server-side where applicable |
| `GET` | `/auth/users` | Bearer | List users |
| `POST` | `/auth/users` | Bearer | JSON or multipart (`profilePicture`) |
| `GET` | `/auth/users/:id` | Bearer | |
| `PUT` | `/auth/users/:id` | Bearer | JSON or multipart |
| `DELETE` | `/auth/users/:id` | Bearer | |
| `GET` | `/auth/roles` | Bearer | |
| `POST` | `/auth/roles` | Bearer | |
| `GET` | `/auth/roles/count` | Bearer | |
| `GET` | `/auth/roles/check-name` | Bearer | |
| `GET` | `/auth/roles/:id` | Bearer | |
| `PUT` | `/auth/roles/:id` | Bearer | |
| `DELETE` | `/auth/roles/:id` | Bearer | Soft delete |

### 3.4 `/api/v1/auth/user` (`uiPermissionsRoutes`)

All **`GET`** except one **`POST`**, all **Bearer**:

| Method | Path |
|--------|------|
| `GET` | `/auth/user/interface` |
| `GET` | `/auth/user/modules` |
| `GET` | `/auth/user/dashboard/config` |
| `GET` | `/auth/user/navigation` |
| `GET` | `/auth/user/modules/:module/ui` |
| `GET` | `/auth/user/modules/:module/ui/simple` |
| `GET` | `/auth/user/modules/:module/buttons` |
| `GET` | `/auth/user/modules/:module/features/:feature/check` |
| `POST` | `/auth/user/modules/:module/filter-data` |

### 3.5 `/api/v1/auth/settings` (Executive module `settings`; all Bearer)

| Method | Path |
|--------|------|
| `GET` / `PUT` | `/auth/settings/general` |
| `GET` | `/auth/settings/labor-rates` |
| `GET` / `PUT` / `DELETE` | `/auth/settings/labor-rates/:laborRatesId` |
| `GET` / `PUT` | `/auth/settings/vehicle-travel` |
| `GET` / `POST` | `/auth/settings/travel-origins` |
| `PATCH` | `/auth/settings/travel-origins/:id/set-default` |
| `GET` / `PUT` / `DELETE` | `/auth/settings/travel-origins/:id` |
| `GET` / `PUT` | `/auth/settings/operating-expenses` |
| `GET` / `POST` | `/auth/settings/proposal-basis-templates` |
| `GET` / `PUT` / `DELETE` | `/auth/settings/proposal-basis-templates/:id` |
| `GET` / `POST` | `/auth/settings/terms-conditions-templates` |
| `PATCH` | `/auth/settings/terms-conditions-templates/:id/set-default` |
| `GET` / `PUT` / `DELETE` | `/auth/settings/terms-conditions-templates/:id` |
| `GET` / `PUT` | `/auth/settings/invoice` |

### 3.6 `/api/v1/org` — Departments & positions

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/org/department/kpis` | Bearer |
| `GET` | `/org/department/list` | Bearer |
| `GET` | `/org/department/leads` | Bearer |
| `GET` / `POST` | `/org/department` | Bearer |
| `GET` / `PUT` / `DELETE` | `/org/department/:id` | Bearer |
| `POST` | `/org/departments/bulk-delete` | Bearer + feature `departments.bulk_delete` |
| `GET` | `/org/position/grouped` | Bearer |
| `GET` | `/org/position/list` | Bearer |

### 3.7 `/api/v1/org` — Employees & inspectors

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/org/inspector` | Bearer |
| `GET` | `/org/unassigned-drivers` | Bearer |
| `GET` | `/org/employees/technicians` | Bearer |
| `GET` | `/org/employees/managers-and-technicians` | Bearer |
| `GET` | `/org/employees/kpis` | Bearer |
| `POST` | `/org/employees/bulk-delete` | Bearer |
| `GET` / `POST` | `/org/employees` | Bearer |
| `GET` | `/org/employees/:id/jobs-and-dispatch` | Bearer |
| `GET` / `PUT` / `DELETE` | `/org/employees/:id` | Bearer |
| `GET` | `/org/employees/:employeeId/reviews/summary` | Bearer |
| `GET` / `POST` | `/org/employees/:employeeId/reviews` | Bearer |
| `GET` / `PUT` / `DELETE` | `/org/employees/:employeeId/reviews/:reviewId` | Bearer |

### 3.8 `/api/v1/org/reviews` (`reviewRoutes` mount)

All Bearer. Manager/Executive for mutating routes as coded.

| Method | Path |
|--------|------|
| `GET` | `/org/reviews/` |
| `GET` | `/org/reviews/analytics` |
| `GET` | `/org/reviews/templates` |
| `POST` | `/org/reviews/bulk` |
| `GET` / `POST` | `/org/reviews/` (POST create) |
| `GET` / `PUT` / `DELETE` | `/org/reviews/:id` |
| `GET` / `POST` | `/org/reviews/employees/:employeeId` |
| `GET` | `/org/reviews/employees/:employeeId/summary` |

### 3.9 `/api/v1/org` — Clients & reference data

| Method | Path | Notes |
|--------|------|------|
| `GET` | `/org/clients/kpis` | Financial permission |
| `GET` / `POST` | `/org/client-types` | |
| `GET` / `PUT` / `DELETE` | `/org/client-types/:id` | |
| `GET` / `POST` | `/org/industry-classifications` | |
| `GET` / `PUT` / `DELETE` | `/org/industry-classifications/:id` | |
| `GET` / `POST` | `/org/clients` | POST multipart |
| `GET` / `PUT` / `DELETE` | `/org/clients/:id` | |
| `GET` / `PUT` | `/org/clients/:id/settings` | |
| `GET` / `POST` | `/org/clients/:id/contacts` | |
| `GET` / `PUT` / `DELETE` | `/org/clients/:id/contacts/:contactId` | |
| `GET` / `POST` | `/org/clients/:id/notes` | |
| `GET` / `PUT` / `DELETE` | `/org/clients/:id/notes/:noteId` | |
| `GET` / `POST` | `/org/clients/:id/documents` | |
| `GET` / `PUT` / `DELETE` | `/org/clients/:id/documents/:documentId` | |
| `POST` | `/org/clients/:id/documents/:documentId/categories` | |
| `GET` | `/org/clients/:id/documents/:documentId/categories` | |
| `DELETE` | `/org/clients/:id/documents/:documentId/categories/:categoryId` | |
| `GET` / `POST` | `/org/document-categories` | |
| `GET` / `PUT` / `DELETE` | `/org/document-categories/:id` | |
| `PUT` | `/org/documents/:documentId/categories` | |
| `POST` | `/org/clients/bulk-delete` | Executive feature |
| `GET` | `/org/clients/:id/jobs` | |

### 3.10 `/api/v1/org` — Properties

| Method | Path |
|--------|------|
| `GET` | `/org/properties/kpis` |
| `GET` / `POST` | `/org/properties` |
| `GET` / `PUT` / `DELETE` | `/org/properties/:id` |
| `POST` | `/org/properties/:propertyId/contacts` |
| `GET` / `POST` | `/org/properties/:propertyId/equipment` |
| `GET` / `PUT` / `DELETE` | `/org/properties/:propertyId/equipment/:id` |
| `POST` | `/org/properties/:propertyId/documents` |
| `POST` | `/org/properties/:propertyId/service-history` |
| `GET` | `/org/properties/:propertyId/job-logs` |

### 3.11 `/api/v1/org` — Financial module (analytics + CRUD)

**Read-only section APIs**

| Method | Path |
|--------|------|
| `GET` | `/org/financial/summary` |
| `GET` | `/org/financial/jobs-summary` |
| `GET` | `/org/financial/cost-categories` |
| `GET` | `/org/financial/profitability` |
| `GET` | `/org/financial/profit-trend` |
| `GET` | `/org/financial/forecasting` |
| `GET` | `/org/financial/reports` |
| `GET` | `/org/financial/dashboard` |

**CRUD resources**

| Methods | Path |
|---------|------|
| `GET` `POST` | `/org/financial-summary` |
| `PUT` | `/org/financial-summary/:id` |
| `GET` `POST` | `/org/job-financial-summary` |
| `GET` `PUT` | `/org/job-financial-summary/:jobId` |
| `GET` `POST` | `/org/financial-cost-categories` |
| `PUT` `DELETE` | `/org/financial-cost-categories/:id` |
| `GET` `POST` | `/org/profit-trend` |
| `GET` `POST` | `/org/cash-flow-projection` |
| `PUT` | `/org/cash-flow-projection/:id` |
| `GET` | `/org/cash-flow-scenarios/:projectionId` |
| `POST` | `/org/cash-flow-scenarios` |
| `PUT` | `/org/cash-flow-scenarios/:id` |
| `GET` `POST` | `/org/revenue-forecast` |
| `PUT` | `/org/revenue-forecast/:id` |
| `GET` `POST` | `/org/financial-reports` |
| `PUT` `DELETE` | `/org/financial-reports/:id` |
| `GET` `POST` | `/org/financial-category-budgets` |
| `GET` `PUT` `DELETE` | `/org/financial-category-budgets/:id` |

### 3.12 `/api/v1/org` — Expenses & mileage

(See `expenseRoutes.ts` — all Bearer; feature gates per handler.)

| Method | Path |
|--------|------|
| `GET` | `/org/expense/category` |
| `GET` | `/org/expenses/kpis` |
| `GET` `POST` | `/org/expenses` |
| `GET` `PUT` `DELETE` | `/org/expenses/:id` |
| `POST` | `/org/expenses/:id/submit` |
| `POST` | `/org/expenses/:id/approve` |
| `POST` | `/org/expenses/:id/reject` |
| `GET` `POST` | `/org/expense-reports` |
| `GET` `PUT` `DELETE` | `/org/expense-reports/:id` |
| `POST` | `/org/expense-reports/:id/submit` |
| `GET` `POST` | `/org/mileage-logs` |
| `GET` `PUT` `DELETE` | `/org/mileage-logs/:id` |
| `POST` | `/org/mileage-logs/:id/verify` |
| `GET` | `/org/expenses/summary` |
| `GET` | `/org/mileage-logs/summary` |
| `GET` | `/org/employees/:employeeId/expense-summary` |
| `GET` | `/org/expenses/:expenseId/receipts` |
| `GET` | `/org/expenses/:expenseId/receipts/:receiptId` |
| `POST` | `/org/expenses/:expenseId/receipts` |
| `PUT` | `/org/expenses/:expenseId/receipts/:receiptId` |
| `DELETE` | `/org/expenses/:expenseId/receipts/:receiptId` |
| `POST` | `/org/expenses/bulk-delete` |

### 3.13 `/api/v1/org` — Timesheets

| Method | Path |
|--------|------|
| `GET` `POST` | `/org/timesheets` |
| `GET` | `/org/timesheets/my-timesheets` |
| `GET` | `/org/timesheets/weekly` |
| `GET` | `/org/timesheets/kpis` |
| `POST` | `/org/timesheets/log-time` |
| `GET` | `/org/timesheets/my-history` |
| `POST` | `/org/timesheets/weekly-confirm` |
| `PATCH` | `/org/timesheets/weekly-approve` |
| `PATCH` | `/org/timesheets/weekly-reject` |
| `POST` | `/org/timesheets/:id/approve` |
| `POST` | `/org/timesheets/:id/reject` |
| `GET` `PUT` `DELETE` | `/org/timesheets/:id` |
| `POST` | `/org/timesheets/bulk-delete` |
| `PUT` | `/org/timesheets/job-entries/:entryId` |
| `GET` | `/org/timesheets/jobs/:jobId/coverage-entries` |
| `POST` | `/org/timesheets/upload-media` |

### 3.14 `/api/v1/org` — Bids

All routes require **Bearer** + **`bids` module** permissions (`bidRoutes.ts`).  
Below, `:id` is bid id unless otherwise noted. **Multipart** applies to create/update bid, documents, media, walk photos where implemented.

**Core**

| Methods | Path |
|---------|------|
| `GET` | `/org/bids/kpis` |
| `GET` `POST` | `/org/bids` |
| `GET` `PUT` `DELETE` | `/org/bids/:id` |
| `GET` | `/org/bids/:id/complete` |
| `GET` | `/org/bids/:bidId/version-info` |
| `GET` | `/org/bids/:bidId/related-bids` |
| `PATCH` | `/org/bids/:bidId/marked` |

**Cost structure**

| Methods | Path |
|---------|------|
| `GET` `PUT` | `/org/bids/:bidId/financial-breakdown` |
| `GET` `POST` `PUT` `DELETE` | `/org/bids/:bidId/operating-expenses` |
| `GET` `POST` | `/org/bids/:bidId/materials` |
| `GET` `PUT` `DELETE` | `/org/bids/:bidId/materials/:materialId` |
| `GET` `POST` | `/org/bids/:bidId/labor` |
| `POST` | `/org/bids/:bidId/labor-travel/bulk` |
| `GET` `PUT` `DELETE` | `/org/bids/:bidId/labor/:laborId` |
| `GET` `POST` | `/org/bids/:bidId/travel` |
| `GET` `PUT` `DELETE` | `/org/bids/:bidId/travel/:travelId` |
| `GET` `POST` | `/org/bids/:bidId/labor/:laborId/travel` |
| `PUT` `DELETE` | `/org/bids/:bidId/labor/:laborId/travel/:travelId` |

**Typed bid payloads**

| Methods | Path |
|---------|------|
| `GET` `PUT` | `/org/bids/:bidId/survey-data` |
| `GET` `PUT` | `/org/bids/:bidId/plan-spec-data` |
| `GET` `POST` | `/org/bids/:bidId/plan-spec-files` |
| `DELETE` | `/org/bids/:bidId/plan-spec-files/:fileId` |
| `GET` `PUT` | `/org/bids/:bidId/design-build-data` |
| `GET` `POST` | `/org/bids/:bidId/design-build-files` |
| `DELETE` | `/org/bids/:bidId/design-build-files/:fileId` |
| `GET` `PUT` | `/org/bids/:bidId/service-data` |
| `GET` `PUT` | `/org/bids/:bidId/preventative-maintenance-data` |

**Collaboration & files**

| Methods | Path |
|---------|------|
| `GET` `POST` | `/org/bids/:bidId/timeline` |
| `PUT` `DELETE` | `/org/bids/:bidId/timeline/:eventId` |
| `GET` `POST` | `/org/bids/:bidId/notes` |
| `PUT` `DELETE` | `/org/bids/:bidId/notes/:noteId` |
| `GET` | `/org/bids/:bidId/history` |
| `GET` | `/org/bids/:bidId/kpis` |
| `GET` `POST` | `/org/bids/:bidId/documents` |
| `GET` `PUT` `DELETE` | `/org/bids/:bidId/documents/:documentId` |
| `GET` | `/org/bids/:bidId/documents/:documentId/preview` |
| `GET` | `/org/bids/:bidId/documents/:documentId/download` |
| `PATCH` | `/org/bids/:bidId/documents/:documentId/tags` |
| `GET` | `/org/bids/:bidId/media/tags` |
| `PATCH` | `/org/bids/:bidId/media/:mediaId/tags` |
| `GET` | `/org/bids/:bidId/walk-photos/tags` |
| `PATCH` | `/org/bids/:bidId/walk-photos/:walkPhotoId/tags` |
| `GET` `POST` | `/org/bids/:bidId/media` |
| `GET` `PUT` `DELETE` | `/org/bids/:bidId/media/:mediaId` |
| `GET` | `/org/bids/:bidId/media/:mediaId/preview` |
| `GET` | `/org/bids/:bidId/media/:mediaId/download` |
| `GET` `POST` | `/org/bids/:bidId/walk-photos` |
| `GET` `PUT` `DELETE` | `/org/bids/:bidId/walk-photos/:walkPhotoId` |
| `GET` | `/org/bids/:bidId/walk-photos/:walkPhotoId/preview` |
| `GET` | `/org/bids/:bidId/walk-photos/:walkPhotoId/download` |

**Quote delivery**

| Method | Path |
|--------|------|
| `GET` | `/org/bids/:id/pdf` |
| `GET` | `/org/bids/:id/pdf/preview` |
| `POST` | `/org/bids/:id/send` |
| `POST` | `/org/bids/:id/send-test` |
| `POST` | `/org/bids/bulk-delete` |

### 3.15 `/api/v1/org` — Jobs

Bearer + job feature middleware (`jobRoutes.ts`). Pattern `/org/jobs...`.

**Core & team**

| Methods | Path |
|---------|------|
| `GET` | `/org/jobs/kpis` |
| `GET` `POST` | `/org/jobs` |
| `GET` `PUT` `DELETE` | `/org/jobs/:id` |
| `POST` | `/org/jobs/:id/complete` |
| `GET` | `/org/jobs/:jobId/invoices/kpis` |
| `GET` | `/org/jobs/:jobId/labor/cost-tracking` |
| `GET` | `/org/jobs/:jobId/labor/actual-entries` |
| `GET` `POST` | `/org/jobs/:jobId/team-members` |
| `GET` | `/org/jobs/:jobId/assignable-technicians` |
| `DELETE` | `/org/jobs/:jobId/team-members/:employeeId` |

**Financial & cost**

| Methods | Path |
|---------|------|
| `GET` `PUT` | `/org/jobs/:jobId/financial-summary` |
| `GET` `PUT` | `/org/jobs/:jobId/financial-breakdown` |
| `GET` `POST` | `/org/jobs/:jobId/materials` |
| `GET` `PUT` `DELETE` | `/org/jobs/:jobId/materials/:materialId` |
| `GET` `POST` | `/org/jobs/:jobId/labor` |
| `GET` `PUT` `DELETE` | `/org/jobs/:jobId/labor/:laborId` |
| `GET` `POST` | `/org/jobs/:jobId/travel` |
| `GET` `PUT` `DELETE` | `/org/jobs/:jobId/travel/:travelId` |
| `GET` `PUT` | `/org/jobs/:jobId/operating-expenses` |

**Execution**

| Methods | Path |
|---------|------|
| `GET` `POST` | `/org/jobs/:jobId/timeline` |
| `GET` `PUT` `DELETE` | `/org/jobs/:jobId/timeline/:eventId` |
| `GET` `POST` | `/org/jobs/:jobId/notes` |
| `GET` `PUT` `DELETE` | `/org/jobs/:jobId/notes/:noteId` |
| `GET` | `/org/jobs/:jobId/history` |
| `GET` `POST` | `/org/jobs/:jobId/tasks` |
| `GET` `PUT` `DELETE` | `/org/jobs/:jobId/tasks/:taskId` |
| `GET` `POST` | `/org/jobs/:jobId/tasks/:taskId/comments` |
| `PUT` `DELETE` | `/org/jobs/:jobId/tasks/:taskId/comments/:id` |
| `GET` `POST` | `/org/jobs/:jobId/survey` |
| `GET` `PUT` `DELETE` | `/org/jobs/:jobId/survey/:id` |
| `GET` `POST` | `/org/jobs/:jobId/expenses` |
| `GET` `PUT` `DELETE` | `/org/jobs/:jobId/expenses/:expenseId` |
| `GET` `POST` | `/org/jobs/:jobId/documents` |
| `GET` `PUT` `DELETE` | `/org/jobs/:jobId/documents/:documentId` |
| `GET` | `/org/jobs/:jobId/documents/:documentId/download` |
| `POST` | `/org/jobs/bulk-delete` |

**Service & PM**

| Methods | Path |
|---------|------|
| `GET` `POST` | `/org/jobs/:jobId/service-calls` |
| `GET` `PUT` `DELETE` | `/org/jobs/:jobId/service-calls/:id` |
| `GET` `POST` | `/org/jobs/:jobId/pm-inspections` |
| `GET` `PUT` `DELETE` | `/org/jobs/:jobId/pm-inspections/:id` |
| `GET` `POST` | `/org/jobs/:jobId/plan-spec-records` |
| `GET` `PUT` `DELETE` | `/org/jobs/:jobId/plan-spec-records/:id` |
| `GET` `POST` | `/org/jobs/:jobId/design-build-notes` |
| `GET` `PUT` `DELETE` | `/org/jobs/:jobId/design-build-notes/:id` |

**Field logs**

| Methods | Path |
|---------|------|
| `GET` `POST` | `/org/jobs/:jobId/logs` |
| `GET` `PUT` `DELETE` | `/org/jobs/:jobId/logs/:logId` |
| `POST` | `/org/jobs/:jobId/logs/:logId/media` |
| `DELETE` | `/org/jobs/:jobId/logs/:logId/media/:mediaId` |

### 3.16 `/api/v1/org/dispatch` — Dispatch

> **Note:** KPI path in code is `/dispatch/kpis` on the **`/org/dispatch`** router → full path **`/api/v1/org/dispatch/dispatch/kpis`** (duplicate segment). Same for bulk delete: **`/api/v1/org/dispatch/dispatch/bulk-delete`**.

| Methods | Path |
|---------|------|
| `GET` | `/org/dispatch/dispatch/kpis` |
| `GET` `POST` | `/org/dispatch/tasks` |
| `GET` `PUT` `DELETE` | `/org/dispatch/tasks/:id` |
| `GET` | `/org/dispatch/tasks/:taskId/assignments` |
| `GET` | `/org/dispatch/jobs/:jobId/logged-hours` |
| `GET` | `/org/dispatch/tasks/:taskId/logged-hours` |
| `GET` `POST` | `/org/dispatch/assignments` |
| `GET` `PUT` `DELETE` | `/org/dispatch/assignments/:id` |
| `POST` | `/org/dispatch/assignments/:id/log-hours` |
| `GET` | `/org/dispatch/technicians/:technicianId/assignments` |
| `GET` | `/org/dispatch/available-employees` |
| `GET` | `/org/dispatch/employees-with-tasks` |
| `POST` | `/org/dispatch/dispatch/bulk-delete` |

### 3.17 `/api/v1/org/fleet` — Fleet

Prefix **`/org/fleet`** (vehicles, nested resources, bulk delete).

| Methods | Path |
|---------|------|
| `GET` | `/org/fleet/dashboard` |
| `GET` `POST` | `/org/fleet/vehicles` |
| `GET` `PUT` `DELETE` | `/org/fleet/vehicles/:id` |
| `GET` `PUT` | `/org/fleet/vehicles/:id/settings` |
| `GET` `POST` | `/org/fleet/vehicles/:vehicleId/maintenance` |
| `GET` `PUT` `DELETE` | `/org/fleet/vehicles/:vehicleId/maintenance/:id` |
| `GET` `POST` | `/org/fleet/vehicles/:vehicleId/repairs` |
| `GET` `PUT` `DELETE` | `/org/fleet/vehicles/:vehicleId/repairs/:id` |
| `GET` `POST` | `/org/fleet/vehicles/:vehicleId/inspections` |
| `GET` `PUT` `DELETE` | `/org/fleet/vehicles/:vehicleId/inspections/:id` |
| `GET` | `/org/fleet/vehicles/:vehicleId/inspections/:inspectionId/items` |
| `POST` | `/org/fleet/vehicles/:vehicleId/inspections/items` |
| `GET` `POST` | `/org/fleet/vehicles/:vehicleId/fuel` |
| `GET` `PUT` `DELETE` | `/org/fleet/vehicles/:vehicleId/fuel/:id` |
| `GET` `POST` | `/org/fleet/vehicles/:vehicleId/check-in-out` |
| `GET` `PUT` `DELETE` | `/org/fleet/vehicles/:vehicleId/check-in-out/:id` |
| `GET` | `/org/fleet/vehicles/:vehicleId/assignment-history` |
| `GET` | `/org/fleet/vehicles/:vehicleId/metrics` |
| `GET` `POST` | `/org/fleet/vehicles/:vehicleId/media` |
| `GET` `PUT` `DELETE` | `/org/fleet/vehicles/:vehicleId/media/:id` |
| `POST` | `/org/fleet/vehicles/:vehicleId/documents/presigned-url` |
| `GET` `POST` | `/org/fleet/vehicles/:vehicleId/documents` |
| `GET` | `/org/fleet/vehicles/:vehicleId/documents/:id/preview` |
| `GET` `PUT` `DELETE` | `/org/fleet/vehicles/:vehicleId/documents/:id` |
| `POST` | `/org/fleet/vehicles/bulk-delete` |

### 3.18 `/api/v1/org/inventory` — Inventory

Prefix **`/org/inventory`**. Full tree: items, transactions, allocations, purchase orders, suppliers, locations, categories, units, alerts, counts, bulk delete.

> **Note:** bulk delete route is **`POST /org/inventory/inventory/bulk-delete`** (duplicate `inventory` segment).

| Methods | Path |
|---------|------|
| `GET` | `/org/inventory/items` |
| `GET` | `/org/inventory/items/:id` |
| `POST` | `/org/inventory/items` |
| `PUT` `DELETE` | `/org/inventory/items/:id` |
| `GET` | `/org/inventory/items/:id/history` |
| `GET` | `/org/inventory/dashboard` |
| `GET` | `/org/inventory/stats/by-category` |
| `GET` | `/org/inventory/stats/by-location` |
| `GET` | `/org/inventory/stats/by-status` |
| `GET` `POST` | `/org/inventory/transactions` |
| `POST` | `/org/inventory/transactions/receipt` |
| `POST` | `/org/inventory/transactions/issue` |
| `POST` | `/org/inventory/transactions/adjustment` |
| `POST` | `/org/inventory/transactions/transfer` |
| `POST` | `/org/inventory/transactions/return` |
| `POST` | `/org/inventory/transactions/write-off` |
| `GET` `POST` | `/org/inventory/allocations` |
| `GET` `PUT` `DELETE` | `/org/inventory/allocations/:id` |
| `POST` | `/org/inventory/allocations/:id/issue` |
| `POST` | `/org/inventory/allocations/:id/return` |
| `GET` | `/org/inventory/allocations/job/:jobId` |
| `GET` | `/org/inventory/allocations/bid/:bidId` |
| `GET` `POST` | `/org/inventory/purchase-orders` |
| `GET` `PUT` | `/org/inventory/purchase-orders/:id` |
| `PUT` | `/org/inventory/purchase-orders/:id/approve` |
| `PUT` | `/org/inventory/purchase-orders/:id/send` |
| `PUT` | `/org/inventory/purchase-orders/:id/cancel` |
| `PUT` | `/org/inventory/purchase-orders/:id/close` |
| `POST` | `/org/inventory/purchase-orders/:id/receive` |
| `POST` | `/org/inventory/purchase-orders/:id/receive-partial` |
| `POST` | `/org/inventory/purchase-orders/:id/items` |
| `PUT` `DELETE` | `/org/inventory/purchase-order-items/:id` |
| `GET` | `/org/inventory/purchase-orders/:id/items` |
| `GET` `POST` | `/org/inventory/suppliers` |
| `GET` `PUT` `DELETE` | `/org/inventory/suppliers/:id` |
| `GET` `POST` | `/org/inventory/locations` |
| `GET` `PUT` `DELETE` | `/org/inventory/locations/:id` |
| `GET` `POST` | `/org/inventory/categories` |
| `PUT` `DELETE` | `/org/inventory/categories/:id` |
| `GET` `POST` | `/org/inventory/units` |
| `PUT` `DELETE` | `/org/inventory/units/:id` |
| `GET` | `/org/inventory/alerts` |
| `GET` | `/org/inventory/alerts/unresolved` |
| `PUT` | `/org/inventory/alerts/:id/acknowledge` |
| `PUT` | `/org/inventory/alerts/:id/resolve` |
| `POST` | `/org/inventory/alerts/trigger-check` |
| `GET` `POST` | `/org/inventory/counts` |
| `GET` `PUT` | `/org/inventory/counts/:id` |
| `POST` | `/org/inventory/counts/:id/start` |
| `POST` | `/org/inventory/counts/:id/complete` |
| `GET` | `/org/inventory/counts/:id/items` |
| `PUT` | `/org/inventory/counts/:countId/items/:itemId` |
| `POST` | `/org/inventory/inventory/bulk-delete` |

### 3.19 `/api/v1/org/compliance` — Compliance

> **Note:** bulk delete is **`POST /org/compliance/compliance/bulk-delete`**.

| Methods | Path |
|---------|------|
| `GET` | `/org/compliance/kpis` |
| `GET` `POST` | `/org/compliance/cases` |
| `GET` `PUT` `DELETE` | `/org/compliance/cases/:id` |
| `PATCH` | `/org/compliance/cases/:id/status` |
| `GET` | `/org/compliance/watchlist` |
| `POST` | `/org/compliance/violations` |
| `GET` | `/org/compliance/violations/counts` |
| `POST` | `/org/compliance/compliance/bulk-delete` |

### 3.20 `/api/v1/org/capacity` — Capacity planning

| Method | Path |
|--------|------|
| `GET` | `/org/capacity/dashboard/kpis` |
| `GET` | `/org/capacity/utilization/metrics` |
| `GET` | `/org/capacity/utilization/chart-data` |
| `GET` | `/org/capacity/coverage/team` |
| `GET` | `/org/capacity/availability` |
| `PUT` | `/org/capacity/availability/:employeeId` |
| `GET` `POST` | `/org/capacity/allocations` |
| `PUT` | `/org/capacity/allocations/:allocationId` |
| `GET` `POST` | `/org/capacity/shifts` |
| `PUT` `DELETE` | `/org/capacity/shifts/:shiftId` |
| `GET` | `/org/capacity/capacity/overview` |
| `POST` | `/org/capacity/capacity/metrics` |
| `GET` `POST` | `/org/capacity/templates` |
| `GET` | `/org/capacity/assignments/teams` |

### 3.21 `/api/v1/org/compensation` — Compensation (Manager+)

| Methods | Path |
|---------|------|
| `GET` `POST` | `/org/compensation/compensations` |
| `GET` `PUT` `DELETE` | `/org/compensation/compensations/:id` |
| `GET` | `/org/compensation/compensations/history/:employeeId` |
| `GET` `POST` | `/org/compensation/pay-periods` |
| `GET` `PUT` `DELETE` | `/org/compensation/pay-periods/:id` |
| `GET` | `/org/compensation/leave-balances/:employeeId` |
| `PUT` | `/org/compensation/leave-balances/:id` |
| `GET` `POST` | `/org/compensation/benefits` |
| `PUT` `DELETE` | `/org/compensation/benefits/:id` |

### 3.22 `/api/v1/org/payroll` — Payroll (Manager+)

> **Note:** bulk delete runs are **`POST /org/payroll/payroll/runs/bulk-delete`**.

| Methods | Path |
|---------|------|
| `GET` | `/org/payroll/kpis` |
| `GET` `POST` | `/org/payroll/entries` |
| `GET` `PUT` `DELETE` | `/org/payroll/entries/:id` |
| `POST` | `/org/payroll/entries/:id/approve` |
| `POST` | `/org/payroll/entries/:id/reject` |
| `GET` `POST` | `/org/payroll/runs` |
| `GET` | `/org/payroll/runs/:id` |
| `POST` | `/org/payroll/runs/:id/process` |
| `POST` | `/org/payroll/payroll/runs/bulk-delete` |

### 3.23 `/api/v1/org` — Invoicing

Router applies **Bearer** + invoicing feature matrix (`invoiceRoutes.ts`).

| Methods | Path |
|---------|------|
| `GET` `POST` | `/org/invoices` |
| `GET` | `/org/invoices/kpis` |
| `GET` `PUT` `DELETE` | `/org/invoices/:id` |
| `POST` | `/org/invoices/:id/send` |
| `POST` | `/org/invoices/:id/send-test` |
| `POST` | `/org/invoices/:id/remind` |
| `POST` | `/org/invoices/:id/mark-paid` |
| `POST` | `/org/invoices/:id/void` |
| `GET` `POST` | `/org/invoices/:invoiceId/line-items` |
| `GET` `PUT` `DELETE` | `/org/invoices/:invoiceId/line-items/:lineItemId` |
| `GET` | `/org/invoices/:id/pdf` |
| `GET` | `/org/invoices/:id/pdf/preview` |
| `GET` `POST` | `/org/invoices/:invoiceId/payments` |
| `GET` `PUT` `DELETE` | `/org/invoices/:invoiceId/payments/:paymentId` |
| `POST` | `/org/invoices/bulk-delete` |

### 3.24 `/api/v1/org` — Notifications

| Method | Path | Notes |
|--------|------|------|
| `GET` | `/org/notifications` | |
| `GET` | `/org/notifications/unread-count` | |
| `GET` | `/org/notifications/stats` | |
| `GET` / `PUT` | `/org/notifications/preferences` | |
| `GET` | `/org/notifications/:id` | |
| `PATCH` | `/org/notifications/:id/read` | |
| `PATCH` | `/org/notifications/mark-all-read` | |
| `DELETE` | `/org/notifications/:id` | |
| `GET` `POST` | `/org/notifications-admin/rules` | Executive |
| `PATCH` | `/org/notifications-admin/rules/:id` | Executive |
| `GET` | `/org/notifications-admin/:id/delivery-logs` | Executive |
| `POST` | `/org/notifications/trigger` | Executive |

### 3.25 `/api/v1/org/dashboard` — Dashboard widgets & goals

| Method | Path |
|--------|------|
| `GET` | `/org/dashboard/overview` |
| `GET` | `/org/dashboard/revenue` |
| `GET` | `/org/dashboard/active-jobs` |
| `GET` | `/org/dashboard/team-utilization` |
| `GET` | `/org/dashboard/todays-dispatch` |
| `GET` | `/org/dashboard/active-bids` |
| `GET` | `/org/dashboard/performance` |
| `GET` | `/org/dashboard/priority-jobs` |
| `GET` | `/org/dashboard/my-schedule` |
| `GET` | `/org/dashboard/my-active-jobs` |
| `GET` `POST` | `/org/dashboard/goals` |
| `GET` `PUT` `DELETE` | `/org/dashboard/goals/:id` |

Query: most `GET`s accept optional `startDate` / `endDate` (`YYYY-MM-DD`) per `dashboardRoutes.ts`.

### 3.26 `/api/v1/org` — Reports (`reportRoutes.ts`)

All **Bearer**; most report endpoints require **Manager or Executive** (`managerOrAbove`). Technician-scoped endpoints validate in controller.

| Method | Path |
|--------|------|
| `GET` | `/org/reports/company-summary/kpis` |
| `GET` | `/org/reports/company-summary/revenue-trend` |
| `GET` | `/org/reports/company-summary/job-performance` |
| `GET` | `/org/reports/company-summary/client-revenue` |
| `GET` | `/org/reports/financial/kpis` |
| `GET` | `/org/reports/financial/profit-loss` |
| `GET` | `/org/reports/financial/cash-flow` |
| `GET` | `/org/reports/financial/revenue-by-client` |
| `GET` | `/org/reports/expenses/by-category` |
| `GET` | `/org/reports/expenses/monthly-trend` |
| `GET` | `/org/reports/expenses/vendor-spend` |
| `GET` | `/org/reports/timesheet-labor/hours` |
| `GET` | `/org/reports/timesheet-labor/labor-cost` |
| `GET` | `/org/reports/timesheet-labor/attendance` |
| `GET` | `/org/reports/fleet/usage` |
| `GET` | `/org/reports/fleet/maintenance` |
| `GET` | `/org/reports/fleet/fuel` |
| `GET` | `/org/reports/inventory/valuation` |
| `GET` | `/org/reports/inventory/stock-movement` |
| `GET` | `/org/reports/inventory/low-stock` |
| `GET` | `/org/reports/clients/spend` |
| `GET` | `/org/reports/clients/outstanding` |
| `GET` | `/org/reports/technician-performance/productivity` |
| `GET` | `/org/reports/technician-performance/quality` |
| `GET` | `/org/reports/technician-performance/profit` |
| `GET` | `/org/reports/jobs/status-summary` |
| `GET` | `/org/reports/jobs/profitability` |
| `GET` | `/org/reports/jobs/cost-breakdown` |
| `GET` | `/org/reports/jobs/timeline` |
| `GET` | `/org/reports/invoicing/summary` |
| `GET` | `/org/reports/invoicing/aging` |
| `GET` | `/org/reports/invoicing/collection` |
| `GET` | `/org/reports/financial/:reportType/export` | `format=pdf|csv` query |

### 3.27 `/api/v1/org/files` — Files v2 (Executive “files” feature)

| Method | Path |
|--------|------|
| `GET` | `/org/files/quick-access/recent` |
| `GET` | `/org/files/quick-access/starred` |
| `PUT` | `/org/files/star` |
| `POST` | `/org/files/bulk-delete` |
| `GET` | `/org/files/bids/active` |
| `GET` | `/org/files/bids/won` |
| `GET` | `/org/files/jobs/active` |
| `GET` | `/org/files/jobs/completed` |
| `GET` | `/org/files/clients/invoices` |
| `GET` | `/org/files/clients/documents` |
| `GET` | `/org/files/clients/invoices/grouped` |
| `GET` | `/org/files/clients/documents/grouped` |
| `GET` | `/org/files/employees/documents` |
| `GET` | `/org/files/fleet/documents` |
| `GET` | `/org/files/fleet/media` |

### 3.28 `/api/v1/org` — Global search

| Method | Path |
|--------|------|
| `GET` | `/org/search` | Query params per `globalSearchHandler` |

---

## 4. Source of truth

If this document and the code disagree, **`src/routes/**/*.ts`** wins. Validation schemas for bodies and query strings live in **`src/validations/*.ts`**.

---

## 5. Related documents

- `database-schema-and-erd.md` — table / schema reference  
- `environment-variables.md` — configuration  
- Frontend repo: `docs/technical/system-architecture-overview.md` — how the UI calls these routes  
