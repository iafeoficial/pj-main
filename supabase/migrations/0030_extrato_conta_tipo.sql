-- Tipo da conta no extrato OFX (conta corrente ou cartão). Default: conta corrente.

alter table public.extratos_bancarios
  add column if not exists conta_tipo public.conta_financeira_tipo not null default 'conta_corrente';
