-- Convites: token para link in-app (sem e-mail) + lookup público autenticado.

alter table public.convites
  add column if not exists token uuid not null default gen_random_uuid();

create unique index if not exists idx_convites_token on public.convites(token);

-- Retorna dados mínimos do convite pendente (usuário autenticado).
create or replace function public.get_invite_by_token(p_token uuid)
returns table (
  id uuid,
  empresa_id uuid,
  email text,
  papel text,
  status text,
  empresa_nome text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    c.id,
    c.empresa_id,
    c.email,
    c.papel,
    c.status,
    coalesce(e.nome_fantasia, e.razao_social, '') as empresa_nome
  from public.convites c
  join public.empresas e on e.id = c.empresa_id
  where c.token = p_token
    and c.status = 'pendente';
end;
$$;

-- Aceita convite por token (conveniência além de accept_invite por id).
create or replace function public.accept_invite_by_token(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare c public.convites;
begin
  select * into c from public.convites where token = p_token;
  if c.id is null then raise exception 'Convite não encontrado.'; end if;
  perform public.accept_invite(c.id);
end;
$$;
