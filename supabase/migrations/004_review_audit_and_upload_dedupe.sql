alter table public.document_classifications
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null,
  add column if not exists reviewed_by_name text,
  add column if not exists reviewed_at timestamptz;

create unique index if not exists documents_company_file_hash_key
  on public.documents (company_id, (extracted_data ->> 'file_hash'))
  where extracted_data ->> 'file_hash' is not null;
