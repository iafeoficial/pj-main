-- =====================================================================
-- Fase 5 — Operação: cadastros, estoque, compras, vendas, CRM, comissões.
-- Tudo isolado por empresa via RLS (user_owns_empresa).
-- =====================================================================

do $$ begin
  create type pedido_compra_status as enum ('rascunho','aprovado','recebido','cancelado');
  create type pedido_venda_status as enum ('orcamento','pedido','faturado','cancelado');
  create type estoque_mov_tipo as enum ('entrada','saida','ajuste');
  create type oportunidade_estagio as enum ('lead','qualificado','proposta','ganho','perdido');
exception when duplicate_object then null; end $$;

-- ---- Cadastros ----
create table if not exists public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  cnpj_cpf text default '',
  email text default '',
  telefone text default '',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  cnpj_cpf text default '',
  email text default '',
  telefone text default '',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vendedores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  email text default '',
  comissao_percent numeric(6,2) not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---- Estoque ----
create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  sku text default '',
  unidade text default 'un',
  preco_venda numeric(14,2) not null default 0,
  custo_medio numeric(14,4) not null default 0,
  estoque_atual numeric(14,3) not null default 0,
  controla_estoque boolean not null default true,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  tipo estoque_mov_tipo not null,
  quantidade numeric(14,3) not null,
  custo_unitario numeric(14,4) not null default 0,
  documento text default '',
  observacao text default '',
  data date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---- Compras ----
create table if not exists public.pedidos_compra (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  fornecedor_id uuid references public.fornecedores(id) on delete set null,
  fornecedor_nome text default '',
  status pedido_compra_status not null default 'rascunho',
  data date not null,
  valor_total numeric(14,2) not null default 0,
  observacao text default '',
  conta_pagar_id uuid references public.contas_pagar(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pedido_compra_itens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  pedido_id uuid not null references public.pedidos_compra(id) on delete cascade,
  produto_id uuid references public.produtos(id) on delete set null,
  descricao text not null,
  quantidade numeric(14,3) not null default 1,
  valor_unitario numeric(14,2) not null default 0,
  valor_total numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---- Vendas ----
create table if not exists public.pedidos_venda (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete set null,
  cliente_nome text default '',
  vendedor_id uuid references public.vendedores(id) on delete set null,
  status pedido_venda_status not null default 'orcamento',
  data date not null,
  valor_total numeric(14,2) not null default 0,
  comissao_percent numeric(6,2) not null default 0,
  comissao_valor numeric(14,2) not null default 0,
  observacao text default '',
  conta_receber_id uuid references public.contas_receber(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pedido_venda_itens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  pedido_id uuid not null references public.pedidos_venda(id) on delete cascade,
  produto_id uuid references public.produtos(id) on delete set null,
  descricao text not null,
  quantidade numeric(14,3) not null default 1,
  valor_unitario numeric(14,2) not null default 0,
  valor_total numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---- CRM ----
create table if not exists public.oportunidades (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  titulo text not null,
  cliente_nome text default '',
  contato text default '',
  valor_estimado numeric(14,2) not null default 0,
  estagio oportunidade_estagio not null default 'lead',
  observacao text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---- Índices ----
create index if not exists idx_fornecedores_empresa on public.fornecedores(empresa_id);
create index if not exists idx_clientes_empresa on public.clientes(empresa_id);
create index if not exists idx_vendedores_empresa on public.vendedores(empresa_id);
create index if not exists idx_produtos_empresa on public.produtos(empresa_id);
create index if not exists idx_estmov_empresa on public.estoque_movimentos(empresa_id, data);
create index if not exists idx_estmov_produto on public.estoque_movimentos(produto_id);
create index if not exists idx_pcompra_empresa on public.pedidos_compra(empresa_id, data);
create index if not exists idx_pcompra_itens on public.pedido_compra_itens(pedido_id);
create index if not exists idx_pvenda_empresa on public.pedidos_venda(empresa_id, data);
create index if not exists idx_pvenda_itens on public.pedido_venda_itens(pedido_id);
create index if not exists idx_oportunidades_empresa on public.oportunidades(empresa_id);

-- ---- Triggers updated_at ----
do $$
declare t text;
begin
  foreach t in array array[
    'fornecedores','clientes','vendedores','produtos','estoque_movimentos',
    'pedidos_compra','pedido_compra_itens','pedidos_venda','pedido_venda_itens','oportunidades'
  ] loop
    execute format('drop trigger if exists trg_%1$s_updated on public.%1$s;', t);
    execute format(
      'create trigger trg_%1$s_updated before update on public.%1$s
       for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- ---- RLS ----
do $$
declare t text;
begin
  foreach t in array array[
    'fornecedores','clientes','vendedores','produtos','estoque_movimentos',
    'pedidos_compra','pedido_compra_itens','pedidos_venda','pedido_venda_itens','oportunidades'
  ] loop
    execute format('alter table public.%1$s enable row level security;', t);
    execute format('drop policy if exists %1$s_all on public.%1$s;', t);
    execute format(
      'create policy %1$s_all on public.%1$s for all
       using (public.user_owns_empresa(empresa_id))
       with check (public.user_owns_empresa(empresa_id));', t);
  end loop;
end $$;
