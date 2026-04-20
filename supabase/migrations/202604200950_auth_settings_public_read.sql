-- Migration: allow anon reads of the allowed_domains setting
-- Needed so api/auth-settings.js can use the anon key instead of the service role key.
-- Only the single row with key = 'allowed_domains' is exposed; all other app_settings
-- rows remain admin-only per the existing app_settings_admin_read policy.

DROP POLICY IF EXISTS app_settings_allowed_domains_public ON app_settings;

CREATE POLICY app_settings_allowed_domains_public
  ON app_settings
  FOR SELECT
  TO anon, authenticated
  USING (key = 'allowed_domains');
