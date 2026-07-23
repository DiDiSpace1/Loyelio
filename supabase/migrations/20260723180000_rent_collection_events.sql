create table if not exists public.rent_collection_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lease_id uuid not null references public.leases(id) on delete cascade,
  rent_charge_id uuid references public.rent_charges(id) on delete set null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  period_month date not null,
  source text not null default 'single',
  previous_status text,
  new_status text not null,
  amount_before numeric(12,2) not null default 0,
  amount_after numeric(12,2) not null default 0,
  payment_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint rent_collection_events_source_check check (source in ('batch', 'single', 'tenant')),
  constraint rent_collection_events_status_check check (new_status in ('paid', 'partial', 'unpaid')),
  constraint rent_collection_events_previous_status_check check (previous_status is null or previous_status in ('paid', 'partial', 'unpaid'))
);

create index if not exists rent_collection_events_workspace_created_idx
  on public.rent_collection_events(workspace_id, created_at desc);

create index if not exists rent_collection_events_lease_month_idx
  on public.rent_collection_events(lease_id, period_month);

alter table public.rent_collection_events enable row level security;

drop policy if exists "Members can read rent collection events" on public.rent_collection_events;

create policy "Members can read rent collection events"
on public.rent_collection_events for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = rent_collection_events.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Members can create rent collection events" on public.rent_collection_events;

create policy "Members can create rent collection events"
on public.rent_collection_events for insert
to authenticated
with check (
  actor_user_id = auth.uid()
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = rent_collection_events.workspace_id
      and wm.user_id = auth.uid()
  )
);
