-- CPF/CNPJ completo não se repete no mesmo cadastro da empresa.
-- Sem documento, ou com número incompleto, não entra na regra.
-- A mesma pessoa pode ser cliente e fornecedor: a trava é em cada tabela.

create unique index if not exists clientes_empresa_documento_uidx
  on public.clientes (
    empresa_id,
    lower(regexp_replace(cnpj_cpf, '[^0-9A-Za-z]', '', 'g'))
  )
  where length(regexp_replace(coalesce(cnpj_cpf, ''), '[^0-9A-Za-z]', '', 'g')) in (11, 14);

create unique index if not exists fornecedores_empresa_documento_uidx
  on public.fornecedores (
    empresa_id,
    lower(regexp_replace(cnpj_cpf, '[^0-9A-Za-z]', '', 'g'))
  )
  where length(regexp_replace(coalesce(cnpj_cpf, ''), '[^0-9A-Za-z]', '', 'g')) in (11, 14);
