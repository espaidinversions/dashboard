-- Allow all authenticated users to delete capital_calls rows.

drop policy if exists capital_calls_delete_authenticated on capital_calls;
drop policy if exists capital_calls_delete_superuser on capital_calls;

create policy capital_calls_delete_authenticated
  on capital_calls for delete
  to authenticated
  using (true);
