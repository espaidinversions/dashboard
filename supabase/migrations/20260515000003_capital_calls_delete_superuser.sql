-- Ensure superusers can delete capital_calls.
-- The original FOR ALL policy covered DELETE; splitting it may have left a gap.

drop policy if exists capital_calls_delete_superuser on capital_calls;

create policy capital_calls_delete_superuser
  on capital_calls for delete
  to authenticated
  using (public.is_superuser());
