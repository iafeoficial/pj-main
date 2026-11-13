-- Conta do DRE: rótulo livre opcional na categoria-folha (mapeamento contábil/DRE).
alter table public.categorias
  add column if not exists conta_dre text null;
