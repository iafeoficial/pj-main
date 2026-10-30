-- Ao entrar (inclusive pelo link do e-mail), convites pendentes do próprio
-- e-mail viram membership automaticamente.

create or replace function public.aceitar_meus_convites_pendentes()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n int := 0;
  uemail text;
begin
  uemail := lower(auth.jwt() ->> 'email');
  if uemail is null or auth.uid() is null then
    return 0;
  end if;
  for r in
    select id, empresa_id, papel
    from public.convites
    where status = 'pendente'
      and lower(email) = uemail
  loop
    insert into public.empresa_membros (empresa_id, user_id, email, papel)
    values (r.empresa_id, auth.uid(), uemail, r.papel)
    on conflict (empresa_id, user_id) do update set papel = excluded.papel;
    update public.convites set status = 'aceito' where id = r.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.aceitar_meus_convites_pendentes() from public, anon;
grant execute on function public.aceitar_meus_convites_pendentes() to authenticated;
