# Google Calendar integration (T3 Server)

This document describes **end-to-end** how Google Calendar sync is set up and how it behaves in this codebase. It targets **Google Workspace** with a **service account** and **domain-wide delegation** (JWT), not per-user OAuth.

---

## 1. What the integration does

| Trigger | Behavior |
|--------|----------|
| **Dispatch** — technician assigned to a task | Creates or updates a **timed** event on that technician’s **primary** Google Calendar. Description includes job link (`CLIENT_URL` + `/dashboard/jobs/{jobId}`). |
| **Dispatch** — task updated (times, title, etc.) | Re-syncs **all** active assignments on that task (patch existing events). |
| **Dispatch** — technician replaced or assignment removed / task deleted | Deletes the old Google event where possible, then soft-deletes rows as before. |
| **Bid** — `endDate` set or changed | Creates or updates an **all-day** “Bid due” style event on **`assignedTo`**’s calendar, or **`createdBy`** if `assignedTo` is null. Link: `/dashboard/bids/{bidId}`. |
| **Bid** — `endDate` cleared or bid deleted | Removes the Google event and clears stored ids. |
| **Bid / dispatch — event missing in Google** | If the DB still has a `google_calendar_*_event_id` but Google returns **404** (user deleted the event in Calendar), the id is cleared and a **new** event is **inserted** on the next sync (contract D1: “event not there → create”). |

Implementation lives mainly in:

- `src/services/google-calendar.service.ts` — credentials, Calendar API calls, sync helpers  
- `src/services/dispatch.service.ts` — hooks after create/update/delete assignment & task  
- `src/services/bid.service.ts` — hooks after create/update/delete bid  
- `src/drizzle/schema/dispatch.schema.ts` — `google_calendar_event_id` on `org.dispatch_assignments`  
- `src/drizzle/schema/bids.schema.ts` — `google_calendar_end_date_event_id`, `google_calendar_end_date_owner_user_id` on `org.bids`  
- `src/drizzle/migrations/0138_google_calendar_sync.sql` — database columns  

Dependency: **`googleapis`** (see `package.json`).

---

## 2. Google Cloud Console

1. Select or create a **GCP project** (e.g. the same project you use for other APIs).
2. **APIs & Services → Library** → enable **Google Calendar API** (not CalDAV).
3. **IAM & Admin → Service accounts → Create service account**  
   - Name it something clear (e.g. `calendar-sync`).  
   - **Permissions (optional)** can be left empty for Calendar-only delegation.
4. Open the service account → **Keys → Add key → JSON** → download the file once.  
   - **Never commit** this file. The **Key ID** shown in the console table is *not* the credential; only the downloaded JSON (or base64 of it) is.
5. **Details** (or Advanced settings) → **Domain-wide delegation** → enable it → copy the **numeric Client ID** (used in Admin Console, not the same as the JSON `private_key_id`).

---

## 3. Google Workspace Admin

1. Sign in as a **super admin** (or role that can edit **API controls**).
2. **Security → Access and data control → API controls → Domain-wide delegation → Manage Domain Wide Delegation → Add new**.
3. Paste the **Client ID** from the service account delegation screen.
4. **OAuth scopes** (comma-separated), for example:

   ```text
   https://www.googleapis.com/auth/calendar.events
   ```

5. Save / authorize.

Until this step succeeds, API calls will fail with access errors even if the JSON key is correct.

---

## 4. Environment variables (runtime)

The server resolves credentials in this order:

1. **`GOOGLE_SERVICE_ACCOUNT_JSON`** — either:
   - the **full JSON** string (starts with `{`), or  
   - **base64** encoding of that JSON (recommended for panels like Easy Panel that prefer one line).
2. Else **`GOOGLE_SERVICE_ACCOUNT_KEY_PATH`** or **`GOOGLE_APPLICATION_CREDENTIALS`** — absolute path inside the container/host to the `.json` file.

Optional:

| Variable | Purpose |
|----------|---------|
| `GOOGLE_WORKSPACE_DOMAIN` | If set (e.g. `company.com`), calendar sync only runs for user emails in that domain (`@company.com`). |
| `CLIENT_URL` | Base URL for deep links inside calendar descriptions (same pattern as notifications). |
| `NAIVE_APP_TIMEZONE` | Optional **IANA** id. Dispatch naive times are sent as `dateTime` (no `Z`) + this `timeZone`, so **what you enter is what Google shows in that zone** (e.g. 2 → 2pm). **Default: `America/Los_Angeles` (California Pacific).** Set only if you need a different region. |

If credentials are missing or invalid, sync is **skipped**; the rest of the API still works.

---

## 5. Local development

1. Copy the downloaded JSON somewhere **outside git** (or keep filename covered by `.gitignore`; `t3-server/.gitignore` includes `t3mechanical-*.json` and `.google_sa_b64.txt` as examples).
2. Either:
   - set `GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\key.json`, or  
   - base64 the file and set `GOOGLE_SERVICE_ACCOUNT_JSON` to that single line.
3. Run DB migrations so **0138** is applied (`npm run db:migrate` or your project’s migrate command).
4. Ensure the **technician** employee record links to a **user** whose **email** exists in Workspace and matches delegation rules.

---

## 6. Production (e.g. Easy Panel + Nixpacks)

1. **Do not** bake secrets into the image or repo.
2. In the panel **Secrets / Environment**, set `GOOGLE_SERVICE_ACCOUNT_JSON` to the **base64** line (Option A).
3. Set `CLIENT_URL` (and optionally `GOOGLE_WORKSPACE_DOMAIN`) for production.
4. Redeploy so the process picks up new env vars.

---

## 7. Database migration

Apply:

- `src/drizzle/migrations/0138_google_calendar_sync.sql`

This adds:

- `org.dispatch_assignments.google_calendar_event_id`
- `org.bids.google_calendar_end_date_event_id`
- `org.bids.google_calendar_end_date_owner_user_id` (+ FK to `auth.users`)

Journal entry: `src/drizzle/migrations/meta/_journal.json` (`0138_google_calendar_sync`).

---

## 8. How authentication works in code

1. Load service account JSON (inline, base64, or file path).  
2. Build `google.auth.JWT` with:
   - `email` = service account `client_email`
   - `key` = `private_key`
   - `scopes` = `https://www.googleapis.com/auth/calendar.events`
   - **`subject`** = the **Workspace user email** to impersonate (technician or bid owner).  
3. Call Calendar API v3: `events.insert`, `events.patch`, or `events.delete` on calendar id **`primary`** for that user.

Credentials are memoized once per process after first successful parse.

---

## 9. Dispatch flow (code hooks)

- **`createDispatchAssignment`** — after insert, `syncDispatchAssignmentGoogleCalendar(assignmentId)` (fire-and-forget).  
- **`updateDispatchAssignment`** — if technician changes, delete old event from the **previous** tech’s calendar when an event id exists; after update, sync again.  
- **`updateDispatchTask`** — before replacing all technicians, `removeGoogleCalendarEventsForDispatchTask(taskId)`; after update, `syncAllDispatchAssignmentsForTaskGoogleCalendar(taskId)`.  
- **`deleteDispatchTask`** / **`deleteDispatchAssignment`** — remove Google events first, then soft-delete.  
- **`deleteBid`** (when jobs/dispatch exist) — remove events per dispatch task, then existing bid/dispatch cleanup.

---

## 10. Bid flow (code hooks)

- **`createBid`** / **`updateBid`** — `syncBidEndDateGoogleCalendar(bidId)` after success.  
- **`deleteBid`** — `removeBidEndDateGoogleCalendar(bidId)` early; also removes dispatch-related calendar events before soft-deleting assignments.

---

## 11. Verification

1. Migration **0138** applied.  
2. Env vars set; server restarted.  
3. Workspace user email = technician portal user email.  
4. Create a dispatch with start/end and assign that user → check **Google Calendar** for that mailbox.  
5. Watch logs for `[google-calendar]` if nothing appears (mis-scoped delegation, wrong domain filter, missing `userId` on employee, etc.).

---

## 12. Security reminders

- Rotate keys in GCP if exposed; update env in all environments.  
- Restrict delegation scopes to `calendar.events` unless you need more.  
- Treat base64 JSON like the raw JSON: **secret**, not safe in client-side or public repos.

---

## 13. Out of scope / future options

- **Personal Gmail** without Workspace admin delegation — would need **OAuth per user**, not this JWT path.  
- **Shared “resource” calendar** — would need different calendar IDs and product rules.  
- **Push sync from Google → T3** — not implemented; this is **T3 → Google** event push only.

For questions or changes, edit `google-calendar.service.ts` and the dispatch/bid services above.
