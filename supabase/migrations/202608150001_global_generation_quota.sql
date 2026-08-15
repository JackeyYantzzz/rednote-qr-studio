create table public.generation_quota (
  id text primary key check (id = 'global'),
  limit_count integer not null default 25 check (limit_count > 0),
  used_count integer not null default 0 check (
    used_count >= 0 and used_count <= limit_count
  ),
  updated_at timestamptz not null default now(),
  last_reset_at timestamptz not null default now(),
  last_reset_by text
);

insert into public.generation_quota (id, limit_count, used_count)
values ('global', 25, 0)
on conflict (id) do nothing;

alter table public.generation_quota enable row level security;

create or replace function public.reserve_global_generation()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  quota public.generation_quota%rowtype;
begin
  select *
  into quota
  from public.generation_quota
  where id = 'global'
  for update;

  if not found then
    raise exception 'Global generation quota is not configured';
  end if;

  if quota.used_count >= quota.limit_count then
    return jsonb_build_object(
      'allowed', false,
      'usedCount', quota.used_count,
      'limitCount', quota.limit_count,
      'remaining', 0,
      'locked', true,
      'updatedAt', quota.updated_at
    );
  end if;

  update public.generation_quota
  set used_count = used_count + 1,
      updated_at = now()
  where id = 'global'
  returning * into quota;

  return jsonb_build_object(
    'allowed', true,
    'usedCount', quota.used_count,
    'limitCount', quota.limit_count,
    'remaining', greatest(quota.limit_count - quota.used_count, 0),
    'locked', quota.used_count >= quota.limit_count,
    'updatedAt', quota.updated_at
  );
end;
$$;

create or replace function public.reset_global_generation(reset_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  quota public.generation_quota%rowtype;
begin
  update public.generation_quota
  set used_count = 0,
      updated_at = now(),
      last_reset_at = now(),
      last_reset_by = nullif(lower(trim(reset_email)), '')
  where id = 'global'
  returning * into quota;

  if not found then
    raise exception 'Global generation quota is not configured';
  end if;

  return jsonb_build_object(
    'allowed', true,
    'usedCount', quota.used_count,
    'limitCount', quota.limit_count,
    'remaining', quota.limit_count,
    'locked', false,
    'updatedAt', quota.updated_at,
    'lastResetAt', quota.last_reset_at,
    'lastResetBy', quota.last_reset_by
  );
end;
$$;

revoke all on table public.generation_quota from public, anon, authenticated;
revoke all on function public.reserve_global_generation() from public, anon, authenticated;
revoke all on function public.reset_global_generation(text) from public, anon, authenticated;

grant execute on function public.reserve_global_generation() to service_role;
grant execute on function public.reset_global_generation(text) to service_role;

comment on table public.generation_quota is
  'Singleton global quota. The server reserves one slot before every DeepSeek generation.';
