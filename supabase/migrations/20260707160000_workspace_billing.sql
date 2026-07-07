create table if not exists public.workspace_billing (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan text not null default 'free',
  status text not null default 'free',
  lifetime_access boolean not null default false,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists workspace_billing_set_updated_at on public.workspace_billing;

create trigger workspace_billing_set_updated_at
before update on public.workspace_billing
for each row execute function public.set_updated_at();

create or replace function public.create_workspace_billing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_billing (workspace_id)
  values (new.id)
  on conflict (workspace_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_workspace_created_create_billing on public.workspaces;

create trigger on_workspace_created_create_billing
after insert on public.workspaces
for each row execute function public.create_workspace_billing();

insert into public.workspace_billing (workspace_id)
select id
from public.workspaces
on conflict (workspace_id) do nothing;

alter table public.workspace_billing enable row level security;

drop policy if exists "Members can read workspace billing" on public.workspace_billing;

create policy "Members can read workspace billing"
on public.workspace_billing for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_billing.workspace_id
      and wm.user_id = auth.uid()
  )
);
