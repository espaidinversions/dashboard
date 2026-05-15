-- Allow all authenticated users to INSERT private_entities (e.g. new vehicles).
-- UPDATE and DELETE remain superuser-only.

drop policy if exists private_entities_write_superuser on private_entities;
drop policy if exists private_entities_insert_authenticated on private_entities;
drop policy if exists private_entities_update_superuser on private_entities;
drop policy if exists private_entities_delete_superuser on private_entities;

create policy private_entities_insert_authenticated
  on private_entities for insert
  to authenticated
  with check (true);

create policy private_entities_update_superuser
  on private_entities for update
  to authenticated
  using (public.is_superuser())
  with check (public.is_superuser());

create policy private_entities_delete_superuser
  on private_entities for delete
  to authenticated
  using (public.is_superuser());
