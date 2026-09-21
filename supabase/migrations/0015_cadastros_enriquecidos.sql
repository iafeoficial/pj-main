-- Cadastros enriquecidos: PF/PJ, contato, endereço BR e observações (operacional, sem IE/NCM).

do $$ begin
  create type tipo_pessoa as enum ('pf', 'pj');
exception when duplicate_object then null; end $$;

do $$ begin
  create type fonte_lead as enum ('indicacao', 'site', 'redes', 'evento', 'outro');
exception when duplicate_object then null; end $$;

-- Clientes e fornecedores (modelo parceiro)
alter table public.clientes
  add column if not exists tipo_pessoa tipo_pessoa not null default 'pj',
  add column if not exists nome_fantasia text default '',
  add column if not exists contato_nome text default '',
  add column if not exists observacao text default '',
  add column if not exists cep text default '',
  add column if not exists logradouro text default '',
  add column if not exists numero text default '',
  add column if not exists complemento text default '',
  add column if not exists bairro text default '',
  add column if not exists cidade text default '',
  add column if not exists uf text default '';

alter table public.fornecedores
  add column if not exists tipo_pessoa tipo_pessoa not null default 'pj',
  add column if not exists nome_fantasia text default '',
  add column if not exists contato_nome text default '',
  add column if not exists observacao text default '',
  add column if not exists cep text default '',
  add column if not exists logradouro text default '',
  add column if not exists numero text default '',
  add column if not exists complemento text default '',
  add column if not exists bairro text default '',
  add column if not exists cidade text default '',
  add column if not exists uf text default '';

-- Vendedores
alter table public.vendedores
  add column if not exists telefone text default '',
  add column if not exists cpf text default '',
  add column if not exists observacao text default '';

-- Produtos
alter table public.produtos
  add column if not exists descricao text default '',
  add column if not exists observacao text default '';

-- Empresas (endereço)
alter table public.empresas
  add column if not exists cep text default '',
  add column if not exists logradouro text default '',
  add column if not exists numero text default '',
  add column if not exists complemento text default '',
  add column if not exists bairro text default '',
  add column if not exists cidade text default '',
  add column if not exists uf text default '';

-- CRM
alter table public.oportunidades
  add column if not exists data_previsao_fechamento date,
  add column if not exists fonte_lead fonte_lead;
