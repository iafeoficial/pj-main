-- Linha do extrato conciliada como transferência entre contas.
-- Ao apagar a transferência, a linha volta a pendente.

alter table public.transacoes_bancarias
  add column if not exists transferencia_id uuid
    references public.transferencias_contas(id) on delete set null;

create index if not exists idx_transacoes_transferencia
  on public.transacoes_bancarias(transferencia_id);

create or replace function public.reativar_transacao_ao_apagar_transferencia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.transacoes_bancarias
  set
    status_conciliacao = 'pendente',
    transferencia_id = null
  where transferencia_id = old.id;
  return old;
end;
$$;

drop trigger if exists trg_reativar_tx_ao_apagar_transferencia on public.transferencias_contas;
create trigger trg_reativar_tx_ao_apagar_transferencia
  before delete on public.transferencias_contas
  for each row execute function public.reativar_transacao_ao_apagar_transferencia();
