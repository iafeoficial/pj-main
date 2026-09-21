-- CRM: vincular oportunidades a clientes, vendedores e pedidos de venda.
alter table public.oportunidades
  add column if not exists cliente_id uuid references public.clientes(id) on delete set null,
  add column if not exists vendedor_id uuid references public.vendedores(id) on delete set null,
  add column if not exists pedido_venda_id uuid references public.pedidos_venda(id) on delete set null;
