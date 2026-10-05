-- Contas a Receber: vínculo opcional com conta/cartão (onde o valor entra).
-- Espelha contas_pagar.conta_financeira_id (migration 0016).

alter table public.contas_receber
  add column if not exists conta_financeira_id uuid
    references public.contas_financeiras(id) on delete set null;

create index if not exists idx_receber_conta_financeira
  on public.contas_receber(conta_financeira_id);
