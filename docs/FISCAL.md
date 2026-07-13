# Emissão Fiscal (NFS-e / NF-e) — Plano (Fase 4, planejado)

> Status: **planejado / não implementado**. Exige certificado A1 server-side + provedor homologado.
> Hoje, para o contador, use a **Exportação Contábil** (CSV de lançamentos D/C).

## Por que não roda no app (cliente)
A emissão assina o XML com a **chave privada** do certificado digital. Essa chave **nunca** pode ir
para o navegador. Além disso, NF-e fala com webservices da SEFAZ (SOAP) e NFS-e varia por município.

## Caminho recomendado
1. **Provedor homologado** (Focus NFe, PlugNotas, eNotas, NFe.io): abstrai SEFAZ e prefeituras via API REST.
2. **Backend** (ex.: Supabase Edge Functions) para guardar o certificado, assinar/transmitir e tratar contingência.
3. **Cadastro do certificado**: o app já registra metadados (validade/titular) em *Certificados*; o
   arquivo `.pfx` ficaria em armazenamento seguro do backend, criptografado.
4. **Persistência**: salvar XML/DANFE emitidos e vincular às contas (reuso do módulo *Documentos*).
5. **Operações**: emitir, cancelar, carta de correção, consulta de status, inutilização.

## Modelo de dados (futuro)
- `notas_fiscais` (tipo NFS-e/NF-e, status, número, chave, valor, tomador/destinatário, xml, vínculo conta).
- Reuso de `certificados` (metadados) e `documentos` (armazenamento).

## Esforço (alto nível)
- Integração com 1 provedor + emissão NFS-e de 1 município: médio.
- NF-e (produtos) com itens/CFOP/tributos: alto.
