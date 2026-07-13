-- =====================================================================
-- Finanças PJ — Schema inicial (Fase 1 + Fase 2)
-- Multiempresa com isolamento por dono (owner_id = auth.uid()) via RLS.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- (A função user_owns_empresa é criada após a tabela empresas, pois funções SQL
--  validam as referências de tabela no momento da criação.)

-- ---------------------------------------------------------------------
-- Tipos (enums)
-- ---------------------------------------------------------------------
do $$ begin
  create type empresa_status as enum ('ativa','inativa');
  create type categoria_tipo as enum ('receita','despesa');
  create type conta_pagar_status as enum ('rascunho','aberta','parcial','paga','vencida','cancelada');
  create type conta_receber_status as enum ('rascunho','aberta','parcial','recebida','vencida','cancelada');
  create type audit_action as enum ('inclusao','alteracao','exclusao','baixa','cancelamento');
  create type transacao_tipo as enum ('credito','debito');
  create type conciliacao_status as enum ('pendente','conciliada','ignorada');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Multiempresa
-- ---------------------------------------------------------------------
create table if not exists public.empresas (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cnpj          text not null,
  razao_social  text not null,
  nome_fantasia text not null,
  email         text default '',
  telefone      text default '',
  status        empresa_status not null default 'ativa',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (owner_id, cnpj)
);

-- Verdadeiro se a empresa pertence ao usuário autenticado (após criar a tabela).
create or replace function public.user_owns_empresa(p_empresa_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.empresas e
    where e.id = p_empresa_id and e.owner_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------
-- Cadastros
-- ---------------------------------------------------------------------
create table if not exists public.categorias (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome       text not null,
  tipo       categoria_tipo not null,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.centros_custo (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome       text not null,
  codigo     text default '',
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Financeiro
-- ---------------------------------------------------------------------
create table if not exists public.contas_pagar (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references public.empresas(id) on delete cascade,
  fornecedor       text not null,
  categoria_id     uuid references public.categorias(id) on delete set null,
  centro_custo_id  uuid references public.centros_custo(id) on delete set null,
  valor            numeric(14,2) not null check (valor >= 0),
  valor_pago       numeric(14,2) not null default 0 check (valor_pago >= 0),
  data_competencia date not null,
  data_vencimento  date not null,
  data_pagamento   date,
  status           conta_pagar_status not null default 'aberta',
  observacao       text default '',
  created_by       text default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.contas_receber (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references public.empresas(id) on delete cascade,
  cliente          text not null,
  categoria_id     uuid references public.categorias(id) on delete set null,
  centro_custo_id  uuid references public.centros_custo(id) on delete set null,
  valor            numeric(14,2) not null check (valor >= 0),
  valor_recebido   numeric(14,2) not null default 0 check (valor_recebido >= 0),
  data_competencia date not null,
  data_vencimento  date not null,
  data_recebimento date,
  status           conta_receber_status not null default 'aberta',
  observacao       text default '',
  created_by       text default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  entidade    text not null,
  entidade_id uuid,
  acao        audit_action not null,
  descricao   text not null,
  usuario     text default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Fase 2 — Conciliação Bancária
-- ---------------------------------------------------------------------
create table if not exists public.extratos_bancarios (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  banco        text default '',
  conta        text default '',
  data_inicio  date,
  data_fim     date,
  arquivo_nome text default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.transacoes_bancarias (
  id                 uuid primary key default gen_random_uuid(),
  empresa_id         uuid not null references public.empresas(id) on delete cascade,
  extrato_id         uuid references public.extratos_bancarios(id) on delete cascade,
  fitid              text,                          -- id único da transação no OFX
  data               date not null,
  valor              numeric(14,2) not null,        -- positivo=crédito, negativo=débito
  tipo               transacao_tipo not null,
  descricao          text default '',
  documento          text default '',
  status_conciliacao conciliacao_status not null default 'pendente',
  conta_pagar_id     uuid references public.contas_pagar(id) on delete set null,
  conta_receber_id   uuid references public.contas_receber(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (empresa_id, fitid)
);

create table if not exists public.regras_conciliacao (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  nome          text not null,
  palavra_chave text default '',
  tipo          transacao_tipo,                     -- aplica-se a crédito/débito (null=ambos)
  categoria_id  uuid references public.categorias(id) on delete set null,
  prioridade    int not null default 0,
  ativo         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------
create index if not exists idx_categorias_empresa       on public.categorias(empresa_id);
create index if not exists idx_centros_empresa          on public.centros_custo(empresa_id);
create index if not exists idx_pagar_empresa            on public.contas_pagar(empresa_id);
create index if not exists idx_pagar_venc               on public.contas_pagar(empresa_id, data_vencimento);
create index if not exists idx_receber_empresa          on public.contas_receber(empresa_id);
create index if not exists idx_receber_venc             on public.contas_receber(empresa_id, data_vencimento);
create index if not exists idx_audit_empresa            on public.audit_logs(empresa_id, created_at desc);
create index if not exists idx_extratos_empresa         on public.extratos_bancarios(empresa_id);
create index if not exists idx_transacoes_empresa       on public.transacoes_bancarias(empresa_id, data);
create index if not exists idx_transacoes_status        on public.transacoes_bancarias(empresa_id, status_conciliacao);
create index if not exists idx_regras_empresa           on public.regras_conciliacao(empresa_id, prioridade desc);

-- ---------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'empresas','categorias','centros_custo','contas_pagar','contas_receber',
    'audit_logs','extratos_bancarios','transacoes_bancarias','regras_conciliacao'
  ] loop
    execute format('drop trigger if exists trg_%1$s_updated on public.%1$s;', t);
    execute format(
      'create trigger trg_%1$s_updated before update on public.%1$s
       for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Row Level Security (isolamento por dono/empresa)
-- ---------------------------------------------------------------------
alter table public.empresas              enable row level security;
alter table public.categorias            enable row level security;
alter table public.centros_custo         enable row level security;
alter table public.contas_pagar          enable row level security;
alter table public.contas_receber        enable row level security;
alter table public.audit_logs            enable row level security;
alter table public.extratos_bancarios    enable row level security;
alter table public.transacoes_bancarias  enable row level security;
alter table public.regras_conciliacao    enable row level security;

-- Empresas: o dono enxerga/gerencia apenas as próprias.
drop policy if exists empresas_select on public.empresas;
create policy empresas_select on public.empresas for select using (owner_id = auth.uid());
drop policy if exists empresas_insert on public.empresas;
create policy empresas_insert on public.empresas for insert with check (owner_id = auth.uid());
drop policy if exists empresas_update on public.empresas;
create policy empresas_update on public.empresas for update using (owner_id = auth.uid());
drop policy if exists empresas_delete on public.empresas;
create policy empresas_delete on public.empresas for delete using (owner_id = auth.uid());

-- Tabelas filhas: acesso somente se a empresa pertence ao usuário.
do $$
declare t text;
begin
  foreach t in array array[
    'categorias','centros_custo','contas_pagar','contas_receber',
    'audit_logs','extratos_bancarios','transacoes_bancarias','regras_conciliacao'
  ] loop
    execute format('drop policy if exists %1$s_all on public.%1$s;', t);
    execute format(
      'create policy %1$s_all on public.%1$s for all
       using (public.user_owns_empresa(empresa_id))
       with check (public.user_owns_empresa(empresa_id));', t);
  end loop;
end $$;
