-- The anon key ships in the frontend, so anything it can read is public. Two gaps:
--
-- 1. companies had no row level security, so the anon key could list every company's
--    email, GSTIN and EPR number. Users may now see and edit only their own row.
-- 2. dashboard_summary ran with its owner's rights, which skip the RLS on documents,
--    so it exposed every company's document summaries. It now runs as the caller.
--
-- The backend uses the service role key and is unaffected. Sign-up still works because
-- handle_new_user() is security definer.

alter table public.companies enable row level security;

drop policy if exists "Users can view own company" on public.companies;
create policy "Users can view own company" on public.companies
  for select using (id = auth.uid());

drop policy if exists "Users can update own company" on public.companies;
create policy "Users can update own company" on public.companies
  for update using (id = auth.uid()) with check (id = auth.uid());

alter view public.dashboard_summary set (security_invoker = on);
