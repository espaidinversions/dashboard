# Security Hardening — Option A

**Date:** 2026-03-25
**Scope:** Pre-Vercel deployment hardening — server.js, api/ admin handlers, vercel.json, DataLoader xlsx guard

---

## Background

A security audit surfaced several actionable issues. This spec covers the Option A scope: fixes that matter before Vercel deployment, without a risky xlsx library migration.

---

## Changes

### 1. server.js — Error message exposure

**Problem:** Four catch blocks in `server.js` return `e.message` directly:
- `/api/pipeline` (line 75)
- `/api/capital-calls` (line 118)
- `/api/data-version` (line 159)
- `/api/board` (line 175)

This can leak internal file paths, stack frames, or OS details. The admin API handlers in `api/` already return generic errors correctly and are not affected.

**Fix:** Replace all four with a generic message:
```js
res.status(500).json({ error: "Internal server error" });
```
Keep `console.error` for internal visibility; remove the raw error from the response body.

---

### 2. server.js — CSV formula injection sanitization

**Problem:** Values written to CSV files are not sanitized. A value starting with `=`, `+`, `-`, `@`, `\t`, or `\r` will be interpreted as a formula if the CSV is opened in Excel or Google Sheets.

**Fix:** Add `sanitizeCsvValue(v)` helper applied inside `csvEscape()`:
```js
function sanitizeCsvValue(v) {
  const s = String(v ?? "");
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}
```
The single-quote prefix is the standard CSV injection defense recognized by Excel and Sheets.

Applied to all field values before CSV serialization in `/api/pipeline` and `/api/capital-calls`.

---

### 3. server.js — CORS

**Problem:** `server.js` (port 3001) has no CORS headers. The React dev server runs on port 5173 — a different origin. Browsers block cross-origin requests by default, so without explicit CORS headers the frontend cannot call the API in development. More importantly, adding CORS later without an explicit allowlist risks being too permissive in production.

**Fix:** Add a minimal CORS middleware at the top of server.js:
- Reads `ALLOWED_ORIGIN` env var (falls back to `http://localhost:5173` for dev)
- Sets `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`
- Handles `OPTIONS` preflight with `204 No Content`

No new dependency needed — plain Express middleware.

---

### 4. api/_rateLimit.js — Shared rate limiter (DRY refactor)

**Problem:** `rateLimitMap` + `isRateLimited` are copy-pasted identically in both `api/admin/users.js` and `api/admin/users/[id].js`. Changes must be made in two places.

**Note:** On Vercel, each serverless function file has its own module scope — extracting to a shared file does not create shared state across endpoints. Each handler retains its own independent rate limit counter. The extraction is purely a code-quality improvement.

**Fix:** Extract to `api/_rateLimit.js` (underscore prefix = Vercel non-route convention):
```js
// api/_rateLimit.js
const rateLimitMap = new Map();
export function isRateLimited(ip) { ... }
```
Both admin handlers import from this shared module.

---

### 5. api/ admin handlers — CORS

**Problem:** Admin API endpoints have no CORS headers. When deployed to Vercel, browsers will block cross-origin requests from the frontend.

**Fix:** Add CORS headers to both `users.js` and `users/[id].js` handler functions:
- `Access-Control-Allow-Origin`: reads `ALLOWED_ORIGIN` env var
- `Access-Control-Allow-Methods`: `GET, POST, PATCH, DELETE, OPTIONS`
- `Access-Control-Allow-Headers`: `Content-Type, Authorization`
- Return `204` on `OPTIONS` preflight before auth check (preflight requests carry no credentials)

---

### 6. vercel.json — Content-Security-Policy

**Problem:** `vercel.json` already has `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy` — but no CSP.

**Fix:** Add CSP header to the existing `headers` block:
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  connect-src 'self' https://*.supabase.co https://api.frankfurter.app;
  font-src 'self' data:;
  frame-ancestors 'none'
```
- `style-src 'unsafe-inline'`: required by Recharts/Nivo which inject inline styles at runtime
- `script-src 'self'` only: Vite bundles all JS into files, no inline scripts needed
- `connect-src` explicitly whitelists Supabase and the EUR/USD rate API
- `frame-ancestors 'none'` redundant with X-Frame-Options but defense-in-depth

---

### 7. DataLoader.jsx — xlsx sheet count guard

**Problem:** `DataLoader.jsx` already rejects files over 10 MB before parsing. However, there is no limit on sheet count — a crafted workbook with thousands of sheets can cause memory exhaustion after the file-size check passes.

**Fix:** After `XLSX.read()`, check `wb.SheetNames.length`. If more than 20 sheets, reject with a user-visible error via the existing `setXlsxStatus` mechanism.

---

## Files Changed

| File | Change |
|------|--------|
| `server.js` | Generic errors (4 catch blocks), CSV sanitization, CORS middleware |
| `api/_rateLimit.js` | New shared module (extracted from admin handlers) |
| `api/admin/users.js` | Import shared rate limiter, add CORS headers |
| `api/admin/users/[id].js` | Import shared rate limiter, add CORS headers |
| `vercel.json` | Add CSP header |
| `src/components/DataLoader.jsx` | Sheet count guard after xlsx parse |

---

## Out of Scope

- xlsx library replacement (attack surface is own-generated files; guard is sufficient)
- Persistent rate limiting (single-instance Vercel functions; in-memory acceptable)
- localStorage encryption (internal tool; cleared on logout)
- HTTPS enforcement (handled automatically by Vercel)
- Audit logging (deferred; no DB table designed yet)
- TypeScript migration
