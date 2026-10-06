-- CPCB EPR category per classified line (CATEGORY_I..CATEGORY_IV, BIODEGRADABLE).
-- EPR targets are set per category, so totals need it alongside the base polymer.
alter table public.document_classifications
  add column if not exists cpcb_category text,
  add column if not exists corrected_cpcb_category text;
