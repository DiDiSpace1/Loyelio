create table if not exists public.rent_reminder_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lease_id uuid not null references public.leases(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete set null,
  reminder_type text not null default 'rent_due',
  reminder_month date not null,
  due_date date not null,
  scheduled_for date not null,
  email_to text,
  status text not null default 'sent',
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rent_reminder_logs_status_check check (status in ('sent', 'failed'))
);

create unique index if not exists rent_reminder_logs_once_per_month_idx
  on public.rent_reminder_logs(lease_id, reminder_month, reminder_type);

create index if not exists rent_reminder_logs_workspace_id_idx
  on public.rent_reminder_logs(workspace_id);

create index if not exists rent_reminder_logs_scheduled_for_idx
  on public.rent_reminder_logs(scheduled_for);

drop trigger if exists rent_reminder_logs_set_updated_at on public.rent_reminder_logs;

create trigger rent_reminder_logs_set_updated_at
before update on public.rent_reminder_logs
for each row execute function public.set_updated_at();

alter table public.rent_reminder_logs enable row level security;

drop policy if exists "Members can read rent reminder logs" on public.rent_reminder_logs;

create policy "Members can read rent reminder logs"
on public.rent_reminder_logs for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = rent_reminder_logs.workspace_id
      and wm.user_id = auth.uid()
  )
);
