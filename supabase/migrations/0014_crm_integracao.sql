-- CRM: integração com clientes, vendedores e pedidos de venda.

alter table public.oportunidades
  add column if not exists cliente_id uuid references public.clientes(id) on delete set null,
  add column if not exists vendedor_id uuid references public.vendedores(id) on delete set null,
  add column if not exists pedido_venda_id uuid references public.pedidos_venda(id) on delete set null;

create index if not exists idx_oportunidades_cliente on public.oportunidades(cliente_id);
create index if not exists idx_oportunidades_vendedor on public.oportunidades(vendedor_id);
create index if not exists idx_oportunidades_pedido on public.oportunidades(pedido_venda_id);
