# Admin Panel Design

> **For agentic workers:** Use superpowers:writing-plans to create the implementation plan from this spec.

**Goal:** Build an admin-only `/admin` panel with four sections: user management, audit log/activity, data operations, and app settings.

**Architecture:** Dedicated `/admin` route with a `RequireAdmin` guard. User management operations (list, invite, role changes, delete) go through Vercel serverless functions at `/api/admin/users.js` and `/api/admin/users/[id].js` that hold the Supabase service role key server-side. All other sections (audit log, data ops, settings) use the existing Supabase anon client.

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

`useAuth` exposes `isAdmin` alongside existing `isSuperuser`:
```js
const isAdmin = session?.user?.user_metadata?.role === "admin";
```

`RequireAdmin` component in `router.jsx` — redirects non-admin users to `/` instead of showing the panel.

Admin link appears in the main Dashboard nav only when `isAdmin === true`. Since there is no shared layout wrapper, the link is added to `Dashboard.jsx`'s nav only (admins access the panel directly via `/admin`; a visible link in the dashboard nav is sufficient).

---

## Section 1: User Management

Three sub-tabs within the Users section.

### Active Users
Table of all confirmed users (`email_confirmed_at` is not null):
- Columns: email, role, last sign-in, joined date
- Per-row actions: role dropdown (user / superuser / admin), delete button with confirmation
- Deleting the last admin is blocked: the DELETE endpoint checks the count of admin-role users first and returns 409 if it would leave zero admins. The UI surfaces this as an error toast.

### Pending
Users who self-registered but have not yet been confirmed (`email_confirmed_at` is null). Columns: email, registered date. Actions:
- **Approve**: calls `supabase.auth.admin.updateUser(id, { email_confirm: true })` — confirms the user's email
- **Reject**: calls `supabase.auth.admin.deleteUser(id)`

### Invite
Form: email input + role selector (user / superuser / admin). On submit:
```js
supabase.auth.admin.inviteUserByEmail(email, { data: { role } })
```
The `role` value from the form is passed in `data` so the invited user receives the correct role in their `user_metadata` from first login. Supabase sends a magic invite link; user clicks it, sets password, lands on dashboard.

When `allowed_domains` is non-empty, the invite endpoint also validates the email domain before calling Supabase and returns 400 if the domain is not in the allowlist.

---

## Section 2: Vercel Serverless Functions

### JWT Verification Pattern (used in all functions)
```js
const token = req.headers.authorization?.replace("Bearer ", "");
const { data: { user }, error } = await supabaseServiceClient.auth.getUser(token);
if (error || user?.user_metadata?.role !== "admin") {
  return res.status(403).json({ error: "Forbidden" });
}
```
`supabaseServiceClient` is created with `SUPABASE_SERVICE_ROLE_KEY`. The JWT is validated server-side via `auth.getUser()` — never decoded client-side.

### `api/admin/users.js`
Handles two methods via `req.method` branching:
- **GET** — calls `supabase.auth.admin.listUsers()`, returns all users
- **POST** — reads `{ email, role }` from body, validates domain allowlist, calls `supabase.auth.admin.inviteUserByEmail(email, { data: { role } })`

### `api/admin/users/[id].js`
Handles two methods via `req.method` branching:
- **PATCH** — reads `{ role }` from body, calls `supabase.auth.admin.updateUserById(id, { user_metadata: { role } })`
- **DELETE** — checks count of users with `role === 'admin'` via `listUsers()`; if count ≤ 1 and target is admin, returns 409. Otherwise calls `supabase.auth.admin.deleteUser(id)`

Environment variables required in Vercel: `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

---

## Section 3: Activity / Audit Log

### `audit_log` table
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

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_audit_log"
  ON audit_log FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
```

No write policy — inserts come from the anon client via `logAudit()` which uses the existing anon key. Add a permissive insert policy for authenticated users:
```sql
CREATE POLICY "authenticated_insert_audit_log"
  ON audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);
```

### `logAudit()` helper in `db.js`
```js
async function logAudit(action, tableName, recordId, changes) {
  if (!supabase) return;
  const user = (await supabase.auth.getUser()).data?.user;
  try {
    await supabase.from("audit_log").insert({
      user_id: user?.id,
      user_email: user?.email,
      action,
      table_name: tableName,
      record_id: String(recordId),
      changes,
    });
  } catch (e) {
    console.error("logAudit failed:", e);
    // Never blocks the data mutation — fire-and-forget
  }
}
```

Called after every successful mutation in `db.js`: `upsertFundMeta`, `upsertCompany`, `upsertSearcher`, `upsertPipelineDeal`, `deleteCompany`, `deleteSearcher`, `deletePipelineDeal`, `insertFund`, `deleteFund`. If `logAudit` fails it logs to console but never throws — the data mutation is never rolled back or blocked.

### Admin Panel UI
- **Summary cards:** mutations today, most active user, most modified table
- **Log table:** columns: timestamp, user, action, table, record. Filterable by user, table, action, date range. Each row expandable to show the `changes` JSON.

---

## Section 4: Data Operations

Three operations:

**Bulk Import** — CSV/XLSX upload (reuses existing DataLoader logic from Dashboard).

**Table Reset** — per-table "Clear all" buttons for: `capital_calls`, `portfolio_companies`, `searchers`, `pipeline`. Each requires a confirmation dialog. New `db.js` functions needed (currently only per-record deletes exist):
```js
const CLEARABLE_TABLES = ["capital_calls", "portfolio_companies", "searchers", "pipeline"];

export async function clearTable(tableName) {
  if (!supabase) return { error: null };
  if (!CLEARABLE_TABLES.includes(tableName)) {
    return { error: new Error(`Table "${tableName}" is not clearable`) };
  }
  const { error } = await supabase.from(tableName).delete().neq("id", -1);
  return { error };
}
```
`tableName` is validated against the hardcoded allowlist before use — never passed raw from user input.

**Export Snapshot** — one-click XLSX download reusing the existing `exportAll` function from Dashboard.

---

## Section 5: App Settings

### `app_settings` table
```sql
CREATE TABLE app_settings (
  key    text PRIMARY KEY,
  value  jsonb
);

INSERT INTO app_settings VALUES ('allowed_domains', '[]'::jsonb);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_settings"
  ON app_settings FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_write_settings"
  ON app_settings FOR ALL
  TO authenticated
  USING     ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
```

### Allowed Domains UI
Tag-input — type a domain, press Enter to add, click × to remove. Save writes:
```js
supabase.from("app_settings").upsert({ key: "allowed_domains", value: domains })
```

### Domain Enforcement — Auth Hook
Supabase supports a **custom signup hook** via a PostgreSQL function registered in the Supabase Dashboard under Authentication → Hooks → "Custom Access Token Hook" / "Send Email Hook". For domain enforcement on self-registration, use a **Database Webhook** or a **Postgres function** triggered via the `auth.users` `BEFORE INSERT` trigger approach.

Concretely, register a `before_user_creation` hook in Supabase Dashboard (Authentication → Hooks → "Before User Created"). The hook is a Postgres function with this signature:

```sql
CREATE OR REPLACE FUNCTION public.enforce_domain_allowlist(event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  email text;
  domain text;
  allowed_domains jsonb;
BEGIN
  email := event->>'email';
  domain := split_part(email, '@', 2);

  SELECT value INTO allowed_domains
  FROM app_settings
  WHERE key = 'allowed_domains';

  -- If list is empty, allow all
  IF allowed_domains IS NULL OR jsonb_array_length(allowed_domains) = 0 THEN
    RETURN event;
  END IF;

  -- Check domain against allowlist
  IF NOT (allowed_domains @> jsonb_build_array(domain)) THEN
    RAISE EXCEPTION 'Email domain not allowed';
  END IF;

  RETURN event;
END;
$$;
```

Register this function in Supabase Dashboard → Authentication → Hooks → "Before user is created". If the function raises an exception, Supabase rejects the signup.

---

## File Structure

### New files
- `src/components/AdminPanel.jsx` — shell with sidebar nav (Users, Activity, Data, Settings) and content area
- `src/components/admin/AdminUsers.jsx` — user management (active, pending, invite sub-tabs)
- `src/components/admin/AdminActivity.jsx` — audit log table + summary cards
- `src/components/admin/AdminData.jsx` — bulk import, table reset, export
- `src/components/admin/AdminSettings.jsx` — allowed domains tag-input
- `api/admin/users.js` — Vercel serverless: GET list + POST invite (method dispatch on `req.method`)
- `api/admin/users/[id].js` — Vercel serverless: PATCH role + DELETE user (method dispatch on `req.method`)

### Modified files
- `src/auth.jsx` — add `isAdmin` to context (`role === 'admin'`)
- `src/router.jsx` — add `/admin` route with `RequireAdmin` guard
- `src/components/Dashboard.jsx` — add Admin link in nav (visible only when `isAdmin`)
- `src/db.js` — add `logAudit()` helper, wire into all mutating functions, add `clearTable()` function

### New Supabase objects (run in SQL Editor)
- `audit_log` table + RLS policies
- `app_settings` table + RLS policies + seed row
- Auth Hook: `enforce_domain_allowlist` function, registered in Supabase Dashboard

---

## Out of Scope
- Admin notifications / alerts
- Per-user data access restrictions
- Session invalidation / force logout
- Feature flags (can be added later as a new `app_settings` key)
- Multi-admin invite (admin inviting another admin who then loses access if the first is deleted — accepted edge case, mitigated by the last-admin deletion guard)
