-- Repetição com período específico em dias (ex.: a cada 20 dias).

do $$ begin
  alter type recorrencia_tipo add value if not exists 'personalizada';
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

alter table public.contas_pagar
  add column if not exists recorrencia_dias int
  check (recorrencia_dias is null or (recorrencia_dias >= 1 and recorrencia_dias <= 365));

comment on column public.contas_pagar.recorrencia_dias is
  'Intervalo em dias quando recorrencia = personalizada.';
