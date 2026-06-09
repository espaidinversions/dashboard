-- Grant abel@espaidinversions.com access to cash-model section
INSERT INTO user_permissions (user_id, section_roles)
SELECT id::text, '{"cash-model":"user"}'::jsonb
FROM auth.users
WHERE email = 'abel@espaidinversions.com'
ON CONFLICT (user_id) DO UPDATE
  SET section_roles = user_permissions.section_roles || '{"cash-model":"user"}'::jsonb;
