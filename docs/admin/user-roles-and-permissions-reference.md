# User roles and permissions — reference sheet

This document describes **how RBAC works** in T3 Mechanical and how to interpret permissions. The **authoritative matrix** is seeded from code: `src/drizzle/seed/featurePermissions.seed.ts` (based on the internal RBAC CSV). After any seed change, verify rows in PostgreSQL.

---

## 1. Roles (application personas)

Built-in roles are referenced by **numeric ID** in the seed file (must match `auth.roles` in your database):

| Role name (UI) | Typical `auth.roles.id` | Summary |
|----------------|-------------------------|---------|
| **Executive** | `1` | Full administrative access to modules, **Settings**, **Files**, **bulk delete**, sensitive financial/payroll operations. |
| **Manager** | `2` | Broad operational access (team, dispatch, bids, jobs, clients, inventory, timesheet approval, etc.). **No** Settings / Files modules as seeded; **no** bulk-delete features; some financial edges are Executive-only in route comments. |
| **Technician** | `3` | **Own / assigned** scope: own timesheets, assigned dispatch, assigned jobs/clients/properties, limited dashboard widgets, fleet actions on assigned vehicles, create expenses, etc. |

> **Important:** If you changed role IDs or names in the database, treat the table above as **documentation only** — run the SQL in §7 against your environment.

Users receive exactly **one application role** via `auth.user_roles` (see `auth.schema.ts`). Feature checks use that role’s rows in `auth.role_features`.

---

## 2. Permission model (database)

| Table | Purpose |
|-------|---------|
| `auth.features` | Catalog of features: `(module, feature_code)` + display name + description. Unique per pair. |
| `auth.role_features` | Maps `role_id` + `feature_id` to an **`access_level`** and optional JSON **`conditions`**. |
| `auth.ui_elements` | Registered UI pieces (buttons, tabs, columns, …) optionally tied to a feature. |
| `auth.role_ui_elements` | Per-role visibility / enabled state for UI elements. |
| `auth.data_filters` | Row-level rules (e.g. assigned-only) per role/module. |
| `auth.field_permissions` | Field-level `hidden` / `readonly` / `editable` rules. |

**Enforcement:**

- **API:** `authenticate` + `authorizeFeature` / `authorizeModule` / `requireRole` in `src/middleware/featureAuthorize.ts` (and route-specific middleware).
- **UI:** Next.js app loads permissions via **`GET /api/v1/auth/user/...`** (see `uiPermissionsRoutes.ts`); `RouteGuard` and hooks hide or redirect unauthorized areas.

---

## 3. Modules (`permission_module_enum`)

Modules are PostgreSQL enum values used on `auth.features.module` and related tables:

`dashboard`, `bids`, `jobs`, `clients`, `properties`, `fleet`, `team`, `financial`, `settings`, `reports`, `inventory`, `compliance`, `dispatch`, `payroll`, `expenses`, `invoicing`, `timesheet`, `mileage`, `capacity`, `compensation`, `performance`, `maintenance`, `survey`, `tasks`, `documents`, `files`

Defined in: `src/drizzle/enums/auth.enums.ts`.

---

## 4. Access levels (`access_level_enum`)

Each **role–feature** row assigns one access level. Common values:

| Level | Meaning (typical use) |
|-------|------------------------|
| `none` | Feature not granted. |
| `view` | Read-only, org-wide or context as interpreted by services. |
| `view_own` | Only the current user’s records. |
| `view_assigned` | Records linked to the user (e.g. jobs/dispatch assigned to them). |
| `view_team` | Team / department scoped (implementation in services/controllers). |
| `create` | May create new records. |
| `edit_own` | Edit own records only. |
| `edit_assigned` | Edit records assigned to the user. |
| `edit_team` | Edit within team scope. |
| `edit_all` | Edit across the org (subject to other checks). |
| `delete_own` / `delete_all` | Delete scopes. |
| `approve` | Approval workflows (timesheets, expenses, etc.). |
| `admin` | Full access to that feature for **Executive** rows in the seed. |

Defined in: `src/drizzle/enums/auth.enums.ts`.

---

## 5. Feature codes (how to read the matrix)

A feature is addressed as:

```text
<module>.<feature_code>
```

Examples aligned with routes and seed data:

| Example | Meaning |
|---------|---------|
| `dashboard.view` | Access dashboard shell. |
| `dashboard.view_revenue_chart` | Revenue chart widget (Executive/Manager; Technician typically `none`). |
| `clients.view_clients` | Client list/detail visibility. |
| `clients.view_financial_info` | Client KPIs / billing-style data (Manager/Executive; not Technician in seed). |
| `timesheet.approve_timesheets` | Manager/Executive approval paths. |
| `timesheet.view_own_timesheets` | Technician daily / weekly views. |
| `dispatch.create_dispatch` | Create tasks/assignments (planner capability). |
| `bids.bulk_delete` | **Executive-only** bulk soft-delete (see seed `bulk_delete` features). |

**Duplicate naming note:** The seed file contains both **legacy granular** feature codes (e.g. `view_clients`) and a **newer simplified** set (e.g. module `clients` + `view`) in the same file for migration work. **What matters at runtime** is what was inserted into `auth.features` and `auth.role_features` last time you ran seeds. Use §7 to list effective permissions.

---

## 6. Executive-only capabilities (typical)

From seed comments and route guards:

- **`settings`** module — company templates, labor rates, travel defaults, invoice settings (`/api/v1/auth/settings/*`, `authorizeModule("settings")`).
- **`files`** module — executive file library (`/api/v1/org/files/*`).
- **`bulk_delete`** feature codes on bids, jobs, dispatch, timesheets, expenses, invoicing, clients, team, payroll, compliance, fleet, inventory.
- **Payroll / compensation** routes are restricted to **Manager+** at the router level; sensitive compensation is Manager/Executive in seed.
- **Notification admin** rules — executive-only routes under `/org/notifications-admin/*`.

Always confirm with `featureAuthorize` on the specific route you care about.

---

## 7. Queries for administrators (read-only)

**List all features:**

```sql
SELECT id, module, feature_code, feature_name, is_active
FROM auth.features
WHERE is_active = true
ORDER BY module, feature_code;
```

**Export matrix for a role (by name):**

```sql
SELECT r.name AS role_name,
       f.module,
       f.feature_code,
       rf.access_level,
       rf.is_active
FROM auth.role_features rf
JOIN auth.roles r ON r.id = rf.role_id
JOIN auth.features f ON f.id = rf.feature_id
WHERE r.name = 'Executive'  -- or Manager / Technician
  AND rf.is_active = true
ORDER BY f.module, f.feature_code;
```

**UI elements visible to a role:**

```sql
SELECT r.name, e.module, e.element_code, rue.is_visible, rue.is_enabled
FROM auth.role_ui_elements rue
JOIN auth.roles r ON r.id = rue.role_id
JOIN auth.ui_elements e ON e.id = rue.ui_element_id
WHERE r.name = 'Technician'
ORDER BY e.module, e.element_code;
```

---

## 8. Changing permissions safely

1. Prefer updating **`featurePermissions.seed.ts`** (or a dedicated migration that adjusts `auth.role_features`) so environments stay reproducible.  
2. Re-run the appropriate seed command — typically **`npm run seed:features`** from the `t3-server` root to re-apply `featurePermissions.seed.ts` — **only** on environments where you intend to reset that data.  
3. Clear or wait out **auth / permission caches** if users do not see updates immediately (`AUTH_CACHE_*`, `UI_PERMISSIONS_CACHE_TTL_MS`, etc. — see `docs/technical/environment-variables.md`).  
4. Smoke-test **API** (403 vs 200) and **UI** (sidebar + `RouteGuard`) for each role.

---

## 9. Related documents

- [System administrator guide](./system-administrator-guide.md) — operations and onboarding users  
- [API reference](../technical/api-reference.md) — which routes use which guards  
- [Environment variables](../technical/environment-variables.md) — cache and auth tuning  
