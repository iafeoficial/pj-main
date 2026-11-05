-- Período de acesso e bloqueio (empresa + usuário). Painel IAFÉ (@iafeoficial.com).

-- ---- Empresas: vigência ----
alter table public.empresas
  add column if not exists acesso_inicio timestamptz,
  add column if not exists acesso_fim timestamptz,
  add column if not exists acesso_bloqueado boolean not null default false,
  add column if not exists acesso_motivo text;

-- Novas empresas: 30 dias grátis se o cliente não informar fim.
create or replace function public.empresas_default_acesso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.acesso_inicio is null then
    new.acesso_inicio := now();
  end if;
  if new.acesso_fim is null and tg_op = 'INSERT' then
    new.acesso_fim := now() + interval '30 days';
  end if;
  if new.acesso_bloqueado is null then
    new.acesso_bloqueado := false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_empresas_default_acesso on public.empresas;
create trigger trg_empresas_default_acesso
  before insert on public.empresas
  for each row execute function public.empresas_default_acesso();

-- Empresa liberada? (não bloqueada manualmente e dentro do prazo, se houver fim)
create or replace function public.empresa_acesso_ok(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.empresas e
    where e.id = p_empresa_id
      and coalesce(e.acesso_bloqueado, false) = false
      and (e.acesso_fim is null or e.acesso_fim >= now())
  );
$$;

revoke all on function public.empresa_acesso_ok(uuid) from public, anon;
grant execute on function public.empresa_acesso_ok(uuid) to authenticated;

-- Escrita só com membership operacional E empresa liberada
create or replace function public.user_can_write(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.empresa_acesso_ok(p_empresa_id)
    and exists (
      select 1 from public.empresa_membros m
      where m.empresa_id = p_empresa_id
        and m.user_id = auth.uid()
        and m.papel in ('administrador','financeiro','gestor','comprador','vendedor')
    );
$$;

-- Leitura de dados de negócio exige membership + acesso ok
create or replace function public.user_can_read_dados(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_is_member(p_empresa_id) and public.empresa_acesso_ok(p_empresa_id);
$$;

revoke all on function public.user_can_read_dados(uuid) from public, anon;
grant execute on function public.user_can_read_dados(uuid) to authenticated;

-- Atualiza SELECT das tabelas filhas (escrita já passa por user_can_write)
do $$
declare
  t text;
begin
  foreach t in array array[
    'categorias','centros_custo','contas_pagar','contas_receber','audit_logs',
    'extratos_bancarios','transacoes_bancarias','regras_conciliacao','documentos','certificados',
    'fornecedores','clientes','vendedores','produtos','estoque_movimentos',
    'pedidos_compra','pedido_compra_itens','pedidos_venda','pedido_venda_itens','oportunidades',
    'categoria_grupos','contas_financeiras','pagamentos_conta','transferencias_contas','feriados'
  ]
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('drop policy if exists %1$s_sel on public.%1$s;', t);
    execute format(
      'create policy %1$s_sel on public.%1$s for select using (public.user_can_read_dados(empresa_id));',
      t
    );
  end loop;
end $$;

-- ---- Profiles (usuário) ----
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  bloqueado boolean not null default false,
  bloqueado_motivo text,
  bloqueado_em timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

grant select on public.profiles to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (
    user_id = auth.uid()
    or lower(coalesce(auth.jwt() ->> 'email', '')) ~ '@iafeoficial\.com$'
  );

-- Sem insert/update direto pelo client comum; RPCs security definer.

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (user_id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

-- Backfill profiles existentes
insert into public.profiles (user_id, email)
select u.id, coalesce(u.email, '')
from auth.users u
on conflict (user_id) do update set email = excluded.email;

-- ---- Admin plataforma (@iafeoficial.com) ----
create or replace function public.is_plataforma_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) ~ '@iafeoficial\.com$';
$$;

revoke all on function public.is_plataforma_admin() from public, anon;
grant execute on function public.is_plataforma_admin() to authenticated;

create or replace function public.admin_list_empresas()
returns setof public.empresas
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_plataforma_admin() then
    raise exception 'Acesso negado';
  end if;
  return query select * from public.empresas order by nome_fantasia;
end;
$$;

create or replace function public.admin_update_empresa_acesso(
  p_id uuid,
  p_acesso_inicio timestamptz,
  p_acesso_fim timestamptz,
  p_acesso_bloqueado boolean,
  p_acesso_motivo text
)
returns public.empresas
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.empresas;
begin
  if not public.is_plataforma_admin() then
    raise exception 'Acesso negado';
  end if;
  update public.empresas
  set
    acesso_inicio = p_acesso_inicio,
    acesso_fim = p_acesso_fim,
    acesso_bloqueado = coalesce(p_acesso_bloqueado, false),
    acesso_motivo = nullif(trim(p_acesso_motivo), ''),
    updated_at = now()
  where id = p_id
  returning * into r;
  if r.id is null then
    raise exception 'Empresa não encontrada';
  end if;
  return r;
end;
$$;

create or replace function public.admin_list_profiles()
returns setof public.profiles
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_plataforma_admin() then
    raise exception 'Acesso negado';
  end if;
  return query select * from public.profiles order by email;
end;
$$;

create or replace function public.admin_set_profile_bloqueado(
  p_user_id uuid,
  p_bloqueado boolean,
  p_motivo text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.profiles;
begin
  if not public.is_plataforma_admin() then
    raise exception 'Acesso negado';
  end if;
  update public.profiles
  set
    bloqueado = coalesce(p_bloqueado, false),
    bloqueado_motivo = case
      when coalesce(p_bloqueado, false) then nullif(trim(p_motivo), '')
      else null
    end,
    bloqueado_em = case
      when coalesce(p_bloqueado, false) then now()
      else null
    end
  where user_id = p_user_id
  returning * into r;
  if r.user_id is null then
    raise exception 'Usuário não encontrado';
  end if;
  return r;
end;
$$;

revoke all on function public.admin_list_empresas() from public, anon;
revoke all on function public.admin_update_empresa_acesso(uuid, timestamptz, timestamptz, boolean, text) from public, anon;
revoke all on function public.admin_list_profiles() from public, anon;
revoke all on function public.admin_set_profile_bloqueado(uuid, boolean, text) from public, anon;

grant execute on function public.admin_list_empresas() to authenticated;
grant execute on function public.admin_update_empresa_acesso(uuid, timestamptz, timestamptz, boolean, text) to authenticated;
grant execute on function public.admin_list_profiles() to authenticated;
grant execute on function public.admin_set_profile_bloqueado(uuid, boolean, text) to authenticated;
