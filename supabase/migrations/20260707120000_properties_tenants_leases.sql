create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  country_code text not null default 'FR',
  rental_mode text not null default 'shared_rooms',
  tax_regime text not null default 'LMNP',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint properties_rental_mode_check check (rental_mode in ('entire_place', 'shared_rooms', 'mixed'))
);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null,
  unit_type text not null default 'room',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint units_unit_type_check check (unit_type in ('room', 'apartment', 'other'))
);

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  start_date date not null,
  end_date date,
  monthly_rent numeric(12,2) not null default 0,
  charges_amount numeric(12,2) not null default 0,
  deposit_amount numeric(12,2) not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leases_status_check check (status in ('active', 'ended', 'draft'))
);

create index if not exists properties_workspace_id_idx on public.properties(workspace_id);
create index if not exists units_workspace_id_idx on public.units(workspace_id);
create index if not exists units_property_id_idx on public.units(property_id);
create index if not exists tenants_workspace_id_idx on public.tenants(workspace_id);
create index if not exists leases_workspace_id_idx on public.leases(workspace_id);
create index if not exists leases_property_id_idx on public.leases(property_id);
create index if not exists leases_tenant_id_idx on public.leases(tenant_id);

drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at
before update on public.properties
for each row execute function public.set_updated_at();

drop trigger if exists units_set_updated_at on public.units;
create trigger units_set_updated_at
before update on public.units
for each row execute function public.set_updated_at();

drop trigger if exists tenants_set_updated_at on public.tenants;
create trigger tenants_set_updated_at
before update on public.tenants
for each row execute function public.set_updated_at();

drop trigger if exists leases_set_updated_at on public.leases;
create trigger leases_set_updated_at
before update on public.leases
for each row execute function public.set_updated_at();

alter table public.properties enable row level security;
alter table public.units enable row level security;
alter table public.tenants enable row level security;
alter table public.leases enable row level security;

drop policy if exists "Members can read properties" on public.properties;
create policy "Members can read properties"
on public.properties for select
to authenticated
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = properties.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Members can insert properties" on public.properties;
create policy "Members can insert properties"
on public.properties for insert
to authenticated
with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = properties.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Members can update properties" on public.properties;
create policy "Members can update properties"
on public.properties for update
to authenticated
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = properties.workspace_id
      and wm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = properties.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Members can manage units" on public.units;
create policy "Members can manage units"
on public.units for all
to authenticated
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = units.workspace_id
      and wm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = units.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Members can manage tenants" on public.tenants;
create policy "Members can manage tenants"
on public.tenants for all
to authenticated
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = tenants.workspace_id
      and wm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = tenants.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Members can manage leases" on public.leases;
create policy "Members can manage leases"
on public.leases for all
to authenticated
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = leases.workspace_id
      and wm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = leases.workspace_id
      and wm.user_id = auth.uid()
  )
);
