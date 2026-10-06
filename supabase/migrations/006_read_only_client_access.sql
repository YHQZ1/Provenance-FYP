-- Writes go through the backend, which enforces the rules: finalized years are locked,
-- duplicate files are rejected, GSTINs are validated and each review records who made it.
-- The backend uses the service role key, which bypasses RLS.
--
-- Signed-in users could also write with their own token straight to the Supabase API,
-- skipping all of that, because the policies below allowed every operation on their own
-- rows (despite their "view" names). Users can now only read their own data; every change
-- has to come through the backend. The web app never writes directly, so nothing changes
-- for it.

-- Tables: replace the allow-everything policies with select-only ones.
drop policy if exists "Users can view own company documents" on public.documents;
create policy "Users can view own company documents" on public.documents
  for select to authenticated
  using (company_id = auth.uid());

drop policy if exists "Users can view own classifications" on public.document_classifications;
create policy "Users can view own classifications" on public.document_classifications
  for select to authenticated
  using (document_id in (select id from public.documents where company_id = auth.uid()));

drop policy if exists "Users can view own company materials" on public.company_materials;
create policy "Users can view own company materials" on public.company_materials
  for select to authenticated
  using (company_id = auth.uid());

drop policy if exists "Users can view own filing periods" on public.filing_periods;
create policy "Users can view own filing periods" on public.filing_periods
  for select to authenticated
  using (company_id = auth.uid());

-- Company details are validated by the backend on save (GSTIN, EPR number, PIBO category).
drop policy if exists "Users can update own company" on public.companies;
drop policy if exists "Users can view own company" on public.companies;
create policy "Users can view own company" on public.companies
  for select to authenticated
  using (id = auth.uid());

-- Stored files are evidence for a filing; only the backend may add, replace or remove them.
drop policy if exists "Users can manage own files flreew_1" on storage.objects;
drop policy if exists "Users can manage own files flreew_2" on storage.objects;
drop policy if exists "Users can manage own files flreew_3" on storage.objects;
