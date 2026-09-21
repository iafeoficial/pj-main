-- Contas a Pagar: desconto/juros, nº da NF, impostos retidos, parcelamento,
-- repetição e histórico de pagamentos. Escopo apenas "pagar" (receber inalterado).

do $$ begin
  create type recorrencia_tipo as enum ('semanal','quinzenal','mensal','semestral','anual');
exception when duplicate_object then null; end $$;

alter table public.contas_pagar
  add column if not exists desconto            numeric(14,2) not null default 0 check (desconto >= 0),
  add column if not exists juros               numeric(14,2) not null default 0 check (juros >= 0),
  add column if not exists numero_nf           text default '',
  -- { pis|cofins|csll|ir|iss|inss: { reter: bool, valor: number } }
  add column if not exists impostos            jsonb,
  add column if not exists parcela_numero      int check (parcela_numero > 0),
  add column if not exists parcela_total       int check (parcela_total > 0),
  add column if not exists grupo_parcelamento  uuid,
  add column if not exists recorrencia         recorrencia_tipo,
  add column if not exists grupo_recorrencia   uuid;

create index if not exists idx_pagar_grupo_parcelamento
  on public.contas_pagar(grupo_parcelamento);
create index if not exists idx_pagar_grupo_recorrencia
  on public.contas_pagar(grupo_recorrencia);

-- Histórico de pagamentos (uma linha por baixa registrada).
create table if not exists public.pagamentos_conta (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  conta_pagar_id uuid not null references public.contas_pagar(id) on delete cascade,
  data           date not null,
  valor          numeric(14,2) not null check (valor > 0),
  observacao     text default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_pagamentos_conta_empresa
  on public.pagamentos_conta(empresa_id);
create index if not exists idx_pagamentos_conta_conta
  on public.pagamentos_conta(conta_pagar_id, data);

drop trigger if exists trg_pagamentos_conta_updated on public.pagamentos_conta;
create trigger trg_pagamentos_conta_updated before update on public.pagamentos_conta
  for each row execute function public.set_updated_at();

alter table public.pagamentos_conta enable row level security;

drop policy if exists pagamentos_conta_sel on public.pagamentos_conta;
create policy pagamentos_conta_sel on public.pagamentos_conta for select
  using (public.user_is_member(empresa_id));

drop policy if exists pagamentos_conta_wr on public.pagamentos_conta;
create policy pagamentos_conta_wr on public.pagamentos_conta for all
  using (public.user_can_write(empresa_id))
  with check (public.user_can_write(empresa_id));
