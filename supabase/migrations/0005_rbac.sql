-- =====================================================================
-- Transversais — RBAC + Multiusuário.
-- Migra o isolamento de "dono único" (owner_id) para "membros por empresa" com papéis.
-- =====================================================================

-- ---- Tabelas ----
create table if not exists public.empresa_membros (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text default '',
  papel text not null default 'consulta'
    check (papel in ('administrador','financeiro','gestor','comprador','vendedor','contador','consulta')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, user_id)
);
create index if not exists idx_membros_empresa on public.empresa_membros(empresa_id);
create index if not exists idx_membros_user on public.empresa_membros(user_id);

create table if not exists public.convites (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  email text not null,
  papel text not null default 'consulta'
    check (papel in ('administrador','financeiro','gestor','comprador','vendedor','contador','consulta')),
  status text not null default 'pendente' check (status in ('pendente','aceito','cancelado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_convites_empresa on public.convites(empresa_id);
create index if not exists idx_convites_email on public.convites(lower(email));

-- ---- Funções de apoio ----
create or replace function public.user_is_member(p_empresa_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.empresa_membros m where m.empresa_id = p_empresa_id and m.user_id = auth.uid());
$$;

create or replace function public.user_has_role(p_empresa_id uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.empresa_membros m
    where m.empresa_id = p_empresa_id and m.user_id = auth.uid() and m.papel = any(p_roles)
  );
$$;

create or replace function public.user_can_write(p_empresa_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.empresa_membros m
    where m.empresa_id = p_empresa_id and m.user_id = auth.uid()
      and m.papel in ('administrador','financeiro','gestor','comprador','vendedor')
  );
$$;

-- Compatibilidade: o que antes era "dono" agora é "membro".
create or replace function public.user_owns_empresa(p_empresa_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.user_is_member(p_empresa_id);
$$;

-- ---- Trigger: dono da empresa entra como administrador ----
create or replace function public.add_owner_membership()
returns trigger language plpgsql security definer set search_path = public as $$
declare uemail text;
begin
  select email into uemail from auth.users where id = new.owner_id;
  insert into public.empresa_membros (empresa_id, user_id, email, papel)
  values (new.id, new.owner_id, coalesce(uemail, ''), 'administrador')
  on conflict (empresa_id, user_id) do nothing;
  return new;
end; $$;

drop trigger if exists trg_empresas_owner_member on public.empresas;
create trigger trg_empresas_owner_member after insert on public.empresas
  for each row execute function public.add_owner_membership();

-- ---- Backfill: empresas existentes ganham o dono como administrador ----
insert into public.empresa_membros (empresa_id, user_id, email, papel)
select e.id, e.owner_id, coalesce(u.email, ''), 'administrador'
from public.empresas e
left join auth.users u on u.id = e.owner_id
on conflict (empresa_id, user_id) do nothing;

-- ---- Aceitar convite (SECURITY DEFINER: insere a própria associação) ----
create or replace function public.accept_invite(p_convite_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c public.convites; uemail text;
begin
  select * into c from public.convites where id = p_convite_id;
  if c.id is null then raise exception 'Convite não encontrado.'; end if;
  uemail := lower(auth.jwt() ->> 'email');
  if lower(c.email) <> uemail then raise exception 'Convite não pertence a este usuário.'; end if;
  if c.status <> 'pendente' then raise exception 'Convite não está mais pendente.'; end if;
  insert into public.empresa_membros (empresa_id, user_id, email, papel)
  values (c.empresa_id, auth.uid(), uemail, c.papel)
  on conflict (empresa_id, user_id) do update set papel = excluded.papel;
  update public.convites set status = 'aceito' where id = p_convite_id;
end; $$;

-- ---- RLS: novas tabelas ----
alter table public.empresa_membros enable row level security;
drop policy if exists membros_select on public.empresa_membros;
create policy membros_select on public.empresa_membros for select
  using (user_id = auth.uid() or public.user_is_member(empresa_id));
drop policy if exists membros_insert on public.empresa_membros;
create policy membros_insert on public.empresa_membros for insert
  with check (public.user_has_role(empresa_id, array['administrador']));
drop policy if exists membros_update on public.empresa_membros;
create policy membros_update on public.empresa_membros for update
  using (public.user_has_role(empresa_id, array['administrador']));
drop policy if exists membros_delete on public.empresa_membros;
create policy membros_delete on public.empresa_membros for delete
  using (public.user_has_role(empresa_id, array['administrador']) or user_id = auth.uid());

alter table public.convites enable row level security;
drop policy if exists convites_select on public.convites;
create policy convites_select on public.convites for select
  using (lower(email) = lower(auth.jwt() ->> 'email') or public.user_has_role(empresa_id, array['administrador']));
drop policy if exists convites_insert on public.convites;
create policy convites_insert on public.convites for insert
  with check (public.user_has_role(empresa_id, array['administrador']));
drop policy if exists convites_update on public.convites;
create policy convites_update on public.convites for update
  using (public.user_has_role(empresa_id, array['administrador']));
drop policy if exists convites_delete on public.convites;
create policy convites_delete on public.convites for delete
  using (public.user_has_role(empresa_id, array['administrador']));

-- ---- RLS: empresas (membro lê; admin altera/exclui; qualquer um cria a própria) ----
drop policy if exists empresas_select on public.empresas;
create policy empresas_select on public.empresas for select using (public.user_is_member(id));
drop policy if exists empresas_insert on public.empresas;
create policy empresas_insert on public.empresas for insert with check (owner_id = auth.uid());
drop policy if exists empresas_update on public.empresas;
create policy empresas_update on public.empresas for update using (public.user_has_role(id, array['administrador']));
drop policy if exists empresas_delete on public.empresas;
create policy empresas_delete on public.empresas for delete using (public.user_has_role(id, array['administrador']));

-- ---- RLS: tabelas filhas — leitura p/ membros, escrita p/ papéis operacionais ----
do $$
declare t text;
begin
  foreach t in array array[
    'categorias','centros_custo','contas_pagar','contas_receber','audit_logs',
    'extratos_bancarios','transacoes_bancarias','regras_conciliacao','documentos','certificados',
    'fornecedores','clientes','vendedores','produtos','estoque_movimentos',
    'pedidos_compra','pedido_compra_itens','pedidos_venda','pedido_venda_itens','oportunidades'
  ] loop
    execute format('drop policy if exists %1$s_all on public.%1$s;', t);
    execute format('drop policy if exists %1$s_sel on public.%1$s;', t);
    execute format('drop policy if exists %1$s_wr on public.%1$s;', t);
    execute format('create policy %1$s_sel on public.%1$s for select using (public.user_is_member(empresa_id));', t);
    execute format(
      'create policy %1$s_wr on public.%1$s for all
       using (public.user_can_write(empresa_id))
       with check (public.user_can_write(empresa_id));', t);
  end loop;
end $$;
