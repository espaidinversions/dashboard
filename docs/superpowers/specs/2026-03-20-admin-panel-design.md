# Admin Panel Design

> **For agentic workers:** Use superpowers:writing-plans to create the implementation plan from this spec.

**Goal:** Build a superuser-only `/admin` panel with four sections: user management, audit log/activity, data operations, and app settings.

**Architecture:** Dedicated `/admin` route with a `RequireAdmin` guard. User management operations (list, invite, role changes, delete) go through Vercel serverless functions at `/api/admin/users` that hold the Supabase service role key server-side. All other sections (audit log, data ops, settings) use the existing Supabase anon client.

**Tech Stack:** React, React Router, Supabase (anon + service role via Vercel functions), Vercel serverless functions, existing theme/auth patterns.

---

## Role System

Three tiers:
- **user** — read-only dashboard access
- **superuser** — can edit data in the dashboard (existing)
- **admin** — full admin panel access (new)

Role stored in `user_metadata.role` in Supabase auth. Set via SQL:
```sql
UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'
WHERE email = 'your@email.com';
```

`useAuth` exposes `isAdmin` alongside existing `isSuperuser`. Both derived from `session?.user?.user_metadata?.role`.

`RequireAdmin` component in `router.jsx` — redirects non-admin users to `/` instead of showing the panel.

Admin link appears in the main Dashboard nav only when `isAdmin === true`.

---

## Section 1: User Management

Three sub-tabs within the Users section.

### Active Users
Table of all confirmed users:
- Columns: email, role, last sign-in, joined date
- Per-row actions: role dropdown (user / superuser / admin), delete button with confirmation

### Pending
Users who self-registered but have not yet been confirmed (email confirmation is enabled). Columns: email, registered date. Actions: Approve (confirms + activates) or Reject (deletes user).

### Invite
Form with email input and role selector. Submitting calls Supabase `inviteUserByEmail` — user receives a magic link, sets password, lands on dashboard.

### Backend: Vercel Serverless Functions
All user management operations require the service role key and run server-side:

- `GET /api/admin/users` — list all users
- `POST /api/admin/users/invite` — invite by email + role
- `PATCH /api/admin/users/[id]` — change role
- `DELETE /api/admin/users/[id]` — delete/revoke

Each function:
1. Reads the caller's JWT from the `Authorization` header
2. Verifies `role === 'admin'` in the JWT — rejects with 403 otherwise
3. Executes the operation using `@supabase/supabase-js` with the service role key (`SUPABASE_SERVICE_ROLE_KEY` env var)

Environment variables needed in Vercel: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

---

## Section 2: Activity / Audit Log

### `audit_log` table (new)
```sql
CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  created_at  timestamptz DEFAULT now(),
  user_id     uuid,
  user_email  text,
  action      text,        -- 'insert' | 'update' | 'delete'
  table_name  text,
  record_id   text,
  changes     jsonb
);
```

RLS: admin-read only (no public access).

### `logAudit()` helper in `db.js`
Called after every mutating operation (upsertFundMeta, upsertCompany, upsertSearcher, upsertPipelineDeal, deleteCompany, deleteSearcher, deletePipelineDeal, insertFund, deleteFund). Writes a row to `audit_log` with the current user's id/email, action type, table name, and a summary of changes.

### Admin Panel UI
- **Summary cards:** mutations today, most active user, most modified table
- **Log table:** columns: timestamp, user, action, table, record. Filterable by user, table, action, date range. Each row expandable to show the `changes` JSON.

---

## Section 3: Data Operations

Three operations, all reusing existing `db.js` functions:

**Bulk Import** — CSV/XLSX upload (reuses existing DataLoader logic from Dashboard). Full data refresh without navigating to the main dashboard.

**Table Reset** — per-table "Clear all" buttons for: `capital_calls`, `portfolio_companies`, `searchers`, `pipeline`. Each requires a confirmation dialog ("Type the table name to confirm"). Uses existing delete-all patterns in `db.js`.

**Export Snapshot** — one-click XLSX download reusing the existing `exportAll` function from Dashboard.

No new backend needed — all operations use the existing anon Supabase client through `db.js`.

---

## Section 4: App Settings

### `app_settings` table (new)
```sql
CREATE TABLE app_settings (
  key    text PRIMARY KEY,
  value  jsonb
);

INSERT INTO app_settings VALUES ('allowed_domains', '[]');
```

RLS: admin-read/write only.

### Allowed Domains Setting
Tag-input UI — type a domain, press Enter to add, click × to remove. Save button writes to `app_settings`.

**Enforcement:**
1. Vercel invite function rejects invites to emails not matching any allowed domain (when list is non-empty).
2. A Supabase Auth Hook (Database Function triggered on sign-up) blocks self-registrations from non-allowed domains when the list is non-empty.

If `allowed_domains` is empty, any domain is allowed.

---

## File Structure

### New files
- `src/components/AdminPanel.jsx` — shell with sidebar nav (Users, Activity, Data, Settings) and content area
- `src/components/admin/AdminUsers.jsx` — user management (active, pending, invite sub-tabs)
- `src/components/admin/AdminActivity.jsx` — audit log table + summary cards
- `src/components/admin/AdminData.jsx` — bulk import, table reset, export
- `src/components/admin/AdminSettings.jsx` — allowed domains tag-input
- `api/admin/users.js` — Vercel serverless: GET list + POST invite
- `api/admin/users/[id].js` — Vercel serverless: PATCH role + DELETE user

### Modified files
- `src/auth.jsx` — add `isAdmin` to context (derived from `role === 'admin'`)
- `src/router.jsx` — add `/admin` route with `RequireAdmin` guard
- `src/components/Dashboard.jsx` — add Admin link in nav (visible only to admin)
- `src/db.js` — add `logAudit()` helper + wire into all mutating functions

### New Supabase objects
- `audit_log` table
- `app_settings` table
- Auth Hook function for domain enforcement

---

## Out of Scope
- Admin notifications / alerts
- Per-user data access restrictions
- Session invalidation / force logout
- Feature flags (can be added later as a new `app_settings` key)
