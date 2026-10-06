-- Who signed off each line, for the audit trail. The name is stored as it was at the time of
-- review so later profile changes don't rewrite history.
alter table public.document_classifications
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null,
  add column if not exists reviewed_by_name text,
  add column if not exists reviewed_at timestamptz;

-- The upload check looks for an existing file with the same hash, but two identical uploads
-- arriving together can both pass it. The index makes the database the final word.
create unique index if not exists documents_company_file_hash_key
  on public.documents (company_id, (extracted_data ->> 'file_hash'))
  where extracted_data ->> 'file_hash' is not null;
