# Open Finance — Plano de Integração (Fase 3, planejado)

> Status: **planejado / não implementado**. Requer provedor certificado. Esta página documenta os
> requisitos para uma futura implementação. Hoje, a importação de extratos é feita via **OFX**
> (módulo Conciliação Bancária).

## Por que não está implementado
O Open Finance Brasil exige participação regulada: para ler contas/transações de terceiros é
necessário ser uma instituição participante homologada pelo Banco Central **ou** usar um
**agregador/initiator certificado**. Não é possível "chamar a API do banco" diretamente do frontend.

## Caminho recomendado
1. **Contratar um agregador homologado** (ex.: Pluggy, Belvo, Klavi). Eles abstraem a certificação
   e expõem uma API para contas/transações.
2. **Backend para guardar segredos**: tokens e webhooks do provedor devem ficar no servidor
   (ex.: Supabase Edge Functions), nunca no cliente.
3. **Fluxo de consentimento**: tela para o cliente autorizar o acesso (escopo, prazo, revogação).
4. **Sincronização**: ao receber transações do provedor, alimentar a tabela
   `transacoes_bancarias` (já existente) e reutilizar o **motor de conciliação** atual.
5. **Governança/LGPD**: auditoria de acesso, criptografia de tokens, consentimento e exclusão de dados.

## Modelo de dados (reuso)
A Fase 2 já modelou `extratos_bancarios`, `transacoes_bancarias` e `regras_conciliacao`. A
integração Open Finance apenas substituiria a **origem** das transações (de upload OFX para
sincronização via provedor), mantendo o restante do fluxo (sugestões + confirmação manual).

## Esforço estimado (alto nível)
- Integração com 1 provedor + consentimento: médio.
- Webhooks + sincronização incremental: médio.
- Governança/LGPD/segurança de tokens: médio.
