-- Importação de NFS-e (XML nacional) → Contas a Pagar / Contas a Receber.
-- Tipo de documento nfse, vínculo com receber, chave única e nº NF em receber.

do $$ begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    where t.typname = 'documento_tipo' and e.enumlabel = 'nfse'
  ) then
    alter type public.documento_tipo add value 'nfse';
  end if;
end $$;

alter table public.documentos
  add column if not exists conta_receber_id uuid
    references public.contas_receber(id) on delete set null;

create index if not exists idx_documentos_conta_receber
  on public.documentos(conta_receber_id)
  where conta_receber_id is not null;

-- Chave da nota (NF-e / NFS-e) ou linha digitável: única por empresa quando preenchida.
create unique index if not exists uq_documentos_empresa_documento
  on public.documentos(empresa_id, documento)
  where documento is not null and btrim(documento) <> '';

alter table public.contas_receber
  add column if not exists numero_nf text not null default '';

comment on column public.documentos.conta_receber_id is
  'Título a receber gerado a partir deste documento (ex.: NFS-e emitida pela empresa).';
comment on column public.contas_receber.numero_nf is
  'Número da NFS-e / documento fiscal associado ao título.';
