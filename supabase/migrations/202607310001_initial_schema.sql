create extension if not exists pgcrypto;

create type public.campaign_status as enum ('active', 'inactive');
create type public.publish_job_status as enum (
  'pending',
  'approved',
  'preparing',
  'publishing',
  'published',
  'failed',
  'cancelled'
);
create type public.publish_visibility as enum ('private', 'public');

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 100),
  brand_name text not null check (char_length(brand_name) between 1 and 100),
  product_name text not null check (char_length(product_name) between 1 and 120),
  product_description text not null default '' check (char_length(product_description) <= 2000),
  brand_guide text not null default '' check (char_length(brand_guide) <= 2000),
  default_tone text not null default '自然、真诚、简洁' check (char_length(default_tone) <= 120),
  default_keywords text[] not null default '{}',
  prohibited_phrases text[] not null default '{}',
  allowed_post_types text[] not null default array['真实体验', '产品推荐', '空间灵感'],
  max_image_count integer not null default 9 check (max_image_count between 1 and 12),
  status public.campaign_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  file_url text not null,
  storage_path text not null unique,
  thumbnail_url text,
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  category text not null default '' check (char_length(category) <= 80),
  keywords text[] not null default '{}',
  sort_order integer not null default 0 check (sort_order between 0 and 9999),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.generations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  selected_asset_ids uuid[] not null check (cardinality(selected_asset_ids) between 1 and 12),
  user_input jsonb not null,
  generated_content jsonb not null,
  edited_content jsonb,
  created_at timestamptz not null default now()
);

create table public.publish_jobs (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations(id) on delete restrict,
  status public.publish_job_status not null default 'pending',
  title text not null check (char_length(title) between 1 and 20),
  content text not null check (char_length(content) between 1 and 1000),
  tags text[] not null default '{}',
  image_urls text[] not null check (cardinality(image_urls) between 1 and 12),
  visibility public.publish_visibility not null default 'private',
  schedule_at timestamptz,
  is_original boolean not null default true,
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  result jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index assets_campaign_sort_idx
  on public.assets (campaign_id, is_active, sort_order);
create index generations_campaign_created_idx
  on public.generations (campaign_id, created_at desc);
create index publish_jobs_queue_idx
  on public.publish_jobs (status, created_at)
  where status in ('approved', 'failed');
create unique index publish_jobs_no_duplicate_active_idx
  on public.publish_jobs (generation_id)
  where status <> 'cancelled';

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger campaigns_touch_updated_at
before update on public.campaigns
for each row execute function public.touch_updated_at();

create trigger assets_touch_updated_at
before update on public.assets
for each row execute function public.touch_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.admins enable row level security;
alter table public.campaigns enable row level security;
alter table public.assets enable row level security;
alter table public.generations enable row level security;
alter table public.publish_jobs enable row level security;

create policy "admins can view own membership"
on public.admins for select
to authenticated
using (user_id = auth.uid());

create policy "public can view active campaigns"
on public.campaigns for select
to anon, authenticated
using (status = 'active');

create policy "admins manage campaigns"
on public.campaigns for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "public can view active campaign assets"
on public.assets for select
to anon, authenticated
using (
  is_active
  and exists (
    select 1
    from public.campaigns
    where campaigns.id = assets.campaign_id
      and campaigns.status = 'active'
  )
);

create policy "admins manage assets"
on public.assets for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins view generations"
on public.generations for select
to authenticated
using (public.is_admin());

create policy "admins manage publish jobs"
on public.publish_jobs for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'campaign-assets',
  'campaign-assets',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "public reads campaign assets"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'campaign-assets');

create policy "admins upload campaign assets"
on storage.objects for insert
to authenticated
with check (bucket_id = 'campaign-assets' and public.is_admin());

create policy "admins update campaign assets"
on storage.objects for update
to authenticated
using (bucket_id = 'campaign-assets' and public.is_admin())
with check (bucket_id = 'campaign-assets' and public.is_admin());

create policy "admins delete campaign assets"
on storage.objects for delete
to authenticated
using (bucket_id = 'campaign-assets' and public.is_admin());

create or replace function public.claim_publish_job(max_attempts integer default 3)
returns setof public.publish_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with next_job as (
    select id
    from public.publish_jobs
    where status in ('approved', 'failed')
      and attempt_count < greatest(1, least(max_attempts, 10))
      and (schedule_at is null or schedule_at <= now())
    order by created_at
    for update skip locked
    limit 1
  )
  update public.publish_jobs as job
  set status = 'preparing',
      started_at = now(),
      attempt_count = attempt_count + 1,
      error_message = null
  from next_job
  where job.id = next_job.id
  returning job.*;
end;
$$;

revoke all on function public.claim_publish_job(integer) from public, anon, authenticated;
grant execute on function public.claim_publish_job(integer) to service_role;

comment on table public.publish_jobs is
  'Only the local Windows worker with the Supabase service role may claim approved jobs.';
