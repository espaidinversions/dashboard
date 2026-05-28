-- Update is_superuser() to check section-specific roles in user_permissions
-- in addition to the global app_metadata.role.
-- A user is considered superuser if:
--   1. Their global JWT role is 'admin' or 'superuser', OR
--   2. They have 'superuser' on txlog OR alternatives in user_permissions.

CREATE OR REPLACE FUNCTION public.is_superuser()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    current_app_role() IN ('admin', 'superuser')
    OR EXISTS (
      SELECT 1
      FROM public.user_permissions
      WHERE user_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
        AND (
          section_roles @> '{"txlog":"superuser"}'::jsonb
          OR section_roles @> '{"alternatives":"superuser"}'::jsonb
        )
    );
$$;
