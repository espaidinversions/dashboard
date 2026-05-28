-- Migration: allow all authenticated users to insert capital calls
-- Previously capital_calls_write_superuser used FOR ALL, blocking non-admins
-- from inserting. Non-admins (e.g. Oleguer) should be able to add transactions
-- for existing vehicles; only admins need to modify or delete them.

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
