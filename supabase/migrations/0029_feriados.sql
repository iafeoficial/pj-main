-- Feriados da empresa (estaduais/municipais). Nacionais são calculados no app.

create table if not exists public.feriados (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  data         date not null,
  nome         text not null,
  repete_anual boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_feriados_empresa on public.feriados(empresa_id);
create unique index if not exists feriados_empresa_data_uidx
  on public.feriados (empresa_id, data);

drop trigger if exists trg_feriados_updated on public.feriados;
create trigger trg_feriados_updated before update on public.feriados
  for each row execute function public.set_updated_at();

alter table public.feriados enable row level security;

drop policy if exists feriados_sel on public.feriados;
create policy feriados_sel on public.feriados for select
  using (public.user_is_member(empresa_id));

drop policy if exists feriados_wr on public.feriados;
create policy feriados_wr on public.feriados for all
  using (public.user_can_write(empresa_id))
  with check (public.user_can_write(empresa_id));
