create or replace function public.dbg_uid()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(auth.uid()::text, 'NULL');
$$;
