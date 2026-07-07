insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create table if not exists public.tax_categories (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  tax_regime text not null,
  code text not null,
  label text not null,
  description text,
  sort_order int not null default 0,
  active boolean not null default true,
  unique (country_code, tax_regime, code)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  tenant_id uuid references public.tenants(id) on delete set null,
  document_type text not null default 'other',
  period_month date,
  file_name text not null,
  file_path text not null,
  mime_type text,
  size_bytes bigint,
  extracted_date date,
  extracted_vendor text,
  extracted_amount numeric(12,2),
  ocr_status text not null default 'not_started',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_document_type_check check (document_type in ('lease', 'rent_receipt', 'invoice', 'insurance', 'tax', 'other')),
  constraint documents_ocr_status_check check (ocr_status in ('not_started', 'processing', 'done', 'failed'))
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  tax_category_id uuid references public.tax_categories(id) on delete set null,
  expense_date date not null,
  vendor text,
  amount numeric(12,2) not null default 0,
  currency text not null default 'EUR',
  description text,
  document_id uuid references public.documents(id) on delete set null,
  receipt_status text not null default 'missing',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_receipt_status_check check (receipt_status in ('attached', 'missing', 'not_needed'))
);

create index if not exists tax_categories_country_regime_idx on public.tax_categories(country_code, tax_regime);
create index if not exists documents_workspace_id_idx on public.documents(workspace_id);
create index if not exists documents_property_id_idx on public.documents(property_id);
create index if not exists documents_created_at_idx on public.documents(created_at);
create index if not exists expenses_workspace_id_idx on public.expenses(workspace_id);
create index if not exists expenses_property_id_idx on public.expenses(property_id);
create index if not exists expenses_expense_date_idx on public.expenses(expense_date);

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

insert into public.tax_categories (country_code, tax_regime, code, label, description, sort_order)
values
  ('FR', 'LMNP', 'repairs', 'Travaux et reparations', 'Travaux, entretien et reparations du logement.', 10),
  ('FR', 'LMNP', 'insurance', 'Assurance', 'Assurance PNO et assurances liees au bien.', 20),
  ('FR', 'LMNP', 'condo_fees', 'Charges de copropriete', 'Charges de copropriete recuperables ou non selon votre suivi.', 30),
  ('FR', 'LMNP', 'loan_interest', 'Interets emprunt', 'Interets et frais de financement.', 40),
  ('FR', 'LMNP', 'management_fees', 'Frais de gestion', 'Frais d agence, comptable, logiciels et gestion.', 50),
  ('FR', 'LMNP', 'property_tax', 'Taxe fonciere', 'Taxe fonciere et taxes liees au bien.', 60),
  ('FR', 'LMNP', 'furniture', 'Mobilier et equipement', 'Meubles, equipements et remplacement.', 70),
  ('FR', 'LMNP', 'subscriptions', 'Services et abonnements', 'Services utilises pour la location.', 80),
  ('FR', 'LMNP', 'other', 'Autres frais', 'Categorie temporaire a verifier.', 90)
on conflict (country_code, tax_regime, code) do update
set label = excluded.label,
    description = excluded.description,
    sort_order = excluded.sort_order,
    active = true;

alter table public.tax_categories enable row level security;
alter table public.documents enable row level security;
alter table public.expenses enable row level security;

drop policy if exists "Authenticated users can read active tax categories" on public.tax_categories;
create policy "Authenticated users can read active tax categories"
on public.tax_categories for select
to authenticated
using (active = true);

drop policy if exists "Members can manage documents" on public.documents;
create policy "Members can manage documents"
on public.documents for all
to authenticated
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = documents.workspace_id
      and wm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = documents.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Members can manage expenses" on public.expenses;
create policy "Members can manage expenses"
on public.expenses for all
to authenticated
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = expenses.workspace_id
      and wm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = expenses.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Members can read document files" on storage.objects;
create policy "Members can read document files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'documents'
  and exists (
    select 1
    from public.workspace_members wm
    where wm.user_id = auth.uid()
      and name like 'workspace/' || wm.workspace_id::text || '/%'
  )
);

drop policy if exists "Members can upload document files" on storage.objects;
create policy "Members can upload document files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'documents'
  and exists (
    select 1
    from public.workspace_members wm
    where wm.user_id = auth.uid()
      and name like 'workspace/' || wm.workspace_id::text || '/%'
  )
);
