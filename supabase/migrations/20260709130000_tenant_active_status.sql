alter table public.tenants
add column if not exists is_active boolean not null default true;

create index if not exists tenants_workspace_active_idx on public.tenants(workspace_id, is_active);
