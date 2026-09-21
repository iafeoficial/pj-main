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

## ADR-011 — CRM integrado a cadastros e vendas
**Decisão:** a tabela `oportunidades` passa a ter `cliente_id`, `vendedor_id` e `pedido_venda_id`
(FKs opcionais). A UI seleciona cliente/vendedor dos cadastros; o estágio "ganho" pode gerar um
pedido de venda via `oportunidadeService.converterParaVenda`.
**Motivo:** alinhar repo e Supabase (migration `0013_crm_integracao`), fechar o pipeline comercial
(CRM → Venda → Financeiro) e permitir links cruzados entre módulos.
**Consequência:** `clienteNome` permanece como denormalização para exibição e oportunidades legadas
sem FK continuam funcionando.

## ADR-012 — Cadastros enriquecidos (operacional BR, sem fiscal avançado)
**Decisão:** enriquecer cadastros de parceiros (clientes/fornecedores), vendedores, produtos,
empresas e CRM com dados operacionais brasileiros: tipo PF/PJ, contato, endereço com CEP
(ViaCEP no frontend), observações; CRM com previsão de fechamento e fonte do lead.
**Fora de escopo nesta fase:** Inscrição Estadual/Municipal, NCM/CEST/CFOP e campos de emissão
NF-e (fase fiscal futura).
**Implementação:** migration `0015_cadastros_enriquecidos.sql`; tipos em `domain.ts`
(`Endereco`, `TipoPessoa`, `FonteLead`); formulário compartilhado `ParceiroForm` +
`EnderecoFields`; busca CEP via API pública ViaCEP (sem dependência npm).

## ADR-013 — Contas e Cartões coexistem com Centro de Custo
**Decisão:** criar a entidade `ContaFinanceira` (`contas_financeiras`), com `tipo`
(`conta_corrente` | `cartao_credito`), dados bancários (agência/conta), dados de cartão
(bandeira/dia de vencimento da fatura), titular/responsável e saldo de abertura opcional.
Em `contas_pagar` foi adicionada a FK **nullable** `conta_financeira_id`; `centro_custo_id`
**permanece** — as duas dimensões são complementares (centro de custo = rateio gerencial;
conta/cartão = meio de pagamento).
**Motivo:** a planilha de referência lança despesas por conta/cartão, e o vencimento de despesas de
cartão segue o ciclo da fatura, não a data da compra. Remover centro de custo quebraria relatórios
e DRE já existentes.
**Implementação:** migration `0016_contas_financeiras.sql` com RLS no padrão das demais tabelas
filhas (`_sel` por `user_is_member`, `_wr` por `user_can_write`); `contaFinanceiraService` em
`src/data/services.ts`; página `/contas-cartoes` (capacidade `cadastros`). Ao escolher um cartão no
Contas a Pagar, o vencimento é sugerido no **próximo ciclo da fatura** (`proximoVencimentoFatura`
em `src/lib/fatura.ts`); a sugestão é apenas um valor padrão e pode ser editada. Titular:
ver ADR-017.

## ADR-014 — Contas a Pagar: extras financeiros (Fase 2)
**Decisão:** estender `contas_pagar` com desconto, juros, nº da NF, impostos retidos (JSON),
parcelamento (`grupo_parcelamento` + nº/total) e repetição (`recorrencia` + `grupo_recorrencia`).
Histórico de baixas em tabela `pagamentos_conta`. Contas a Receber **fora do escopo**.
**Motivo:** fechar o bloco da planilha de referência sem alterar o fluxo de receber.
**Implementação:** migration `0017_contas_pagar_extras.sql`; `valorDevido` =
bruto − desconto + juros − impostos retidos; pagamento avulso grava linha em `pagamentos_conta`
e usa status `parcial`/`paga`. UI em abas no ContasModule (`extrasPagar`).

## ADR-015 — Grupos de categoria e DRE hierárquica
**Decisão:** entidade `CategoriaGrupo` (`categoria_grupos`) separada das categorias-folha;
`categorias.grupo_id` nullable. Lançamentos usam só categorias; a DRE agrupa
grupo → categorias → total (sem grupo = bloco "Sem grupo").
**Motivo:** espelhar a planilha (ex.: Despesas Administrativas contendo folhas) sem misturar
grupos no select de Contas a Pagar/Receber.
**Implementação:** migration `0018_categoria_grupos.sql`; `categoriaGrupoService`; UI em
Categorias; `getDRE` / `DREPage` com hierarquia.

## ADR-016 — CPF/CNPJ do favorecido opcional (sem API Receita)
**Decisão:** manter `cnpjCpf` opcional em fornecedor/cliente; cadastro sempre manual.
Consulta à Receita/Serpro **não** integrada nesta leva — botão desabilitado
("Buscar na Receita (em breve)") no `ParceiroForm`, pronto para plugar provedor depois.
**Motivo:** fechar o pedido da planilha sem custo de API; o formulário não muda quando
houver chave.

## ADR-017 — Titular / responsável em Contas e Cartões
**Decisão:** coluna `titular` (text, default `''`) em `contas_financeiras`. Na UI de cartão o
campo é **obrigatório** (rótulo "Titular / responsável"); em conta corrente fica opcional.
Selects de Contas a Pagar usam `labelContaFinanceira` (ex.: `Visa (Fatura) — Titular Ana`).
**Motivo:** a planilha e o uso real exigem saber quem responde pelo cartão; o cadastro anterior
só tinha bandeira/dia da fatura e o cartão ficava pouco distinto na lista.
**Implementação:** migration `0019_contas_financeiras_titular.sql`; tipo em `domain.ts`;
helper `src/lib/contaFinanceira.ts`; formulário com seção dedicada de cartão em
`ContasCartoesPage`.

## ADR-006 — Invalidação de cache via `version`/`bumpData`
**Decisão:** leituras são memoizadas com dependência em `version` do `EmpresaContext`; mutações
chamam `bumpData()` para incrementá-lo.
**Motivo:** com persistência síncrona em `localStorage`, esse contador é suficiente para refazer as
leituras após escrever, sem uma camada de cache mais complexa (ex.: React Query) nesta fase.
