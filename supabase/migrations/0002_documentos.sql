-- =====================================================================
-- Fase 3 — Documentos (NF-e XML, boletos). Origem auditável dos lançamentos.
-- =====================================================================

do $$ begin
  create type documento_tipo as enum ('nfe','boleto');
exception when duplicate_object then null; end $$;

create table if not exists public.documentos (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  tipo           documento_tipo not null,
  origem         text default '',            -- xml | ocr | linha_digitavel
  arquivo_nome   text default '',
  emitente       text default '',            -- fornecedor / beneficiário
  documento      text default '',            -- chave NF-e ou linha digitável
  valor          numeric(14,2),
  data_documento date,
  dados          jsonb,                      -- payload bruto extraído (itens etc.)
  conta_pagar_id uuid references public.contas_pagar(id) on delete set null,
  status         text not null default 'importado', -- importado | vinculado
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_documentos_empresa on public.documentos(empresa_id, created_at desc);

drop trigger if exists trg_documentos_updated on public.documentos;
create trigger trg_documentos_updated before update on public.documentos
  for each row execute function public.set_updated_at();

alter table public.documentos enable row level security;
drop policy if exists documentos_all on public.documentos;
create policy documentos_all on public.documentos for all
  using (public.user_owns_empresa(empresa_id))
  with check (public.user_owns_empresa(empresa_id));
