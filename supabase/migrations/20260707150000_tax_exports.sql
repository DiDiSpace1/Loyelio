create table if not exists public.tax_exports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  year int not null,
  country_code text not null default 'FR',
  tax_regime text not null default 'LMNP',
  status text not null default 'ready',
  file_path text,
  created_at timestamptz not null default now(),
  constraint tax_exports_status_check check (status in ('processing', 'ready', 'failed'))
);

create index if not exists tax_exports_workspace_id_idx on public.tax_exports(workspace_id);
create index if not exists tax_exports_year_idx on public.tax_exports(year);

alter table public.tax_exports enable row level security;

drop policy if exists "Members can read tax exports" on public.tax_exports;
create policy "Members can read tax exports"
on public.tax_exports for select
to authenticated
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = tax_exports.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Members can create tax exports" on public.tax_exports;
create policy "Members can create tax exports"
on public.tax_exports for insert
to authenticated
with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = tax_exports.workspace_id
      and wm.user_id = auth.uid()
  )
);
