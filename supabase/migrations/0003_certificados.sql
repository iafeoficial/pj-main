-- =====================================================================
-- Fase 4 — Cadastro de Certificados Digitais (metadados).
-- IMPORTANTE: não armazena a chave privada (.pfx). Assinatura exige backend seguro.
-- =====================================================================

do $$ begin
  create type certificado_tipo as enum ('A1','A3');
exception when duplicate_object then null; end $$;

create table if not exists public.certificados (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  titular     text not null,
  tipo        certificado_tipo not null default 'A1',
  validade    date not null,
  observacao  text default '',
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_certificados_empresa on public.certificados(empresa_id, validade);

drop trigger if exists trg_certificados_updated on public.certificados;
create trigger trg_certificados_updated before update on public.certificados
  for each row execute function public.set_updated_at();

alter table public.certificados enable row level security;
drop policy if exists certificados_all on public.certificados;
create policy certificados_all on public.certificados for all
  using (public.user_owns_empresa(empresa_id))
  with check (public.user_owns_empresa(empresa_id));
