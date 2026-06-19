create or replace function public.dbg_policies(p_table text)
returns table(policyname text, cmd text, qual text, withcheck text)
language sql security definer set search_path = public as $$
  select policyname::text, cmd::text, qual::text, with_check::text
  from pg_policies where schemaname='public' and tablename = p_table;
$$;
