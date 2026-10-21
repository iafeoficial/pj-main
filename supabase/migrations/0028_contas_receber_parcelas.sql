-- Parcelamento e repetição em Contas a Receber, iguais aos de Contas a Pagar.

alter table public.contas_receber
  add column if not exists parcela_numero      int check (parcela_numero > 0),
  add column if not exists parcela_total       int check (parcela_total > 0),
  add column if not exists grupo_parcelamento  uuid,
  add column if not exists recorrencia         recorrencia_tipo,
  add column if not exists grupo_recorrencia   uuid,
  add column if not exists recorrencia_dias    int
    check (recorrencia_dias is null or (recorrencia_dias >= 1 and recorrencia_dias <= 365));

create index if not exists idx_receber_grupo_parcelamento
  on public.contas_receber(grupo_parcelamento);
create index if not exists idx_receber_grupo_recorrencia
  on public.contas_receber(grupo_recorrencia);

comment on column public.contas_receber.recorrencia_dias is
  'Intervalo em dias quando recorrencia = personalizada.';
