-- Migration: Role permission helpers (corrected)
-- Defines current_app_role(), is_superuser(), is_admin() for use in RLS policies.
-- is_superuser() → 'admin' or 'superuser' (both can write data — matches existing RLS policies)
-- is_admin()     → 'admin' or 'superuser' (can read audit log, revert via API)

-- Helper: extract the role from the JWT's app_metadata claim
CREATE OR REPLACE FUNCTION current_app_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role',
    'user'
  );
$$;

-- Write check: 'admin' or 'superuser' can mutate data via RLS policies
CREATE OR REPLACE FUNCTION is_superuser()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT current_app_role() IN ('admin', 'superuser');
$$;

-- Admin check: 'admin' or 'superuser' can access admin-level read operations
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT current_app_role() IN ('admin', 'superuser');
$$;
