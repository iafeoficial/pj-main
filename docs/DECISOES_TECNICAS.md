# Decisões Técnicas (ADR)

Registro das decisões relevantes. Regra do master: não modificar schema/tipos sem registrar aqui.

## ADR-001 — Stack do frontend
**Decisão:** Vite + React 18 + TypeScript + Tailwind CSS v3 + React Router + Recharts.
**Motivo:** mesma família tecnológica do projeto irmão `financas_app` (React/Vite/TS/Tailwind/
shadcn), maximizando familiaridade e reaproveitamento futuro de componentes. Recharts cobre os
gráficos do dashboard e fluxo de caixa sem dependências pesadas.

## ADR-002 — Persistência local (localStorage) nesta fase
**Decisão:** os dados da Fase 1 são persistidos em `localStorage`, isolados em `src/data/`.
**Motivo:** entregar um MVP **funcional e executável imediatamente**, sem exigir provisionamento
de banco/credenciais. Toda a persistência fica atrás de `storage.ts` + repositórios, de modo que a
troca por Supabase/Postgres na Fase 2 afete apenas a camada `src/data/`, sem mudar as telas.
**Consequência:** dados ficam no navegador do usuário; sem multiusuário real ainda.

## ADR-003 — Isolamento multiempresa via `OwnedRepository`
**Decisão:** entidades de negócio estendem `OwnedEntity` (têm `empresaId`) e são acessadas por um
`OwnedRepository` que filtra por `empresaId` em toda operação.
**Motivo:** garantir o princípio "dados isolados por CNPJ" desde o início, de forma centralizada e
difícil de burlar a partir das telas.

## ADR-004 — Status `vencida` derivado em tempo de leitura
**Decisão:** o status `vencida` não é gravado; é calculado na leitura quando há saldo em aberto e o
vencimento já passou (`withDerivedPagarStatus` / `withDerivedReceberStatus`).
**Motivo:** evita jobs/cron para "virar" o status e mantém os dados sempre consistentes com a data
atual.

## ADR-005 — Camada de serviços com auditoria embutida
**Decisão:** as telas usam apenas `*Service` (`src/data/services.ts`); cada mutação relevante grava
um `AuditLog`.
**Motivo:** cumprir o princípio "toda ação relevante gera auditoria" sem espalhar essa
responsabilidade pelas telas.

## ADR-007 — Backend: novo projeto Supabase exclusivo (Fase 2)
**Decisão:** provisionar um **projeto Supabase novo e dedicado** ao `financas_pj_app`, em vez de
reaproveitar o Supabase do projeto irmão `financas_app` (`dlbiwguzbiosaoyrcvay`).
**Motivo:** o `financas_app` é outro produto (IAFÉ Finanças), com schema próprio, 43 migrations e
edge functions de outro domínio (Asaas, agendamentos). Compartilhar o projeto causaria colisão de
schema e risco a dados de produção.
**Implementação:** schema versionado em `supabase/migrations/0001_init.sql` (Fase 1 + Fase 2) com
**RLS por dono** (`empresas.owner_id = auth.uid()` e `user_owns_empresa()` nas tabelas filhas).
Cliente em `src/lib/supabase.ts`, opcional: se as env vars não existirem, a app roda na camada
local. A troca da origem de dados (local → Supabase) e a autenticação serão uma tarefa dedicada,
feita após o recebimento de `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. Ver `SUPABASE_SETUP.md`.

## ADR-008 — Conciliação Bancária sobre a camada local (transição)
**Decisão:** a feature da Fase 2 (importação OFX, motor de regras, sugestões e confirmação manual)
é construída sobre a camada de dados local atual, com tipos/repositórios isolados em `src/data/`.
**Motivo:** entregar e **validar a funcionalidade imediatamente** (sem depender das credenciais do
Supabase), mantendo o acesso a dados isolado para que a migração ao Supabase seja contida. O schema
correspondente já está nas migrations (`extratos_bancarios`, `transacoes_bancarias`,
`regras_conciliacao`), garantindo paridade.

## ADR-009 — Multiusuário por empresa (membership) substitui dono único
**Decisão:** o isolamento deixou de ser por `empresas.owner_id` e passou a ser por **membros**
(`empresa_membros`), permitindo vários usuários por empresa. Convites por e-mail (`convites`) são
aceitos pelo próprio usuário (RPC `accept_invite`), sem necessidade de backend/admin API.
**Implementação:** o `owner_id` é mantido como fallback (dono é sempre membro/admin implícito em
`empresas`); um trigger cria a membership de administrador do dono ao criar a empresa; backfill criou
memberships para empresas existentes. Ver migrations `0005`–`0012`.

## ADR-010 — RBAC: leitura por membership, escrita por papel; granularidade fina na UI
**Decisão:** a RLS garante (a) **leitura** para qualquer membro da empresa e (b) **escrita** apenas
para papéis operacionais (`user_can_write`: administrador/financeiro/gestor/comprador/vendedor) —
Contador e Consulta são **somente leitura no servidor**. A granularidade por módulo×papel (ex.:
Comprador só Compras) é aplicada na **camada de UI** (`lib/rbac.ts` + navegação), não na RLS.
**Motivo:** cobrir o RBAC do master com segurança real onde mais importa (multi-tenant + leitura/escrita)
sem reescrever políticas por papel em ~20 tabelas. Endurecer por módulo no RLS fica como evolução.
**Aprendizado técnico:** no Supabase, funções `SECURITY DEFINER` **ignoram RLS internamente** (bom para
quebrar recursão de políticas), mas as políticas devem evitar recursão mútua entre `empresas` e
`empresa_membros` — por isso os helpers consultam apenas `empresa_membros` e `empresas_select` usa
`owner_id` inline + `user_is_member`.

## ADR-006 — Invalidação de cache via `version`/`bumpData`
**Decisão:** leituras são memoizadas com dependência em `version` do `EmpresaContext`; mutações
chamam `bumpData()` para incrementá-lo.
**Motivo:** com persistência síncrona em `localStorage`, esse contador é suficiente para refazer as
leituras após escrever, sem uma camada de cache mais complexa (ex.: React Query) nesta fase.

## ADR-008 — Convites in-app (token + link, sem e-mail)
**Decisão:** convites de equipe usam coluna `token` em `convites` e link copiável
(`/empresas?convite=TOKEN`); aceite via RPC `accept_invite` / `accept_invite_by_token`.
**Motivo:** envio de e-mail exige SMTP/Edge Function; o fluxo in-app cobre demo e equipes pequenas
com banner global e modal de aceite.

## ADR-009 — CRM integrado a clientes e vendas
**Decisão:** `oportunidades` ganha FKs opcionais `cliente_id`, `vendedor_id`, `pedido_venda_id`;
ação `gerarOrcamento` cria `pedido_venda` (orçamento) a partir da oportunidade.
**Motivo:** eliminar texto livre isolado e fechar o funil comercial até o módulo de Vendas.
