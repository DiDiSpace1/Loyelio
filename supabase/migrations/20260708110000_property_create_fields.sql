alter table public.properties
  add column if not exists property_type text not null default 'apartment',
  add column if not exists surface_area numeric(10,2),
  add column if not exists monthly_rent_estimate numeric(12,2),
  add column if not exists charges_estimate numeric(12,2),
  add column if not exists deposit_estimate numeric(12,2),
  add column if not exists occupancy_status text not null default 'vacant';

alter table public.properties
  drop constraint if exists properties_property_type_check,
  add constraint properties_property_type_check
  check (property_type in ('studio', 't1', 't2', 't3', 't4', 'house', 'room', 'apartment', 'other'));

alter table public.properties
  drop constraint if exists properties_occupancy_status_check,
  add constraint properties_occupancy_status_check
  check (occupancy_status in ('vacant', 'rented'));
