insert into storage.buckets (id, name, public)
values ('property-photos', 'property-photos', false)
on conflict (id) do nothing;

create table if not exists public.property_photos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  file_name text not null,
  file_path text not null unique,
  mime_type text,
  size_bytes bigint,
  sort_order int not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists property_photos_workspace_id_idx on public.property_photos(workspace_id);
create index if not exists property_photos_property_id_idx on public.property_photos(property_id);

alter table public.property_photos enable row level security;

drop policy if exists "Members can manage property photos" on public.property_photos;
create policy "Members can manage property photos"
on public.property_photos for all
to authenticated
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = property_photos.workspace_id
      and wm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = property_photos.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Members can read property photo files" on storage.objects;
create policy "Members can read property photo files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'property-photos'
  and exists (
    select 1
    from public.workspace_members wm
    where wm.user_id = auth.uid()
      and name like 'workspace/' || wm.workspace_id::text || '/%'
  )
);

drop policy if exists "Members can upload property photo files" on storage.objects;
create policy "Members can upload property photo files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'property-photos'
  and exists (
    select 1
    from public.workspace_members wm
    where wm.user_id = auth.uid()
      and name like 'workspace/' || wm.workspace_id::text || '/%'
  )
);

drop policy if exists "Members can delete property photo files" on storage.objects;
create policy "Members can delete property photo files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'property-photos'
  and exists (
    select 1
    from public.workspace_members wm
    where wm.user_id = auth.uid()
      and name like 'workspace/' || wm.workspace_id::text || '/%'
  )
);
