-- Transferência entre contas da mesma empresa.
-- Não é despesa nem receita: não entra em contas a pagar/receber.
-- Títulos já lançados podem ser marcados com `transferencia` para sair dos totais.

create table if not exists public.transferencias_contas (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  conta_origem_id   uuid not null references public.contas_financeiras(id) on delete restrict,
  conta_destino_id  uuid not null references public.contas_financeiras(id) on delete restrict,
  data              date not null,
  valor             numeric(14,2) not null check (valor > 0),
  observacao        text default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint transferencias_contas_origem_destino_diff
    check (conta_origem_id <> conta_destino_id)
);

create index if not exists idx_transferencias_contas_empresa
  on public.transferencias_contas(empresa_id, data);

drop trigger if exists trg_transferencias_contas_updated on public.transferencias_contas;
create trigger trg_transferencias_contas_updated before update on public.transferencias_contas
  for each row execute function public.set_updated_at();

alter table public.transferencias_contas enable row level security;

drop policy if exists transferencias_contas_sel on public.transferencias_contas;
create policy transferencias_contas_sel on public.transferencias_contas for select
  using (public.user_is_member(empresa_id));

drop policy if exists transferencias_contas_wr on public.transferencias_contas;
create policy transferencias_contas_wr on public.transferencias_contas for all
  using (public.user_can_write(empresa_id))
  with check (public.user_can_write(empresa_id));

alter table public.contas_pagar
  add column if not exists transferencia boolean not null default false;

alter table public.contas_receber
  add column if not exists transferencia boolean not null default false;
