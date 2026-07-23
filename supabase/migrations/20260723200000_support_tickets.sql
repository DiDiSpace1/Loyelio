create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  plan text not null,
  category text not null,
  subject text not null,
  message text not null,
  status text not null default 'open',
  notification_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_tickets_plan_check check (plan in ('plus', 'portfolio')),
  constraint support_tickets_category_check check (category in ('technical', 'billing', 'documents', 'tax', 'other')),
  constraint support_tickets_status_check check (status in ('open', 'in_progress', 'resolved', 'closed')),
  constraint support_tickets_notification_check check (notification_status in ('pending', 'sent', 'failed'))
);

create index if not exists support_tickets_workspace_created_idx
  on public.support_tickets(workspace_id, created_at desc);

alter table public.support_tickets enable row level security;

drop policy if exists "Members can read support tickets" on public.support_tickets;
create policy "Members can read support tickets"
on public.support_tickets for select
to authenticated
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = support_tickets.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Members can create support tickets" on public.support_tickets;
create policy "Members can create support tickets"
on public.support_tickets for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = support_tickets.workspace_id
      and wm.user_id = auth.uid()
  )
);
