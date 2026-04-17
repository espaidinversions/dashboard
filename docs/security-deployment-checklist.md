# Security / Deployment Checklist

## Implemented in repo

- No API keys or service-role secrets committed to frontend source. Guarded by `test/frontendGuardrails.test.js`.
- Internal HTTP routes now use explicit auth and role checks:
  - authenticated: `/api/eur-usd`, `/api/data-version`, `/api/board`
  - admin-only: `/api/admin/users`, `/api/admin/users/:id`, `/api/admin/settings/allowed-domains`, `/api/admin/audit-log`
  - local admin-only write routes: `/api/pipeline`, `/api/capital-calls`
- HTTPS enforced in app handlers with redirect support plus HSTS in `vercel.json`.
- CORS locked to `ALLOWED_ORIGINS` / `ALLOWED_ORIGIN`, no wildcard fallback.
- Server-side validation and sanitization added for admin payloads, CSV upload payloads, domains, emails, pagination, and numeric fields.
- Rate limiting added per bucket (`auth`, `sensitive`, `admin`, `public`).
- Auth tokens and password hashing are handled by Supabase Auth.
- Logout now uses `supabase.auth.signOut({ scope: "global" })` to invalidate refresh tokens server-side.
- RLS migration added in [`supabase/migrations/20260413_security_policies.sql`](/C:/Users/EduardGenís/OneDrive%20-%20Espai%20d%27Inversions/Documents/Claude/01.%20Dashboard/supabase/migrations/20260413_security_policies.sql).
- Migrations are version-controlled in `supabase/migrations/`.
- Admin list endpoints are paginated.
- Frontend guardrail test blocks `console.log` in `src/`.
- `npm audit` can be run with `npm audit --audit-level=critical`.

## Managed by platform

- Password hashing: Supabase Auth
- Token expiry: Supabase Auth
- SSL certificate: Vercel-managed
- Process manager / public firewall ports: Vercel-managed
- Connection pooling / non-root DB user: Supabase-managed

## Manual operational checks still required

- Configure and test Supabase backups and restore drills.
- Keep separate Supabase projects for development and production.
- Verify all required environment variables are present in Vercel and local `.env.local`.
- Run staging/preview verification before promoting to production.
- Maintain a rollback path using Vercel deployment history and Supabase migration rollback procedures.
