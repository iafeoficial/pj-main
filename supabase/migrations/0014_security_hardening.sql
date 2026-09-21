-- Endurecimento de segurança: RPCs sensíveis, search_path e cleanup de debug.

-- 1) Corrigir set_updated_at com search_path fixo.
create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- 2) Revogar EXECUTE de anon em RPCs sensíveis (manter authenticated).
revoke execute on function public.accept_invite(uuid) from anon;
revoke execute on function public.add_owner_membership() from anon;
revoke execute on function public.user_can_write(uuid) from anon;
revoke execute on function public.user_is_member(uuid) from anon;
revoke execute on function public.user_has_role(uuid, text[]) from anon;
revoke execute on function public.user_owns_empresa(uuid) from anon;

grant execute on function public.accept_invite(uuid) to authenticated;
grant execute on function public.add_owner_membership() to authenticated;
grant execute on function public.user_can_write(uuid) to authenticated;
grant execute on function public.user_is_member(uuid) to authenticated;
grant execute on function public.user_has_role(uuid, text[]) to authenticated;
grant execute on function public.user_owns_empresa(uuid) to authenticated;

-- 3) Remover funções de debug (caso ainda existam).
drop function if exists public.dbg_count_all_membros(uuid);
drop function if exists public.dbg_uid();
drop function if exists public.dbg_policies(text);

-- Nota: ativar Leaked Password Protection no dashboard Supabase Auth (Settings → Auth).
