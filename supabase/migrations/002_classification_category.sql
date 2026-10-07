alter table public.document_classifications
  add column if not exists cpcb_category text,
  add column if not exists corrected_cpcb_category text;
