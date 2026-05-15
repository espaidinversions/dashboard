-- Idempotent re-apply: drop and recreate the three targeted RLS policies.
-- Needed because 20260515000000 may have been partially applied.

drop policy if exists capital_calls_write_superuser on capital_calls;
drop policy if exists capital_calls_insert_authenticated on capital_calls;
drop policy if exists capital_calls_update_superuser on capital_calls;
drop policy if exists capital_calls_delete_superuser on capital_calls;

-- All authenticated users can INSERT new capital calls.
create policy capital_calls_insert_authenticated
  on capital_calls for insert
  to authenticated
  with check (true);

-- Only admins/superusers can UPDATE existing capital calls.
create policy capital_calls_update_superuser
  on capital_calls for update
  to authenticated
  using (public.is_superuser())
  with check (public.is_superuser());

-- Only admins/superusers can DELETE capital calls.
create policy capital_calls_delete_superuser
  on capital_calls for delete
  to authenticated
  using (public.is_superuser());
