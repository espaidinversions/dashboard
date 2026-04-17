-- Migration: role trust boundary hardening and shared API rate limiting
-- 2026-04-14

create or replace function public.current_app_role()
returns text
language sql
stable
as $$
  select coalesce(
    auth.jwt() -> 'app_metadata' ->> 'role',
    'user'
  )
$$;

create table if not exists public.api_rate_limits (
  bucket text not null,
  subject text not null,
  count integer not null default 0,
  reset_at timestamptz not null,
  primary key (bucket, subject)
);

alter table public.api_rate_limits enable row level security;

create or replace function public.take_rate_limit(
  p_bucket text,
  p_subject text,
  p_window_ms integer,
  p_max_requests integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_reset_at timestamptz;
  v_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Forbidden';
  end if;

  if coalesce(length(trim(p_bucket)), 0) = 0 then
    raise exception 'Bucket required';
  end if;
  if coalesce(length(trim(p_subject)), 0) = 0 then
    raise exception 'Subject required';
  end if;
  if p_window_ms < 1000 then
    raise exception 'Invalid window';
  end if;
  if p_max_requests < 1 then
    raise exception 'Invalid max requests';
  end if;

  delete from public.api_rate_limits
  where reset_at <= v_now
    and bucket = p_bucket
    and subject = p_subject;

  insert into public.api_rate_limits (bucket, subject, count, reset_at)
  values (
    p_bucket,
    p_subject,
    1,
    v_now + make_interval(secs => p_window_ms / 1000.0)
  )
  on conflict (bucket, subject) do update
  set count = case
        when public.api_rate_limits.reset_at <= v_now then 1
        else public.api_rate_limits.count + 1
      end,
      reset_at = case
        when public.api_rate_limits.reset_at <= v_now then v_now + make_interval(secs => p_window_ms / 1000.0)
        else public.api_rate_limits.reset_at
      end
  returning count, reset_at into v_count, v_reset_at;

  return jsonb_build_object(
    'limited', v_count > p_max_requests,
    'limit', p_max_requests,
    'remaining', greatest(p_max_requests - least(v_count, p_max_requests), 0),
    'retry_after_sec', greatest(ceil(extract(epoch from (v_reset_at - v_now)))::integer, 1),
    'reset_at', v_reset_at
  );
end;
$$;

revoke all on function public.take_rate_limit(text, text, integer, integer) from public;
grant execute on function public.take_rate_limit(text, text, integer, integer) to service_role;
