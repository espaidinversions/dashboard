-- Migration: per-user section permissions
-- No row = full access (safe default). Denied sections are listed per user.

CREATE TABLE IF NOT EXISTS user_permissions (
  user_id  TEXT PRIMARY KEY,
  denied_sections TEXT[] NOT NULL DEFAULT '{}'
);

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Admins and superusers can manage all rows
CREATE POLICY user_permissions_admin_all ON user_permissions
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'role') IN ('admin', 'superuser')
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') IN ('admin', 'superuser')
  );

-- Users can read their own row (so the frontend can enforce visibility)
CREATE POLICY user_permissions_own_read ON user_permissions
  FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);
