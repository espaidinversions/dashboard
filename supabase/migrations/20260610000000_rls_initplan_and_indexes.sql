-- Migration: RLS correctness + performance hardening
-- 2026-06-10
--
-- 1. Fix user_permissions_admin_all: it checked the top-level JWT 'role' claim,
--    which is always 'authenticated'/'anon' in Supabase — the policy never
--    matched anyone. The app role lives in app_metadata.role (current_app_role()).
-- 2. Wrap is_superuser()/is_admin() calls in (SELECT ...) so the planner
--    evaluates them once per query (initplan) instead of once per row.
--    is_superuser() now also queries user_permissions, so per-row evaluation
--    is a real cost on table scans.
-- 3. Add indexes on frequently-filtered columns.
--
-- Policy definitions below recreate the CURRENT latest-wins state of each
-- policy (after 20260515000004 / 20260520000000), only changing the
-- function-call wrapping.

-- ── 1. user_permissions admin policy (correctness fix) ──────────────
drop policy if exists user_permissions_admin_all on user_permissions;
create policy user_permissions_admin_all
  on user_permissions for all
  to authenticated
  using ((select public.current_app_role()) in ('admin', 'superuser'))
  with check ((select public.current_app_role()) in ('admin', 'superuser'));

-- ── 2. Initplan-wrapped superuser write policies ─────────────────────

-- capital_calls (insert: any authenticated; update: superuser; delete: authenticated)
drop policy if exists capital_calls_update_superuser on capital_calls;
create policy capital_calls_update_superuser
  on capital_calls for update
  to authenticated
  using ((select public.is_superuser()))
  with check ((select public.is_superuser()));

-- fund_meta
drop policy if exists fund_meta_write_superuser on fund_meta;
create policy fund_meta_write_superuser
  on fund_meta for all
  to authenticated
  using ((select public.is_superuser()))
  with check ((select public.is_superuser()));

-- pipeline
drop policy if exists pipeline_write_superuser on pipeline;
create policy pipeline_write_superuser
  on pipeline for all
  to authenticated
  using ((select public.is_superuser()))
  with check ((select public.is_superuser()));

-- portfolio_companies
drop policy if exists portfolio_companies_write_superuser on portfolio_companies;
create policy portfolio_companies_write_superuser
  on portfolio_companies for all
  to authenticated
  using ((select public.is_superuser()))
  with check ((select public.is_superuser()));

-- searchers
drop policy if exists searchers_write_superuser on searchers;
create policy searchers_write_superuser
  on searchers for all
  to authenticated
  using ((select public.is_superuser()))
  with check ((select public.is_superuser()));

-- pm_transactions
drop policy if exists pm_transactions_write_superuser on pm_transactions;
create policy pm_transactions_write_superuser
  on pm_transactions for all
  to authenticated
  using ((select public.is_superuser()))
  with check ((select public.is_superuser()));

-- pm_ter_overrides
drop policy if exists pm_ter_overrides_write_superuser on pm_ter_overrides;
create policy pm_ter_overrides_write_superuser
  on pm_ter_overrides for all
  to authenticated
  using ((select public.is_superuser()))
  with check ((select public.is_superuser()));

-- pm_position_meta
drop policy if exists pm_position_meta_write_superuser on pm_position_meta;
create policy pm_position_meta_write_superuser
  on pm_position_meta for all
  to authenticated
  using ((select public.is_superuser()))
  with check ((select public.is_superuser()));

-- pm_position_overrides
drop policy if exists pm_position_overrides_write_superuser on pm_position_overrides;
create policy pm_position_overrides_write_superuser
  on pm_position_overrides for all
  to authenticated
  using ((select public.is_superuser()))
  with check ((select public.is_superuser()));

-- private_entities (insert: any authenticated; update/delete: superuser)
drop policy if exists private_entities_update_superuser on private_entities;
create policy private_entities_update_superuser
  on private_entities for update
  to authenticated
  using ((select public.is_superuser()))
  with check ((select public.is_superuser()));

drop policy if exists private_entities_delete_superuser on private_entities;
create policy private_entities_delete_superuser
  on private_entities for delete
  to authenticated
  using ((select public.is_superuser()));

-- prospective_cash_forecasts (read AND write are superuser-gated)
drop policy if exists prospective_cash_forecasts_read_superuser on prospective_cash_forecasts;
create policy prospective_cash_forecasts_read_superuser
  on prospective_cash_forecasts for select
  to authenticated
  using ((select public.is_superuser()));

drop policy if exists prospective_cash_forecasts_write_superuser on prospective_cash_forecasts;
create policy prospective_cash_forecasts_write_superuser
  on prospective_cash_forecasts for all
  to authenticated
  using ((select public.is_superuser()))
  with check ((select public.is_superuser()));

-- app_settings / audit_log (admin-gated)
drop policy if exists app_settings_admin_read on app_settings;
create policy app_settings_admin_read
  on app_settings for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists app_settings_admin_write on app_settings;
create policy app_settings_admin_write
  on app_settings for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists audit_log_admin_read on audit_log;
create policy audit_log_admin_read
  on audit_log for select
  to authenticated
  using ((select public.is_admin()));

-- ── 3. Missing indexes on frequently-filtered columns ────────────────
create index if not exists idx_capital_calls_fons on capital_calls(fons);
create index if not exists idx_portfolio_companies_nom on portfolio_companies(nom);
create index if not exists idx_searchers_nom on searchers(nom);
create index if not exists idx_private_entities_canonical_name on private_entities(canonical_name);
create index if not exists idx_audit_log_table_created on audit_log(table_name, created_at desc);
