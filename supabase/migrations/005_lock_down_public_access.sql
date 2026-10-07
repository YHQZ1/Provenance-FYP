alter table public.companies enable row level security;

drop policy if exists "Users can view own company" on public.companies;
create policy "Users can view own company" on public.companies
  for select using (id = auth.uid());

drop policy if exists "Users can update own company" on public.companies;
create policy "Users can update own company" on public.companies
  for update using (id = auth.uid()) with check (id = auth.uid());

alter view public.dashboard_summary set (security_invoker = on);
