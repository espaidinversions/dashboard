# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin-only `/admin` panel with user management, audit log, data operations, and app settings.

**Architecture:** New `/admin` route guarded by `RequireAdmin`. User operations run through Vercel serverless functions using the Supabase service role key. All audit logging is fire-and-forget from `db.js`. Four sub-components (Users, Activity, Data, Settings) mounted inside an `AdminPanel` shell with a sidebar nav.

**Tech Stack:** React 18, React Router v6, Supabase JS v2, Vercel serverless functions (Node.js), existing `Outfit` font + theme system.

**Spec:** `docs/superpowers/specs/2026-03-20-admin-panel-design.md`

---

## File Map

### New files
| File | Purpose |
|------|---------|
| `src/components/AdminPanel.jsx` | Shell with sidebar nav, renders sub-components |
| `src/components/admin/AdminUsers.jsx` | User list, pending approvals, invite form |
| `src/components/admin/AdminActivity.jsx` | Audit log table + summary cards |
| `src/components/admin/AdminData.jsx` | Bulk import, table reset, export |
| `src/components/admin/AdminSettings.jsx` | Allowed domains tag-input |
| `api/admin/users.js` | Vercel fn: GET list users + POST invite |
| `api/admin/users/[id].js` | Vercel fn: PATCH role + DELETE user |

### Modified files
| File | Change |
|------|--------|
| `src/auth.jsx` | Add `isAdmin` derived from `role === 'admin'` |
| `src/router.jsx` | Add `RequireAdmin` guard + `/admin` route |
| `src/components/Dashboard.jsx` | Add Admin link in header nav |
| `src/db.js` | Add `logAudit()`, `clearTable()`, wire `logAudit` into all mutating functions |

---

## Task 1: Database Setup (SQL in Supabase)

**Files:** No code — SQL to run in Supabase SQL Editor.

- [ ] **Step 1: Create audit_log table**

Run in Supabase SQL Editor:

```sql
CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  created_at  timestamptz DEFAULT now(),
  user_id     uuid,
  user_email  text,
  action      text,
  table_name  text,
  record_id   text,
  changes     jsonb
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_audit_log"
  ON audit_log FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "authenticated_insert_audit_log"
  ON audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);
```

Expected: "Success. No rows returned."

- [ ] **Step 2: Create app_settings table**

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

Expected: "Success. No rows returned."

- [ ] **Step 3: Create domain enforcement auth hook**

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

  IF allowed_domains IS NULL OR jsonb_array_length(allowed_domains) = 0 THEN
    RETURN event;
  END IF;

  IF NOT (allowed_domains @> jsonb_build_array(domain)) THEN
    RAISE EXCEPTION 'Email domain not allowed';
  END IF;

  RETURN event;
END;
$$;
```

Expected: "Success. No rows returned."

- [ ] **Step 4: Register the auth hook**

In Supabase Dashboard → Authentication → Hooks → "Before user is created" → select the `enforce_domain_allowlist` function. Save.

- [ ] **Step 5: Make yourself an admin**

```sql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'
WHERE email = 'YOUR_EMAIL_HERE';
```

Replace `YOUR_EMAIL_HERE` with your actual email. Expected: "1 row affected."

- [ ] **Step 6: Verify**

Log out and log back in (so the JWT refreshes with the new role). Confirm no errors in Supabase dashboard.

---

## Task 2: Auth + Routing

**Files:**
- Modify: `src/auth.jsx`
- Modify: `src/router.jsx`

- [ ] **Step 1: Add `isAdmin` to auth context**

In `src/auth.jsx`, add `isAdmin` derived field and include it in the context value:

```jsx
// After line 27 (isSuperuser):
const isAdmin = session?.user?.user_metadata?.role === "admin";

// In the Provider value (line 30), add isAdmin:
<AuthContext.Provider value={{ session, signIn, signUp, signOut, resendConfirmation, resetPassword, isSuperuser, isAdmin }}>
```

- [ ] **Step 2: Add RequireAdmin and /admin route to router.jsx**

Replace the contents of `src/router.jsx`:

```jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./components/Dashboard.jsx";
import FundsIndex from "./components/FundsIndex.jsx";
import CompaniesIndex from "./components/CompaniesIndex.jsx";
import FundDetail from "./components/FundDetail.jsx";
import CompanyDetail from "./components/CompanyDetail.jsx";
import LoginPage from "./components/LoginPage.jsx";
import AdminPanel from "./components/AdminPanel.jsx";
import { useAuth } from "./auth.jsx";

function RequireAuth({ children }) {
  const { session } = useAuth();
  if (session === undefined) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F0F4F8", fontFamily: "'Outfit',system-ui,sans-serif", color: "#7A8A9A", fontSize: 14 }}>
      Carregant…
    </div>
  );
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const { session, isAdmin } = useAuth();
  if (session === undefined) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F0F4F8", fontFamily: "'Outfit',system-ui,sans-serif", color: "#7A8A9A", fontSize: 14 }}>
      Carregant…
    </div>
  );
  if (!session) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/investments" element={<RequireAuth><Navigate to="/investments/funds" replace /></RequireAuth>} />
      <Route path="/investments/funds" element={<RequireAuth><FundsIndex /></RequireAuth>} />
      <Route path="/investments/companies" element={<RequireAuth><CompaniesIndex /></RequireAuth>} />
      <Route path="/fund/:id" element={<RequireAuth><FundDetail /></RequireAuth>} />
      <Route path="/company/:id" element={<RequireAuth><CompanyDetail /></RequireAuth>} />
      <Route path="/admin" element={<RequireAdmin><AdminPanel /></RequireAdmin>} />
    </Routes>
  );
}
```

- [ ] **Step 3: Add Admin link to Dashboard header**

In `src/components/Dashboard.jsx`, find the header nav (around line 734 — the export button). Add an Admin link just before the export button, visible only when `isAdmin`:

First add `isAdmin` to the `useAuth()` destructure. Find the existing line:
```jsx
const { isSuperuser, signOut } = useAuth();
```
Change to:
```jsx
const { isSuperuser, isAdmin, signOut } = useAuth();
```

Then find the export button block (line ~734):
```jsx
        <button onClick={exportAll} disabled={exporting}
```
Add before it:
```jsx
        {isAdmin && (
          <Link to="/admin"
            style={{ background: "transparent", border: `1.5px solid ${tc.border}`, borderRadius: 7, padding: "7px 12px", cursor: "pointer", fontSize: 12, color: tc.textMid, fontFamily: "inherit", fontWeight: 600, textDecoration: "none" }}>
            Admin
          </Link>
        )}
```

Make sure `Link` is already imported from `react-router-dom` (it is — check line 1 area of Dashboard.jsx).

- [ ] **Step 4: Commit**

```bash
git add src/auth.jsx src/router.jsx src/components/Dashboard.jsx
git commit -m "feat(admin): add isAdmin role, RequireAdmin guard, /admin route, nav link"
```

- [ ] **Step 5: Verify**

Run `npm run dev`. Navigate to `/admin` — should redirect to `/` since AdminPanel doesn't exist yet. The Admin link should appear in the header only when logged in as admin. Check by inspecting the session JWT or looking at localStorage.

---

## Task 3: Vercel Admin API Functions

**Files:**
- Create: `api/admin/users.js`
- Create: `api/admin/users/[id].js`

These functions use the Supabase service role key. The env var `SUPABASE_SERVICE_ROLE_KEY` must be set in Vercel Dashboard → Project Settings → Environment Variables (also add `SUPABASE_URL` if not present — it's the same value as `VITE_SUPABASE_URL`).

- [ ] **Step 1: Create `api/admin/users.js`**

```js
import { createClient } from "@supabase/supabase-js";

function makeServiceClient() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

async function verifyAdmin(req, serviceClient) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await serviceClient.auth.getUser(token);
  if (error || user?.user_metadata?.role !== "admin") return null;
  return user;
}

export default async function handler(req, res) {
  const supabase = makeServiceClient();
  const admin = await verifyAdmin(req, supabase);
  if (!admin) return res.status(403).json({ error: "Forbidden" });

  if (req.method === "GET") {
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ users: data.users });
  }

  if (req.method === "POST") {
    const { email, role } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    // Check domain allowlist
    const { data: setting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "allowed_domains")
      .single();
    const domains = setting?.value ?? [];
    if (domains.length > 0) {
      const domain = email.split("@")[1];
      if (!domains.includes(domain)) {
        return res.status(400).json({ error: `Domain @${domain} not allowed` });
      }
    }

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { role: role || "user" },
    });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ user: data.user });
  }

  res.status(405).json({ error: "Method not allowed" });
}
```

- [ ] **Step 2: Create `api/admin/users/[id].js`**

```js
import { createClient } from "@supabase/supabase-js";

function makeServiceClient() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

async function verifyAdmin(req, serviceClient) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await serviceClient.auth.getUser(token);
  if (error || user?.user_metadata?.role !== "admin") return null;
  return user;
}

export default async function handler(req, res) {
  const supabase = makeServiceClient();
  const admin = await verifyAdmin(req, supabase);
  if (!admin) return res.status(403).json({ error: "Forbidden" });

  const { id } = req.query;

  if (req.method === "PATCH") {
    const { role } = req.body;
    const { data, error } = await supabase.auth.admin.updateUserById(id, {
      user_metadata: { role },
    });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ user: data.user });
  }

  if (req.method === "DELETE") {
    // Guard: don't delete the last admin
    const { data: allUsers } = await supabase.auth.admin.listUsers();
    const admins = (allUsers?.users ?? []).filter(
      u => u.user_metadata?.role === "admin",
    );
    const target = admins.find(u => u.id === id);
    if (target && admins.length <= 1) {
      return res.status(409).json({ error: "Cannot delete the last admin" });
    }

    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  res.status(405).json({ error: "Method not allowed" });
}
```

- [ ] **Step 3: Add env vars to Vercel**

In Vercel Dashboard → Project → Settings → Environment Variables, add:
- `SUPABASE_SERVICE_ROLE_KEY` → your Supabase service role key (from Supabase Dashboard → Project Settings → API → service_role key)
- Verify `VITE_SUPABASE_URL` already exists (it should from the original setup)

- [ ] **Step 4: Commit**

```bash
git add api/admin/users.js "api/admin/users/[id].js"
git commit -m "feat(admin): add Vercel serverless functions for user management"
```

---

## Task 4: db.js Additions

**Files:**
- Modify: `src/db.js`

- [ ] **Step 1: Add `logAudit` helper**

At the top of `src/db.js`, after the imports, add:

```js
// ── Audit log ─────────────────────────────────────────────

async function logAudit(action, tableName, recordId, changes) {
  if (!supabase) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_log").insert({
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      action,
      table_name: tableName,
      record_id: String(recordId ?? ""),
      changes,
    });
  } catch (e) {
    console.error("logAudit failed:", e);
  }
}
```

- [ ] **Step 2: Add `clearTable` function**

At the end of `src/db.js`, add:

```js
// ── Admin: bulk clear ─────────────────────────────────────

const CLEARABLE_TABLES = ["capital_calls", "portfolio_companies", "searchers", "pipeline"];

export async function clearTable(tableName) {
  if (!supabase) return { error: null };
  if (!CLEARABLE_TABLES.includes(tableName)) {
    return { error: new Error(`Table "${tableName}" is not clearable`) };
  }
  // All four tables have an integer `id` column — verified against schema.
  // capital_calls and pipeline use .neq("id", -1); portfolio_companies and searchers use .neq("id", 0).
  // Using .neq("id", -1) works for all since no row will ever have id = -1.
  const { error } = await supabase.from(tableName).delete().neq("id", -1);
  return { error };
}
```

- [ ] **Step 3: Wire `logAudit` into mutating functions**

Update each mutating function to call `logAudit` after a successful operation. Changes are minimal — just add a `logAudit` call after the Supabase operation returns without error:

**`upsertFundMeta`:**
```js
export async function upsertFundMeta(fons, tvpi) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("fund_meta").upsert({ fons, tvpi: tvpi ?? null }, { onConflict: "fons" });
  if (!error) logAudit("update", "fund_meta", fons, { fons, tvpi });
  return { error };
}
```

**`upsertCompany`:**
```js
export async function upsertCompany(company) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("portfolio_companies")
    .upsert(companyToRow(company), { onConflict: "nom" });
  if (!error) logAudit("update", "portfolio_companies", company.nom, { nom: company.nom });
  return { error };
}
```

**`upsertSearcher`:**
```js
export async function upsertSearcher(searcher) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("searchers")
    .update(searcherToRow(searcher))
    .eq("id", searcher.id);
  if (!error) logAudit("update", "searchers", searcher.id, { nom: searcher.nom });
  return { error };
}
```

**`upsertPipelineDeal`:**
```js
export async function upsertPipelineDeal(deal) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("pipeline")
    .upsert({ id: deal.id, ...dealToRow(deal) }, { onConflict: "id" });
  if (!error) logAudit("update", "pipeline", deal.id, { name: deal.name });
  return { error };
}
```

**`deleteCompany`:**
```js
export async function deleteCompany(id) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("portfolio_companies").delete().eq("id", id);
  if (!error) logAudit("delete", "portfolio_companies", id, null);
  return { error };
}
```

**`deleteSearcher`:**
```js
export async function deleteSearcher(id) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("searchers").delete().eq("id", id);
  if (!error) logAudit("delete", "searchers", id, null);
  return { error };
}
```

**`deletePipelineDeal`:**
```js
export async function deletePipelineDeal(id) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("pipeline").delete().eq("id", id);
  if (!error) logAudit("delete", "pipeline", id, null);
  return { error };
}
```

**`insertFund`** (add after the fund_meta upsert, before the return):
```js
logAudit("insert", "capital_calls", fons, { fons, vcpe, est });
```

**`deleteFund`:**
```js
export async function deleteFund(fons) {
  if (!supabase) return null;
  const { error: e1 } = await supabase.from("capital_calls").delete().eq("fons", fons);
  if (e1) return e1;
  const { error: e2 } = await supabase.from("fund_meta").delete().eq("fons", fons);
  if (!e2) logAudit("delete", "capital_calls", fons, { fons });
  return e2 ?? null;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/db.js
git commit -m "feat(admin): add logAudit helper, clearTable, wire audit into all mutations"
```

---

## Task 5: AdminPanel Shell

**Files:**
- Create: `src/components/AdminPanel.jsx`

This is the top-level component for `/admin`. It has a left sidebar with four nav items and renders the active sub-component.

- [ ] **Step 1: Create `src/components/AdminPanel.jsx`**

```jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTheme, ThemeContext, TC_DARK, TC_LIGHT } from "../theme.js";
import { useAuth } from "../auth.jsx";
import AdminUsers from "./admin/AdminUsers.jsx";
import AdminActivity from "./admin/AdminActivity.jsx";
import AdminData from "./admin/AdminData.jsx";
import AdminSettings from "./admin/AdminSettings.jsx";

const NAV = [
  { id: "users",    label: "Usuaris",    icon: "👥" },
  { id: "activity", label: "Activitat",  icon: "📋" },
  { id: "data",     label: "Dades",      icon: "🗄️" },
  { id: "settings", label: "Configuració", icon: "⚙️" },
];

function AdminPanelInner() {
  const { tc } = useTheme();
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState("users");

  const token = session?.access_token;

  return (
    <div style={{ minHeight: "100vh", background: tc.bg, color: tc.text, fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 14, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: tc.card, borderBottom: `1px solid ${tc.border}`, padding: "12px 32px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link to="/" style={{ color: tc.textLight, textDecoration: "none", fontSize: 13 }}>← Dashboard</Link>
        <span style={{ fontWeight: 700, fontSize: 16, color: tc.navy }}>Administració</span>
      </div>

      {/* Body */}
      <div style={{ display: "flex", flex: 1 }}>
        {/* Sidebar */}
        <div style={{ width: 200, background: tc.card, borderRight: `1px solid ${tc.border}`, padding: "24px 0", flexShrink: 0 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setActiveTab(n.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 24px",
                background: activeTab === n.id ? tc.bgAlt : "transparent",
                border: "none", borderLeft: `3px solid ${activeTab === n.id ? tc.green : "transparent"}`,
                cursor: "pointer", fontSize: 13, fontWeight: activeTab === n.id ? 600 : 400,
                color: activeTab === n.id ? tc.navy : tc.textMid, fontFamily: "inherit", textAlign: "left",
              }}>
              <span>{n.icon}</span>
              {n.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: "32px", overflowY: "auto" }}>
          {activeTab === "users"    && <AdminUsers token={token} />}
          {activeTab === "activity" && <AdminActivity />}
          {activeTab === "data"     && <AdminData />}
          {activeTab === "settings" && <AdminSettings />}
        </div>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const [dark, setDark] = useState(() => localStorage.getItem("tc_dark") === "1");
  const tc = dark ? TC_DARK : TC_LIGHT;
  return (
    <ThemeContext.Provider value={{ tc, dark, toggle: () => setDark(d => !d) }}>
      <AdminPanelInner />
    </ThemeContext.Provider>
  );
}
```

- [ ] **Step 2: Create the admin subfolder**

```bash
mkdir -p src/components/admin
```

- [ ] **Step 3: Commit**

```bash
git add src/components/AdminPanel.jsx src/components/admin/
git commit -m "feat(admin): add AdminPanel shell with sidebar nav"
```

---

## Task 6: AdminUsers Component

**Files:**
- Create: `src/components/admin/AdminUsers.jsx`

This component calls the Vercel API functions (not Supabase directly) using `fetch` with the user's JWT in the Authorization header.

- [ ] **Step 1: Create `src/components/admin/AdminUsers.jsx`**

```jsx
import React, { useState, useEffect, useCallback } from "react";
import { useTheme } from "../../theme.js";
import { useToast } from "../../toast.jsx";

const ROLES = ["user", "superuser", "admin"];

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ca-ES", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminUsers({ token }) {
  const { tc } = useTheme();
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState("active");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviting, setInviting] = useState(false);

  const getAuthHeader = () => ({ "Authorization": `Bearer ${token}`, "Content-Type": "application/json" });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { headers: getAuthHeader() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setUsers(json.users);
    } catch (e) {
      toast({ message: "Error carregant usuaris: " + e.message, type: "error" });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const changeRole = async (id, role) => {
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH", headers: getAuthHeader(), body: JSON.stringify({ role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, user_metadata: { ...u.user_metadata, role } } : u));
      toast({ message: "Rol actualitzat." });
    } catch (e) {
      toast({ message: "Error: " + e.message, type: "error" });
    }
  };

  const deleteUser = async (id, email) => {
    if (!confirm(`Eliminar l'usuari ${email}?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE", headers: getAuthHeader() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setUsers(prev => prev.filter(u => u.id !== id));
      toast({ message: `Usuari ${email} eliminat.` });
    } catch (e) {
      toast({ message: "Error: " + e.message, type: "error" });
    }
  };

  const approveUser = async (id) => {
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH", headers: getAuthHeader(),
        body: JSON.stringify({ email_confirm: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      await loadUsers();
      toast({ message: "Usuari aprovat." });
    } catch (e) {
      toast({ message: "Error: " + e.message, type: "error" });
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST", headers: getAuthHeader(),
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast({ message: `Invitació enviada a ${inviteEmail.trim()}.` });
      setInviteEmail("");
      setInviteRole("user");
    } catch (e) {
      toast({ message: "Error: " + e.message, type: "error" });
    } finally {
      setInviting(false);
    }
  };

  const active  = users.filter(u => u.email_confirmed_at);
  const pending = users.filter(u => !u.email_confirmed_at);

  const th = { padding: "9px 12px", fontSize: 10, letterSpacing: "0.09em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600, textAlign: "left", borderBottom: `2px solid ${tc.border}`, whiteSpace: "nowrap" };
  const td = { padding: "10px 12px", borderBottom: `1px solid ${tc.border}` };

  return (
    <div>
      <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: tc.navy }}>Usuaris</h2>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${tc.border}`, marginBottom: 24 }}>
        {[{ id: "active", label: `Actius (${active.length})` }, { id: "pending", label: `Pendents (${pending.length})` }, { id: "invite", label: "Convidar" }].map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            style={{ background: "none", border: "none", borderBottom: `2px solid ${subTab === t.id ? tc.green : "transparent"}`, padding: "8px 20px", cursor: "pointer", fontSize: 13, fontWeight: subTab === t.id ? 600 : 400, color: subTab === t.id ? tc.navy : tc.textMid, fontFamily: "inherit" }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ color: tc.textLight }}>Carregant…</div>}

      {/* Active users */}
      {!loading && subTab === "active" && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: tc.bgAlt }}>
              <th style={th}>Email</th>
              <th style={th}>Rol</th>
              <th style={th}>Últim accés</th>
              <th style={th}>Registre</th>
              <th style={{ ...th, width: 40 }}></th>
            </tr></thead>
            <tbody>
              {active.map(u => (
                <tr key={u.id} style={{ background: "transparent" }}>
                  <td style={td}>{u.email}</td>
                  <td style={td}>
                    <select value={u.user_metadata?.role || "user"} onChange={e => changeRole(u.id, e.target.value)}
                      style={{ padding: "4px 8px", borderRadius: 5, border: `1px solid ${tc.border}`, background: tc.bg, color: tc.text, fontFamily: "inherit", fontSize: 12 }}>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td style={{ ...td, fontSize: 12, color: tc.textMid }}>{formatDate(u.last_sign_in_at)}</td>
                  <td style={{ ...td, fontSize: 12, color: tc.textMid }}>{formatDate(u.created_at)}</td>
                  <td style={td}>
                    <button onClick={() => deleteUser(u.id, u.email)}
                      style={{ background: "transparent", border: `1px solid ${tc.border}`, borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontSize: 11, color: tc.red || "#C62828", fontFamily: "inherit" }}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pending users */}
      {!loading && subTab === "pending" && (
        pending.length === 0
          ? <div style={{ color: tc.textLight }}>Cap usuari pendent de confirmació.</div>
          : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: tc.bgAlt }}>
                <th style={th}>Email</th>
                <th style={th}>Registre</th>
                <th style={{ ...th, width: 180 }}>Accions</th>
              </tr></thead>
              <tbody>
                {pending.map(u => (
                  <tr key={u.id}>
                    <td style={td}>{u.email}</td>
                    <td style={{ ...td, fontSize: 12, color: tc.textMid }}>{formatDate(u.created_at)}</td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => approveUser(u.id)}
                          style={{ padding: "4px 10px", borderRadius: 5, border: "none", background: tc.green, color: "#fff", cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 600 }}>
                          Aprovar
                        </button>
                        <button onClick={() => deleteUser(u.id, u.email)}
                          style={{ padding: "4px 10px", borderRadius: 5, border: `1px solid ${tc.border}`, background: "transparent", color: tc.textMid, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
                          Rebutjar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Invite */}
      {subTab === "invite" && (
        <form onSubmit={handleInvite} style={{ maxWidth: 400, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, color: tc.textLight, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Email</label>
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required
              placeholder="usuari@domini.com"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 7, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: tc.textLight, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Rol</label>
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 7, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit" }}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <button type="submit" disabled={inviting}
            style={{ padding: "9px 20px", borderRadius: 7, border: "none", background: tc.navy, color: "#fff", cursor: inviting ? "not-allowed" : "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 600, opacity: inviting ? 0.7 : 1, alignSelf: "flex-start" }}>
            {inviting ? "Enviant…" : "Enviar invitació"}
          </button>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update `api/admin/users/[id].js` to handle `email_confirm`**

The approveUser call sends `{ email_confirm: true }`. Update the PATCH handler in `api/admin/users/[id].js` to handle this:

```js
  if (req.method === "PATCH") {
    const { role, email_confirm } = req.body;
    const updates = {};
    if (role !== undefined) updates.user_metadata = { role };
    if (email_confirm) updates.email_confirm = true;
    const { data, error } = await supabase.auth.admin.updateUserById(id, updates);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ user: data.user });
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminUsers.jsx "api/admin/users/[id].js"
git commit -m "feat(admin): add AdminUsers component with active/pending/invite tabs"
```

---

## Task 7: AdminActivity Component

**Files:**
- Create: `src/components/admin/AdminActivity.jsx`

Reads from the `audit_log` table using the standard Supabase anon client (the admin SELECT policy allows this for admin users).

- [ ] **Step 1: Create `src/components/admin/AdminActivity.jsx`**

```jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../../supabase.js";
import { useTheme } from "../../theme.js";
import { useToast } from "../../toast.jsx";

const ACTION_COLORS = {
  insert: { color: "#1B5E20", bg: "#E8F5E9" },
  update: { color: "#1A237E", bg: "#E8EAF6" },
  delete: { color: "#B71C1C", bg: "#FFEBEE" },
};

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ca-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function AdminActivity() {
  const { tc } = useTheme();
  const { toast } = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [filterUser, setFilterUser] = useState("");
  const [filterTable, setFilterTable] = useState("");
  const [filterAction, setFilterAction] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) { toast({ message: "Error carregant activitat: " + error.message, type: "error" }); }
      else setLogs(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = logs.filter(l => {
    if (filterUser  && !l.user_email?.includes(filterUser)) return false;
    if (filterTable && l.table_name !== filterTable) return false;
    if (filterAction && l.action !== filterAction) return false;
    return true;
  });

  const tables = [...new Set(logs.map(l => l.table_name).filter(Boolean))];

  // Summary cards
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = logs.filter(l => l.created_at?.startsWith(today)).length;
  const userCounts = {};
  logs.forEach(l => { if (l.user_email) userCounts[l.user_email] = (userCounts[l.user_email] || 0) + 1; });
  const topUser = Object.entries(userCounts).sort((a, b) => b[1] - a[1])[0];
  const tableCounts = {};
  logs.forEach(l => { if (l.table_name) tableCounts[l.table_name] = (tableCounts[l.table_name] || 0) + 1; });
  const topTable = Object.entries(tableCounts).sort((a, b) => b[1] - a[1])[0];

  const th = { padding: "9px 12px", fontSize: 10, letterSpacing: "0.09em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600, textAlign: "left", borderBottom: `2px solid ${tc.border}`, whiteSpace: "nowrap" };
  const td = { padding: "10px 12px", borderBottom: `1px solid ${tc.border}`, fontSize: 12 };

  return (
    <div>
      <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: tc.navy }}>Activitat</h2>

      {/* Summary cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          { label: "Canvis avui", value: todayCount },
          { label: "Usuari més actiu", value: topUser ? `${topUser[0]} (${topUser[1]})` : "—" },
          { label: "Taula més modificada", value: topTable ? `${topTable[0]} (${topTable[1]})` : "—" },
        ].map((c, i) => (
          <div key={i} style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "14px 18px", minWidth: 180, flex: 1 }}>
            <div style={{ fontSize: 10, color: tc.textLight, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: tc.navy }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input placeholder="Filtrar per usuari…" value={filterUser} onChange={e => setFilterUser(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 12, fontFamily: "inherit", width: 200 }} />
        <select value={filterTable} onChange={e => setFilterTable(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 12, fontFamily: "inherit" }}>
          <option value="">Totes les taules</option>
          {tables.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 12, fontFamily: "inherit" }}>
          <option value="">Totes les accions</option>
          <option value="insert">Insert</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
        </select>
      </div>

      {loading && <div style={{ color: tc.textLight }}>Carregant…</div>}

      {!loading && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: tc.bgAlt }}>
              <th style={th}>Data</th>
              <th style={th}>Usuari</th>
              <th style={th}>Acció</th>
              <th style={th}>Taula</th>
              <th style={th}>Registre</th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: tc.textLight }}>Cap resultat</td></tr>
              )}
              {filtered.map(l => {
                const cfg = ACTION_COLORS[l.action] || {};
                const isExp = expanded === l.id;
                return (
                  <React.Fragment key={l.id}>
                    <tr onClick={() => setExpanded(isExp ? null : l.id)} style={{ cursor: "pointer", background: isExp ? tc.bgAlt : "transparent" }}>
                      <td style={td}>{formatDate(l.created_at)}</td>
                      <td style={{ ...td, color: tc.textMid }}>{l.user_email || "—"}</td>
                      <td style={td}>
                        <span style={{ fontSize: 11, borderRadius: 4, padding: "2px 8px", fontWeight: 600, background: cfg.bg, color: cfg.color }}>{l.action}</span>
                      </td>
                      <td style={td}>{l.table_name}</td>
                      <td style={td}>{l.record_id}</td>
                    </tr>
                    {isExp && l.changes && (
                      <tr style={{ background: tc.bgAlt }}>
                        <td colSpan={5} style={{ padding: "8px 12px 12px 32px" }}>
                          <pre style={{ margin: 0, fontSize: 11, color: tc.textMid, fontFamily: "'DM Mono',monospace" }}>
                            {JSON.stringify(l.changes, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/AdminActivity.jsx
git commit -m "feat(admin): add AdminActivity component with audit log and summary cards"
```

---

## Task 8: AdminData Component

**Files:**
- Create: `src/components/admin/AdminData.jsx`

- [ ] **Step 1: Create `src/components/admin/AdminData.jsx`**

```jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../../theme.js";
import { useToast } from "../../toast.jsx";
import { clearTable } from "../../db.js";

const TABLES = [
  { key: "capital_calls",        label: "Capital Calls" },
  { key: "portfolio_companies",  label: "Participades" },
  { key: "searchers",            label: "Searchers" },
  { key: "pipeline",             label: "Pipeline" },
];

export default function AdminData() {
  const { tc } = useTheme();
  const { toast } = useToast();
  const [clearing, setClearing] = useState(null);
  const [confirmText, setConfirmText] = useState("");
  const [confirmTable, setConfirmTable] = useState(null);

  const startClear = (tableKey) => {
    setConfirmTable(tableKey);
    setConfirmText("");
  };

  const handleClear = async () => {
    if (confirmText !== confirmTable) return;
    setClearing(confirmTable);
    setConfirmTable(null);
    setConfirmText("");
    const { error } = await clearTable(confirmTable);
    setClearing(null);
    if (error) toast({ message: "Error: " + error.message, type: "error" });
    else toast({ message: `Taula "${confirmTable}" esborrada.` });
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: tc.navy }}>Dades</h2>

      {/* Bulk Import */}
      <section style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px", marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: tc.navy }}>Importació massiva</h3>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: tc.textMid }}>
          Carrega un fitxer CSV o Excel per substituir les dades de totes les taules. Utilitza el carregador del Dashboard principal.
        </p>
        <Link to="/"
          style={{ display: "inline-block", padding: "8px 16px", borderRadius: 7, background: tc.navy, color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
          ↑ Carregar dades (Dashboard)
        </Link>
      </section>

      {/* Export */}
      <section style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px", marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: tc.navy }}>Exportar snapshot</h3>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: tc.textMid }}>Descarrega totes les dades actuals en format Excel.</p>
        <Link to="/"
          style={{ display: "inline-block", padding: "8px 16px", borderRadius: 7, background: tc.navy, color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
          ↓ Excel (Dashboard)
        </Link>
      </section>

      {/* Table reset */}
      <section style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: tc.navy }}>Esborrar taula</h3>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: tc.textMid }}>Elimina tots els registres d'una taula. Irreversible.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {TABLES.map(t => (
            <div key={t.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 13, color: tc.text, minWidth: 180 }}>{t.label}</span>
              <button onClick={() => startClear(t.key)} disabled={clearing === t.key}
                style={{ padding: "5px 12px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: "transparent", color: tc.red || "#C62828", cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 600 }}>
                {clearing === t.key ? "Esborrant…" : "Esborrar tot"}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Confirm dialog */}
      {confirmTable && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: tc.card, borderRadius: 12, padding: 28, maxWidth: 380, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 12px", color: tc.navy }}>Confirmar esborrament</h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: tc.textMid }}>
              Escriu <strong>{confirmTable}</strong> per confirmar:
            </p>
            <input value={confirmText} onChange={e => setConfirmText(e.target.value)}
              placeholder={confirmTable}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 7, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmTable(null)}
                style={{ padding: "7px 16px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: "transparent", color: tc.textMid, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
                Cancel·lar
              </button>
              <button onClick={handleClear} disabled={confirmText !== confirmTable}
                style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: tc.red || "#C62828", color: "#fff", cursor: confirmText !== confirmTable ? "not-allowed" : "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 600, opacity: confirmText !== confirmTable ? 0.5 : 1 }}>
                Esborrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/AdminData.jsx
git commit -m "feat(admin): add AdminData component with table reset and export"
```

---

## Task 9: AdminSettings Component

**Files:**
- Create: `src/components/admin/AdminSettings.jsx`

- [ ] **Step 1: Create `src/components/admin/AdminSettings.jsx`**

```jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../../supabase.js";
import { useTheme } from "../../theme.js";
import { useToast } from "../../toast.jsx";

export default function AdminSettings() {
  const { tc } = useTheme();
  const { toast } = useToast();
  const [domains, setDomains] = useState([]);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "allowed_domains")
        .single();
      if (error) toast({ message: "Error carregant configuració.", type: "error" });
      else setDomains(data?.value ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const addDomain = () => {
    const d = input.trim().toLowerCase().replace(/^@/, "");
    if (!d || domains.includes(d)) { setInput(""); return; }
    setDomains(prev => [...prev, d]);
    setInput("");
  };

  const removeDomain = (d) => setDomains(prev => prev.filter(x => x !== d));

  const handleKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); addDomain(); }
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "allowed_domains", value: domains });
    setSaving(false);
    if (error) toast({ message: "Error desant: " + error.message, type: "error" });
    else toast({ message: "Configuració desada." });
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: tc.navy }}>Configuració</h2>

      <section style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px", maxWidth: 500 }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: tc.navy }}>Dominis permesos</h3>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: tc.textMid }}>
          Només emails d'aquests dominis podran registrar-se. Si la llista és buida, qualsevol domini és permès.
        </p>

        {loading ? <div style={{ color: tc.textLight }}>Carregant…</div> : (
          <>
            {/* Tag list */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12, minHeight: 32 }}>
              {domains.map(d => (
                <span key={d} style={{ display: "flex", alignItems: "center", gap: 5, background: tc.bgAlt, border: `1px solid ${tc.border}`, borderRadius: 5, padding: "3px 10px", fontSize: 12, color: tc.text }}>
                  {d}
                  <button onClick={() => removeDomain(d)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: tc.textLight, padding: 0, fontSize: 13, lineHeight: 1 }}>×</button>
                </span>
              ))}
              {domains.length === 0 && <span style={{ fontSize: 12, color: tc.textLight }}>Cap domini configurat — tots permesos.</span>}
            </div>

            {/* Input */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="espaidinversions.com"
                style={{ flex: 1, padding: "7px 12px", borderRadius: 7, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit" }} />
              <button onClick={addDomain}
                style={{ padding: "7px 14px", borderRadius: 7, border: "none", background: tc.navy, color: "#fff", cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 600 }}>
                Afegir
              </button>
            </div>

            <button onClick={handleSave} disabled={saving}
              style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: tc.green, color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
              {saving ? "Desant…" : "Desar"}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/AdminSettings.jsx
git commit -m "feat(admin): add AdminSettings component with domain allowlist"
```

---

## Task 10: Verification + Deploy

- [ ] **Step 1: Add Vercel env vars**

In Vercel Dashboard → Project → Settings → Environment Variables:
- `SUPABASE_SERVICE_ROLE_KEY` → service_role key from Supabase Dashboard → Project Settings → API

- [ ] **Step 2: Local smoke test**

Run `npm run dev`. Log in as admin. Verify:
- Admin link appears in header
- `/admin` loads without errors
- All four sidebar tabs render
- Users tab shows the user list
- Activity tab shows audit log (make a change in the dashboard first to generate a log entry)
- Settings tab loads the domains list

- [ ] **Step 3: Deploy**

```bash
vercel --prod --yes
```

- [ ] **Step 4: Production smoke test**

On the live site:
- Log in as admin → Admin link visible
- Navigate to `/admin` → panel loads
- Invite a test user → receives email
- Check activity log shows the invitation (note: invites go through the API function, not `logAudit` — this is expected)
- Add a domain in Settings → save → reload → domain persists

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(admin): post-deploy fixes"
```
