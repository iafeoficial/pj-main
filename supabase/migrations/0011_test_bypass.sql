create or replace function public.dbg_count_all_membros(p_empresa_id uuid)
returns int language sql security definer set search_path = public as $$
  select count(*)::int from public.empresa_membros where empresa_id = p_empresa_id;
$$;
