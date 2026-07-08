drop policy if exists "Members can delete properties" on public.properties;

create policy "Members can delete properties"
on public.properties for delete
to authenticated
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = properties.workspace_id
      and wm.user_id = auth.uid()
  )
);
