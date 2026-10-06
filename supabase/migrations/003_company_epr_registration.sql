-- CPCB EPR registration number issued to the PIBO on the centralized EPR portal.
-- Shown on filings and exports next to the GSTIN.
alter table public.companies
  add column if not exists epr_registration_number text;
