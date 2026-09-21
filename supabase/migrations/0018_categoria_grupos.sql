-- Grupos de categoria para DRE hierárquica (grupo → categorias-folha).
-- Categorias continuam sendo as folhas usadas em lançamentos; grupos só organizam.

create table if not exists public.categoria_grupos (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome       text not null,
  tipo       text not null check (tipo in ('receita', 'despesa')),
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_categoria_grupos_empresa
  on public.categoria_grupos(empresa_id);

alter table public.categorias
  add column if not exists grupo_id uuid
    references public.categoria_grupos(id) on delete set null;

create index if not exists idx_categorias_grupo
  on public.categorias(grupo_id);

drop trigger if exists trg_categoria_grupos_updated on public.categoria_grupos;
create trigger trg_categoria_grupos_updated before update on public.categoria_grupos
  for each row execute function public.set_updated_at();

alter table public.categoria_grupos enable row level security;

drop policy if exists categoria_grupos_sel on public.categoria_grupos;
create policy categoria_grupos_sel on public.categoria_grupos for select
  using (public.user_is_member(empresa_id));

drop policy if exists categoria_grupos_wr on public.categoria_grupos;
create policy categoria_grupos_wr on public.categoria_grupos for all
  using (public.user_can_write(empresa_id))
  with check (public.user_can_write(empresa_id));
