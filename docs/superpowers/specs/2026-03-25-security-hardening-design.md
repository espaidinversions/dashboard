# Security Hardening — Option A

**Date:** 2026-03-25
**Scope:** Pre-Vercel deployment hardening — server.js, api/ admin handlers, vercel.json, DataLoader xlsx guard

---

## Background

A security audit surfaced several actionable issues. This spec covers the Option A scope: fixes that matter before Vercel deployment, without a risky xlsx library migration.

---

## Changes

### 1. server.js — Error message exposure

**Problem:** `/api/pipeline` and `/api/capital-calls` catch blocks return `e.message` directly:
```js
res.status(500).json({ error: e.message });
```
This can leak internal file paths, stack frames, or OS details.

**Fix:** Replace with a generic message:
```js
res.status(500).json({ error: "Internal server error" });
```
Keep `console.error` for internal visibility; remove it from the response body.

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

**Problem:** No CORS policy. Relies on browser defaults, which allows any origin to make credentialed requests to the local server.

**Fix:** Add a minimal CORS middleware at the top of server.js:
- Reads `ALLOWED_ORIGIN` env var (falls back to `http://localhost:5173` for dev)
- Sets `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`
- Handles `OPTIONS` preflight with `204 No Content`

No new dependency needed — plain Express middleware.

---

### 4. api/_rateLimit.js — Shared rate limiter

**Problem:** `rateLimitMap` + `isRateLimited` are copy-pasted identically in both `api/admin/users.js` and `api/admin/users/[id].js`. Changes must be made in two places.

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
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  connect-src 'self' https://*.supabase.co https://api.frankfurter.app;
  font-src 'self' data:;
  frame-ancestors 'none'
```
- `unsafe-inline` for scripts and styles: required by Recharts/Nivo which inject inline styles
- `connect-src` explicitly whitelists Supabase and the EUR/USD rate API
- `frame-ancestors 'none'` redundant with X-Frame-Options but defense-in-depth

---

### 7. DataLoader.jsx — xlsx input guard

**Problem:** No validation before `XLSX.read()`. A crafted file can trigger ReDoS or prototype pollution via the xlsx library (no upstream fix available).

**Fix:** Add two guards before parsing in the `readXLSX` function:

1. **File size**: reject files > 10 MB with a user-visible error set via `setXlsxStatus`
2. **Sheet count**: after `XLSX.read()`, reject workbooks with > 20 sheets

Both surface errors in the existing `xlsxStatus` UI state — no new UI needed.

---

## Files Changed

| File | Change |
|------|--------|
| `server.js` | Generic errors, CSV sanitization, CORS middleware |
| `api/_rateLimit.js` | New shared module (extracted from admin handlers) |
| `api/admin/users.js` | Import shared rate limiter, add CORS headers |
| `api/admin/users/[id].js` | Import shared rate limiter, add CORS headers |
| `vercel.json` | Add CSP header |
| `src/components/DataLoader.jsx` | File size + sheet count guard before xlsx parse |

---

## Out of Scope

- xlsx library replacement (attack surface is own-generated files; guard is sufficient)
- Persistent rate limiting (single-instance Vercel functions; in-memory acceptable)
- localStorage encryption (internal tool; cleared on logout)
- HTTPS enforcement (handled automatically by Vercel)
- Audit logging (deferred; no DB table designed yet)
- TypeScript migration
