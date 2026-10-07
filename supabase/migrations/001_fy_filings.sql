create table if not exists public.fy_filings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  financial_year integer not null,
  status text not null default 'FINALIZED',
  snapshot jsonb not null,
  notes text,
  finalized_at timestamptz not null default now(),
  unique (company_id, financial_year)
);

alter table public.fy_filings enable row level security;
