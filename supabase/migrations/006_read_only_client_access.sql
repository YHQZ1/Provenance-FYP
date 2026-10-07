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

drop policy if exists "Users can update own company" on public.companies;
drop policy if exists "Users can view own company" on public.companies;
create policy "Users can view own company" on public.companies
  for select to authenticated
  using (id = auth.uid());

drop policy if exists "Users can manage own files flreew_1" on storage.objects;
drop policy if exists "Users can manage own files flreew_2" on storage.objects;
drop policy if exists "Users can manage own files flreew_3" on storage.objects;
