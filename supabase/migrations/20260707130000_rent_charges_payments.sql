create table if not exists public.rent_charges (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lease_id uuid not null references public.leases(id) on delete cascade,
  period_month date not null,
  rent_amount numeric(12,2) not null default 0,
  charges_amount numeric(12,2) not null default 0,
  total_due numeric(12,2) not null default 0,
  status text not null default 'unpaid',
  due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lease_id, period_month),
  constraint rent_charges_status_check check (status in ('unpaid', 'partial', 'paid', 'waived'))
);

create table if not exists public.rent_payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  rent_charge_id uuid not null references public.rent_charges(id) on delete cascade,
  paid_at date not null default current_date,
  amount numeric(12,2) not null default 0,
  payment_method text not null default 'bank_transfer',
  notes text,
  created_at timestamptz not null default now(),
  constraint rent_payments_payment_method_check check (payment_method in ('bank_transfer', 'cash', 'cheque', 'card', 'other'))
);

create index if not exists rent_charges_workspace_id_idx on public.rent_charges(workspace_id);
create index if not exists rent_charges_lease_id_idx on public.rent_charges(lease_id);
create index if not exists rent_charges_period_month_idx on public.rent_charges(period_month);
create index if not exists rent_payments_workspace_id_idx on public.rent_payments(workspace_id);
create index if not exists rent_payments_rent_charge_id_idx on public.rent_payments(rent_charge_id);

drop trigger if exists rent_charges_set_updated_at on public.rent_charges;
create trigger rent_charges_set_updated_at
before update on public.rent_charges
for each row execute function public.set_updated_at();

alter table public.rent_charges enable row level security;
alter table public.rent_payments enable row level security;

drop policy if exists "Members can manage rent charges" on public.rent_charges;
create policy "Members can manage rent charges"
on public.rent_charges for all
to authenticated
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = rent_charges.workspace_id
      and wm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = rent_charges.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Members can manage rent payments" on public.rent_payments;
create policy "Members can manage rent payments"
on public.rent_payments for all
to authenticated
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = rent_payments.workspace_id
      and wm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = rent_payments.workspace_id
      and wm.user_id = auth.uid()
  )
);
