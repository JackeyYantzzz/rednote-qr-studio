alter table public.campaigns
  add column fast_publish_enabled boolean not null default false,
  add column fast_publish_images jsonb not null default '[]'::jsonb,
  add column fast_publish_content jsonb;

alter table public.campaigns
  add constraint campaigns_fast_publish_images_array
    check (jsonb_typeof(fast_publish_images) = 'array'),
  add constraint campaigns_fast_publish_content_object
    check (
      fast_publish_content is null
      or jsonb_typeof(fast_publish_content) = 'object'
    );

create table public.fast_publish_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  event_name text not null check (
    event_name in (
      'fast_page_view',
      'fast_share_clicked',
      'fast_share_completed',
      'fast_share_cancelled',
      'fast_share_failed'
    )
  ),
  session_id uuid not null,
  created_at timestamptz not null default now()
);

create index fast_publish_events_campaign_created_idx
  on public.fast_publish_events (campaign_id, created_at desc);

alter table public.fast_publish_events enable row level security;

create policy "admins view fast publish events"
on public.fast_publish_events for select
to authenticated
using (public.is_admin());

comment on table public.fast_publish_events is
  'Anonymous fast publish handoff analytics. These events never claim that a Xiaohongshu post was published.';
