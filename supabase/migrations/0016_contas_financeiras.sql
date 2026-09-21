-- Contas e Cartões: cadastro de contas correntes e cartões de crédito por empresa
-- + vínculo opcional no Contas a Pagar. Centro de custo permanece inalterado.

do $$ begin
  create type conta_financeira_tipo as enum ('conta_corrente', 'cartao_credito');
exception when duplicate_object then null; end $$;

create table if not exists public.contas_financeiras (
  id                    uuid primary key default gen_random_uuid(),
  empresa_id            uuid not null references public.empresas(id) on delete cascade,
  tipo                  conta_financeira_tipo not null default 'conta_corrente',
  nome                  text not null,
  instituicao           text default '',
  ativo                 boolean not null default true,
  observacao            text default '',
  -- conta corrente
  agencia               text default '',
  numero_conta          text default '',
  -- cartão de crédito
  bandeira              text default '',
  dia_vencimento_fatura int check (dia_vencimento_fatura between 1 and 28),
  -- saldo de abertura (opcional)
  saldo_inicial         numeric(14,2) not null default 0,
  data_saldo_inicial    date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_contas_financeiras_empresa
  on public.contas_financeiras(empresa_id);

alter table public.contas_pagar
  add column if not exists conta_financeira_id uuid
    references public.contas_financeiras(id) on delete set null;

create index if not exists idx_pagar_conta_financeira
  on public.contas_pagar(conta_financeira_id);

drop trigger if exists trg_contas_financeiras_updated on public.contas_financeiras;
create trigger trg_contas_financeiras_updated before update on public.contas_financeiras
  for each row execute function public.set_updated_at();

-- RLS no padrão das demais tabelas filhas: leitura por membership, escrita por papel.
alter table public.contas_financeiras enable row level security;

drop policy if exists contas_financeiras_sel on public.contas_financeiras;
create policy contas_financeiras_sel on public.contas_financeiras for select
  using (public.user_is_member(empresa_id));

drop policy if exists contas_financeiras_wr on public.contas_financeiras;
create policy contas_financeiras_wr on public.contas_financeiras for all
  using (public.user_can_write(empresa_id))
  with check (public.user_can_write(empresa_id));
