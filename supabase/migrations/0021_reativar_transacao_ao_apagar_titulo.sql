-- Ao apagar Conta a Pagar/Receber, a linha do extrato volta a pendente
-- (ON DELETE SET NULL só limpa a FK; o status ficaria "conciliada").

create or replace function public.reativar_transacoes_ao_apagar_conta_pagar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.transacoes_bancarias
  set
    status_conciliacao = 'pendente',
    conta_pagar_id = null,
    conta_receber_id = null
  where conta_pagar_id = old.id;
  return old;
end;
$$;

create or replace function public.reativar_transacoes_ao_apagar_conta_receber()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.transacoes_bancarias
  set
    status_conciliacao = 'pendente',
    conta_pagar_id = null,
    conta_receber_id = null
  where conta_receber_id = old.id;
  return old;
end;
$$;

drop trigger if exists trg_reativar_tx_ao_apagar_pagar on public.contas_pagar;
create trigger trg_reativar_tx_ao_apagar_pagar
  before delete on public.contas_pagar
  for each row execute function public.reativar_transacoes_ao_apagar_conta_pagar();

drop trigger if exists trg_reativar_tx_ao_apagar_receber on public.contas_receber;
create trigger trg_reativar_tx_ao_apagar_receber
  before delete on public.contas_receber
  for each row execute function public.reativar_transacoes_ao_apagar_conta_receber();
