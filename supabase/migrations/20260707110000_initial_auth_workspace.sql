create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  default_workspace_id uuid,
  locale text not null default 'fr',
  country_code text not null default 'FR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country_code text not null default 'FR',
  tax_regime text not null default 'LMNP',
  currency text not null default 'EUR',
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_default_workspace_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_default_workspace_id_fkey
      foreign key (default_workspace_id)
      references public.workspaces(id)
      on delete set null;
  end if;
end;
$$;

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists workspace_members_user_id_idx
  on public.workspace_members(user_id);

create index if not exists workspace_members_workspace_id_idx
  on public.workspace_members(workspace_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists workspaces_set_updated_at on public.workspaces;

create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
  selected_country text;
  selected_locale text;
begin
  selected_country := coalesce(new.raw_user_meta_data ->> 'country_code', 'FR');
  selected_locale := coalesce(new.raw_user_meta_data ->> 'locale', 'fr');

  insert into public.profiles (id, email, full_name, locale, country_code)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    selected_locale,
    selected_country
  );

  insert into public.workspaces (name, country_code, tax_regime, currency, created_by)
  values ('Mon espace bailleur', selected_country, 'LMNP', 'EUR', new.id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  update public.profiles
  set default_workspace_id = new_workspace_id
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;

create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "Users can update their own profile" on public.profiles;

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Members can read their workspaces" on public.workspaces;

create policy "Members can read their workspaces"
on public.workspaces for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspaces.id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Owners can update their workspaces" on public.workspaces;

create policy "Owners can update their workspaces"
on public.workspaces for update
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspaces.id
      and wm.user_id = auth.uid()
      and wm.role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspaces.id
      and wm.user_id = auth.uid()
      and wm.role = 'owner'
  )
);

drop policy if exists "Members can read workspace memberships" on public.workspace_members;

create policy "Members can read workspace memberships"
on public.workspace_members for select
to authenticated
using (user_id = auth.uid());
