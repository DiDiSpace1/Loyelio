alter table public.units
  add column if not exists monthly_rent_estimate numeric(12,2),
  add column if not exists charges_estimate numeric(12,2),
  add column if not exists deposit_estimate numeric(12,2);
