# Security Hardening (Option A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the dashboard against the top security findings from the audit before Vercel deployment.

**Architecture:** Six targeted changes across four areas — server.js error/CSV/CORS fixes, shared api rate-limiter extraction + CORS, vercel.json CSP header, and a DataLoader xlsx sheet-count guard. No new dependencies needed.

**Tech Stack:** Express 4 (server.js), Vercel serverless functions (api/), React 18 + xlsx 0.18.5 (frontend)

**Spec:** `docs/superpowers/specs/2026-03-25-security-hardening-design.md`

---

## File Map

| File | Status | Change |
|------|--------|--------|
| `server.js` | Modify | Generic errors, CSV sanitization helper, CORS middleware |
| `api/_rateLimit.js` | **Create** | Shared rate limiter extracted from admin handlers |
| `api/admin/users.js` | Modify | Import `_rateLimit.js`, add CORS helper |
| `api/admin/users/[id].js` | Modify | Import `_rateLimit.js`, add CORS helper |
| `vercel.json` | Modify | Add CSP header to existing headers block |
| `src/components/DataLoader.jsx` | Modify | Sheet count guard after `XLSX.read()` |

---

## Task 1: server.js — Fix error message exposure

**Files:**
- Modify: `server.js` (lines 73–76, 116–119, 157–160, 173–176)

There are four catch blocks that return `e.message` directly. These can expose file paths or OS details. Replace all four with a generic string while keeping `console.error` for internal visibility.

- [ ] **Step 1: Open `server.js` and find the four catch blocks**

They are at approximately:
- Line 75: `/api/pipeline` catch
- Line 118: `/api/capital-calls` catch
- Line 159: `/api/data-version` catch
- Line 175: `/api/board` catch

Each looks like:
```js
} catch (e) {
  console.error("...", e);
  res.status(500).json({ error: e.message });
}
```

- [ ] **Step 2: Replace `e.message` with generic string in all four catch blocks**

Change every instance of:
```js
res.status(500).json({ error: e.message });
```
to:
```js
res.status(500).json({ error: "Internal server error" });
```

Leave the `console.error` lines untouched — those are fine for internal logging.

- [ ] **Step 3: Verify manually**

Start the dev server: `npm run server`

Send a bad request to trigger an error:
```bash
curl -X POST http://localhost:3001/api/pipeline \
  -H "Content-Type: application/json" \
  -d '"not-an-array"'
```
Expected response: `{"error":"Expected array"}` (the 400 validation path, not a 500).

To test the 500 path, temporarily corrupt a path in `server.js`, restart, hit the endpoint, and confirm the response is `{"error":"Internal server error"}` not a file path. Revert the corruption.

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "fix: replace e.message exposure with generic 500 errors in server.js"
```

---

## Task 2: server.js — CSV formula injection sanitization

**Files:**
- Modify: `server.js` (after line 22, inside `csvEscape`)

Add a `sanitizeCsvValue` helper that prefixes formula-triggering characters with a single quote. Integrate it into the existing `csvEscape` function so all CSV output is automatically sanitized.

- [ ] **Step 1: Add `sanitizeCsvValue` above `csvEscape` in server.js**

Insert this function immediately before the `csvEscape` function (around line 18):

```js
function sanitizeCsvValue(v) {
  const s = String(v ?? "");
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}
```

- [ ] **Step 2: Update `csvEscape` to call `sanitizeCsvValue` first**

The current `csvEscape` function starts with `const s = String(v ?? "")`. Replace that first line so the sanitized value is used instead:

Current:
```js
function csvEscape(v) {
  const s = String(v ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"` : s;
}
```

Replace with:
```js
function csvEscape(v) {
  const s = sanitizeCsvValue(v);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"` : s;
}
```

- [ ] **Step 3: Verify manually**

Restart the server. Use the dashboard to save a pipeline entry whose name starts with `=SUM(1+1)`. Open the generated `raw-data/pipeline.csv` and confirm the value is stored as `'=SUM(1+1)` (with the leading single quote), not `=SUM(1+1)`.

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "fix: sanitize CSV formula injection in server.js csvEscape"
```

---

## Task 3: server.js — CORS middleware

**Files:**
- Modify: `server.js` (after the `const app = express();` line, around line 13)

Add an explicit CORS middleware so that the Vite dev server (port 5173) can call the Express API (port 3001). Without this, browsers block the requests. The allowed origin is read from `ALLOWED_ORIGIN` env var so it can be locked down in production without code changes.

- [ ] **Step 1: Add CORS middleware after `app.use(express.json(...))`**

Insert this block immediately after line 14 (`app.use(express.json({ limit: "20mb" }));`):

```js
// ── CORS ─────────────────────────────────────────────────
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "http://localhost:5173";
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
```

- [ ] **Step 2: Verify manually**

Run `npm run dev` (starts both server and Vite). Open the dashboard in the browser. Open DevTools → Network tab. Trigger a data save action (e.g. save pipeline). Confirm the `POST /api/pipeline` request succeeds (200) and has no CORS error in the console.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "fix: add explicit CORS middleware to server.js"
```

---

## Task 4: api/ — Extract shared rate limiter

**Files:**
- Create: `api/_rateLimit.js`
- Modify: `api/admin/users.js` (lines 8–22)
- Modify: `api/admin/users/[id].js` (lines 8–22)

Both admin handlers have identical copy-pasted rate limiter code. Extract to a shared module. The underscore prefix (`_rateLimit.js`) tells Vercel not to treat this file as an HTTP endpoint.

- [ ] **Step 1: Create `api/_rateLimit.js`**

```js
const rateLimitMap = new Map();

export function isRateLimited(ip) {
  const now = Date.now();
  const window = 60_000;
  const max = 30;
  const entry = rateLimitMap.get(ip) ?? { count: 0, start: now };
  if (now - entry.start > window) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return false;
  }
  if (entry.count >= max) return true;
  rateLimitMap.set(ip, { ...entry, count: entry.count + 1 });
  return false;
}
```

- [ ] **Step 2: Update `api/admin/users.js`**

Remove the duplicated rate limiter block (lines 8–22):
```js
// Simple in-memory rate limiter: max 30 requests per IP per minute
const rateLimitMap = new Map();
function isRateLimited(ip) {
  ...
}
```

Add the import on line 2, immediately after the `createClient` import and before the `serverError` function:
```js
import { createClient } from "@supabase/supabase-js";
import { isRateLimited } from "../_rateLimit.js";  // ← add this line

function serverError(res, error, context) {
```

- [ ] **Step 3: Update `api/admin/users/[id].js`**

Same change: remove the duplicated rate limiter block (lines 8–22) and add the import on line 2:
```js
import { createClient } from "@supabase/supabase-js";
import { isRateLimited } from "../../_rateLimit.js";  // ← add this line (note deeper path)

function serverError(res, error, context) {
```

- [ ] **Step 4: Verify**

Run `npm run dev`. Navigate to the admin panel in the browser. Confirm user listing still works (no 500 errors, no import errors in the terminal).

- [ ] **Step 5: Commit**

```bash
git add api/_rateLimit.js api/admin/users.js "api/admin/users/[id].js"
git commit -m "refactor: extract shared rate limiter to api/_rateLimit.js"
```

---

## Task 5: api/ — Add CORS to admin handlers

**Files:**
- Modify: `api/admin/users.js`
- Modify: `api/admin/users/[id].js`

When deployed to Vercel, browsers require explicit CORS headers on API responses. Add a `setCors` helper and an early-return for `OPTIONS` preflight requests. The preflight must return before the auth check — preflight requests carry no credentials.

- [ ] **Step 1: Add `setCors` helper and apply it in `api/admin/users.js`**

Add this helper after the imports, before the `serverError` function:
```js
function setCors(res) {
  const origin = process.env.ALLOWED_ORIGIN || "http://localhost:5173";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}
```

In the `handler` function, add these two lines immediately after the opening of the function body (before the rate limit check):
```js
setCors(res);
if (req.method === "OPTIONS") return res.status(204).end();
```

- [ ] **Step 2: Same change in `api/admin/users/[id].js`**

Add the identical `setCors` helper. Apply the same two lines at the top of the handler body.

- [ ] **Step 3: Verify**

Run `npm run dev`. Open DevTools → Network. Trigger an admin panel action (list users). Confirm no CORS errors in the console. The response headers should include `Access-Control-Allow-Origin: http://localhost:5173`.

- [ ] **Step 4: Commit**

```bash
git add api/admin/users.js "api/admin/users/[id].js"
git commit -m "fix: add CORS headers to admin API handlers for Vercel deployment"
```

---

## Task 6: vercel.json — Add Content-Security-Policy

**Files:**
- Modify: `vercel.json`

`vercel.json` already has five security headers. Add a CSP header to the existing headers block. The CSP restricts script execution to same-origin bundles, whitelists Supabase and the EUR/USD API for fetch calls, and allows inline styles (required by Recharts/Nivo).

- [ ] **Step 1: Add CSP to the `headers` array in `vercel.json`**

The existing `headers[0].headers` array has five entries. Add a sixth:

```json
{
  "key": "Content-Security-Policy",
  "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://*.supabase.co https://api.frankfurter.app; font-src 'self' data:; frame-ancestors 'none'"
}
```

After the change the `headers` block should look like:
```json
"headers": [
  {
    "source": "/(.*)",
    "headers": [
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "X-Frame-Options", "value": "DENY" },
      { "key": "X-XSS-Protection", "value": "1; mode=block" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
      { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://*.supabase.co https://api.frankfurter.app; font-src 'self' data:; frame-ancestors 'none'" }
    ]
  }
]
```

- [ ] **Step 2: Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('valid')"
```
Expected output: `valid`

- [ ] **Step 3: Verify CSP doesn't break the app**

Run `npm run dev`. Open the dashboard in the browser. Open DevTools → Console. Look for any CSP violation errors (`Refused to load...`). The app should function normally — all charts, data loading, and navigation.

If a violation appears, identify the blocked resource and add the narrowest possible exception to the CSP value (e.g., an additional domain in `connect-src`).

- [ ] **Step 4: Commit**

```bash
git add vercel.json
git commit -m "fix: add Content-Security-Policy header to vercel.json"
```

---

## Task 7: DataLoader.jsx — xlsx sheet count guard

**Files:**
- Modify: `src/components/DataLoader.jsx` (inside `readXLSX`, after `XLSX.read()` on line 23)

A file-size check already exists (line 19). Add a sheet count check after parsing to prevent memory exhaustion from workbooks with thousands of sheets.

- [ ] **Step 1: Add sheet count guard in `readXLSX` after `XLSX.read()`**

Current code around line 22–23:
```js
const XLSX = await import("xlsx");
const buf  = await file.arrayBuffer();
const wb   = XLSX.read(buf, { type: "array" });
const sheet = name => {
```

Insert the guard immediately after `XLSX.read(...)`:
```js
const wb = XLSX.read(buf, { type: "array" });
if (wb.SheetNames.length > 20) {
  setError("El fitxer té massa fulls (màxim 20).");
  return;
}
const sheet = name => {
```

- [ ] **Step 2: Verify manually**

Run `npm run dev`. Open the DataLoader modal. Upload a valid xlsx file (a normal export). Confirm it loads correctly as before.

For the guard path: if you have access to a crafted xlsx with many sheets, verify the error message appears. Otherwise, inspect the code visually — the guard fires before any sheet iteration.

- [ ] **Step 3: Commit**

```bash
git add src/components/DataLoader.jsx
git commit -m "fix: add xlsx sheet count guard in DataLoader to prevent memory exhaustion"
```

---

## Done

All 7 tasks complete. Run the app end-to-end one final time (`npm run dev`) and confirm:
- Dashboard loads without console errors
- DataLoader accepts valid xlsx and csv files
- Admin panel lists users without CORS errors
- No CSP violations in the console

```bash
git log --oneline -7
```

Should show 7 security fix commits.
