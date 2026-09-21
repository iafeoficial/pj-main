-- Titular / responsável da conta ou cartão (quem responde pelo meio de pagamento).
-- Obrigatório na UI para cartão; opcional para conta corrente.

alter table public.contas_financeiras
  add column if not exists titular text not null default '';
