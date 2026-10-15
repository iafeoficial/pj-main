-- E-mail @iafeoficial.com entra na empresa IAFE TECNOLOGIA como administrador.
-- Cobre quem já existe (backfill) e quem se cadastrar depois (trigger).

create or replace function public.vincular_email_iafe(p_user_id uuid, p_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(p_email, ''));
  v_empresa uuid;
begin
  if p_user_id is null or v_email !~ '@iafeoficial\.com$' then
    return null;
  end if;

  select e.id into v_empresa
  from public.empresas e
  where e.razao_social = 'IAFE TECNOLOGIA LTDA'
  order by e.created_at
  limit 1;

  if v_empresa is null then
    return null;
  end if;

  insert into public.empresa_membros (empresa_id, user_id, email, papel)
  values (v_empresa, p_user_id, v_email, 'administrador')
  on conflict (empresa_id, user_id) do nothing;

  return v_empresa;
end;
$$;

create or replace function public.vincular_email_iafe_atual()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.vincular_email_iafe(auth.uid(), auth.jwt() ->> 'email');
end;
$$;

create or replace function public.vincular_iafe_ao_criar_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.vincular_email_iafe(new.id, new.email);
  return new;
end;
$$;

drop trigger if exists trg_vincular_iafe_usuario on auth.users;
create trigger trg_vincular_iafe_usuario
  after insert on auth.users
  for each row
  execute function public.vincular_iafe_ao_criar_usuario();

revoke all on function public.vincular_email_iafe(uuid, text) from public;
revoke all on function public.vincular_email_iafe_atual() from public;
revoke all on function public.vincular_iafe_ao_criar_usuario() from public;
revoke all on function public.vincular_email_iafe(uuid, text) from anon;
revoke all on function public.vincular_email_iafe_atual() from anon;
revoke all on function public.vincular_iafe_ao_criar_usuario() from anon;

grant execute on function public.vincular_email_iafe_atual() to authenticated;

insert into public.empresa_membros (empresa_id, user_id, email, papel)
select e.id, u.id, lower(u.email), 'administrador'
from auth.users u
join public.empresas e on e.razao_social = 'IAFE TECNOLOGIA LTDA'
where lower(u.email) ~ '@iafeoficial\.com$'
on conflict (empresa_id, user_id) do nothing;
