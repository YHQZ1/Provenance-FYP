-- Three workspace features, all written only by the backend (service role) and readable by
-- each company for its own rows, in line with 006.
--
-- 1. activity_events: the audit trail. Who uploaded, reviewed, deleted, finalized or changed
--    what, and when. Rows are never updated or deleted by the app, and they outlive the
--    documents they mention, so document_id is deliberately not a foreign key.
-- 2. epr_obligation_inputs: the figures an obligation needs that documents don't provide
--    (pre-consumer waste, quantities supplied to other registered entities) and any target
--    or compensation rate the company sets instead of the defaults.
-- 3. company_trade_names: a company's own trade names for materials, matched against invoice
--    lines before the classifier runs.

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  actor_id uuid,
  actor_name text,
  action text not null,
  summary text not null,
  document_id uuid,
  financial_year integer,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_events_company_created_idx
  on public.activity_events (company_id, created_at desc);

create table if not exists public.epr_obligation_inputs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  financial_year integer not null,
  category text not null,
  pre_consumer_kg numeric(15, 3),
  supplied_kg numeric(15, 3),
  epr_target_pct numeric(5, 2),
  recycling_min_pct numeric(5, 2),
  ec_rate_per_kg numeric(12, 2),
  updated_by_name text,
  updated_at timestamptz not null default now(),
  unique (company_id, financial_year, category)
);

create table if not exists public.company_trade_names (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  trade_name text not null,
  material_code varchar(10) not null references public.materials_master (material_code),
  cpcb_category text,
  notes text,
  created_by_name text,
  created_at timestamptz not null default now()
);

create unique index if not exists company_trade_names_company_name_key
  on public.company_trade_names (company_id, lower(trade_name));

alter table public.activity_events enable row level security;
alter table public.epr_obligation_inputs enable row level security;
alter table public.company_trade_names enable row level security;

drop policy if exists "Users can view own activity" on public.activity_events;
create policy "Users can view own activity" on public.activity_events
  for select to authenticated using (company_id = auth.uid());

drop policy if exists "Users can view own obligation inputs" on public.epr_obligation_inputs;
create policy "Users can view own obligation inputs" on public.epr_obligation_inputs
  for select to authenticated using (company_id = auth.uid());

drop policy if exists "Users can view own trade names" on public.company_trade_names;
create policy "Users can view own trade names" on public.company_trade_names
  for select to authenticated using (company_id = auth.uid());

-- Backfill the trail from what's already recorded, once. Uploads have no recorded uploader, so
-- the account's email stands in; review decisions use the reviewer stamp from 004 where it exists.
-- A document's financial year follows the app's rule: invoice date, else upload date, April to March.
insert into public.activity_events
  (company_id, actor_id, actor_name, action, summary, document_id, financial_year, details, created_at)
select *
from (
  select
    d.company_id,
    d.company_id,
    c.email_id,
    'document.uploaded',
    'uploaded ' || d.filename,
    d.id,
    (
      select extract(year from day)::int - case when extract(month from day) < 4 then 1 else 0 end
      from (
        select case
          when d.extracted_data ->> 'document_date' ~ '^\d{4}-\d{2}-\d{2}'
            then (d.extracted_data ->> 'document_date')::date
          else d.created_at::date
        end as day
      ) as dated
    ),
    jsonb_build_object('filename', d.filename, 'backfilled', true),
    d.created_at
  from public.documents d
  join public.companies c on c.id = d.company_id

  union all

  select
    d.company_id,
    coalesce(dc.reviewed_by, d.company_id),
    coalesce(dc.reviewed_by_name, c.email_id),
    case
      when dc.material_code is null and dc.corrected_material_code is null then 'line.excluded'
      when dc.corrected_material_code is not null then 'line.corrected'
      else 'line.approved'
    end,
    case
      when dc.material_code is null and dc.corrected_material_code is null
        then 'excluded a line on ' || d.filename
      when dc.corrected_material_code is not null
        then 'corrected a line to ' || dc.corrected_material_code || ' on ' || d.filename
      else 'approved ' || coalesce(dc.material_code, 'a line') || ' on ' || d.filename
    end,
    d.id,
    (
      select extract(year from day)::int - case when extract(month from day) < 4 then 1 else 0 end
      from (
        select case
          when d.extracted_data ->> 'document_date' ~ '^\d{4}-\d{2}-\d{2}'
            then (d.extracted_data ->> 'document_date')::date
          else d.created_at::date
        end as day
      ) as dated
    ),
    jsonb_build_object(
      'filename', d.filename,
      'line', dc.matched_synonym,
      'material_code', coalesce(dc.corrected_material_code, dc.material_code),
      'quantity_kg', coalesce(dc.corrected_quantity_kg, dc.quantity_kg),
      'backfilled', true
    ),
    coalesce(dc.reviewed_at, dc.updated_at, dc.created_at)
  from public.document_classifications dc
  join public.documents d on d.id = dc.document_id
  join public.companies c on c.id = d.company_id
  where dc.verified_by_user

  union all

  select
    f.company_id,
    f.company_id,
    c.email_id,
    'filing.finalized',
    'finalized FY ' || f.financial_year || '-' || right((f.financial_year + 1)::text, 2),
    null::uuid,
    f.financial_year,
    jsonb_build_object('backfilled', true),
    f.finalized_at
  from public.fy_filings f
  join public.companies c on c.id = f.company_id
) as history
where not exists (select 1 from public.activity_events);
