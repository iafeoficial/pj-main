-- Liga a conta ao cadastro do parceiro. O nome continua no título;
-- CPF/CNPJ e telefone são lidos do cadastro. Apagar o parceiro só solta o vínculo.

alter table public.contas_pagar
  add column if not exists fornecedor_id uuid references public.fornecedores(id) on delete set null;

alter table public.contas_receber
  add column if not exists cliente_id uuid references public.clientes(id) on delete set null;

create index if not exists contas_pagar_fornecedor_id_idx on public.contas_pagar (fornecedor_id);
create index if not exists contas_receber_cliente_id_idx on public.contas_receber (cliente_id);
