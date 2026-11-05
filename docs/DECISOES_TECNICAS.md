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

## ADR-020 — OFX pode originar Conta a Pagar/Receber
**Decisão:** além de conciliar com título existente, a Conciliação permite **Lançar**
uma linha do extrato como novo título: débito → Contas a Pagar, crédito → Contas a
Receber, **já baixado** na data do banco. Exclusão do título (UI ou banco) reabre a
transação OFX como `pendente` (service `reativarTransacoesPorTitulo` + triggers
`BEFORE DELETE` em `contas_pagar` / `contas_receber`). Desfazer a conciliação
estorna a baixa: o título pago ou recebido volta a aberto e sai dos totais do
dashboard.
**Motivo:** o extrato sozinho não gerava lançamento; sem título prévio a fila ficava
presa em Pendente. Apagar o título por engano não pode “sumir” com o movimento do OFX.
Desfazer a linha do extrato sem reabrir o título deixava o valor pago no dashboard.
**Implementação:** `conciliacaoService.lancarDeTransacao` / `lancarPendentes`;
`src/data/transacaoVinculo.ts`; migration `0021_reativar_transacao_ao_apagar_titulo.sql`;
UI em `ConciliacaoPage`.

## ADR-019 — Repetição com período específico (N dias)
**Decisão:** valor `personalizada` no enum `recorrencia_tipo` + coluna
`contas_pagar.recorrencia_dias` (1–365). Na UI, opção “Período específico” com
campo “A cada (dias)”. `avancarRecorrencia` soma esses dias entre ocorrências.
**Motivo:** além de semanal/mensal etc., o usuário precisa de intervalos livres
(ex.: 12 ou 20 dias).
**Implementação:** migration `0020_recorrencia_personalizada.sql`; tipo em
`domain.ts`; `ParcelasRepeticaoFields`; `contaPagarService.create`.

## ADR-018 — Favorecido unificado + CNPJ alfanumérico
**Decisão:** no lançamento (Contas a Pagar/Receber), o dropdown de vínculo lista
**clientes e fornecedores juntos** (rótulo Cliente / Fornecedor / ambos). CPF/CNPJ
opcional no passo do favorecido; se nome+documento forem novos, cria cadastro no
tipo preferencial do módulo (`pessoaCadastro`). CNPJ aceita formato **alfanumérico**
(IN RFB 2.229/2024): 12 chars A–Z/0–9 + 2 DVs numéricos; validação módulo 11 com
valor ASCII−48 (`formatCNPJ` / `isValidCNPJ` em `lib/utils.ts`).
**Motivo:** a mesma pessoa pode ser cliente e fornecedor; o CNPJ novo da Receita
já emite letras e a máscara só-dígitos quebrava o cadastro.
**Implementação:** `ContasModule` (lista unificada + campos PF/PJ); `masks.formatCpfCnpj`;
`ParceiroForm` / `EmpresasPage` com `inputMode=text` e uppercase.

## ADR-019 — Conta financeira também em Contas a Receber
**Decisão:** coluna `contas_receber.conta_financeira_id` (FK opcional), espelhando
`contas_pagar`. UI em Contas a Receber e no modal Lançar (OFX) para crédito e débito.
**Motivo:** no recebimento é preciso registrar em qual conta o valor entrou; no pagamento,
de onde saiu.
**Implementação:** migration `0022_contas_receber_conta_financeira.sql`; tipo `ContaReceber`;
`ContasReceberPage` com `usaContaFinanceira`; `lancarDeTransacao` grava em ambos os lados.

## ADR-020 — Importação de clientes e fornecedores por planilha
**Decisão:** a tela de Fornecedores e a de Clientes leem um `.xlsx` no formato do export
IAFÉ (colunas Tags, CNPJ/CPF, Razão Social). A tag define o destino: Fornecedor, Cliente
ou os dois cadastros. Linha sem tag não é gravada. Duplicata (mesmo CPF/CNPJ na empresa,
ou o mesmo nome quando não há documento) é pulada. O preview confirma antes de gravar.
**Motivo:** trazer o cadastro já existente sem redigitar, e usar esses registros nos
mesmos fluxos de contas a pagar, a receber e conciliação.
**Fora do cadastro:** banco, agência, conta, IE, inscrição municipal, crédito e demais
colunas fiscais da planilha (ADR-012). A gravação usa `clienteService` / `fornecedorService`.
**Implementação:** `src/lib/parceiroPlanilha.ts` (dependência `xlsx` só para ler o arquivo
no browser); botão em `ParceiroCrud`.

## ADR-021 — Importação da movimentação da conta corrente
**Decisão:** Contas a Pagar e Contas a Receber leem o `.xlsx` da IAFÉ com as colunas
Situação, Data, Cliente ou Fornecedor, Conta Corrente, Grupo, Categoria, Valor (R$) e
Observações. Valor negativo vira conta a pagar; positivo, conta a receber. Conta corrente,
grupo, categoria e o nome do parceiro são criados se faltarem. O preview confirma antes de
gravar. Não há coluna nova: situação vira `status` (texto original em `observacao`), data
vira competência/vencimento (e baixa, se quitado), conta corrente vira `conta_financeira_id`.
**Motivo:** receber o histórico do sistema antigo no mesmo lançamento já usado no dashboard,
fluxo e conciliação, sem migration.
**Implementação:** `src/lib/movimentacaoPlanilha.ts` e `src/data/importacaoFinanceira.ts`;
botão em `ContasModule`.

## ADR-022 — Transferência entre contas é neutra
**Decisão:** transferência entre contas da mesma empresa fica na tabela
`transferencias_contas` (origem, destino, data, valor, observação) e não gera
conta a pagar nem a receber. Título já lançado pode ser marcado com
`transferencia`; nesse caso sai dos totais da lista, do dashboard, do fluxo,
da DRE, dos relatórios, da exportação contábil e das sugestões de conciliação,
e passa a aparecer na página `/transferencias` com o nome do lançamento.
A linha continua visível para desmarcar. Nada é apagado automaticamente.
**Motivo:** mover dinheiro de uma conta para outra não é despesa nem receita.
**Implementação:** migration `0023_transferencias_contas.sql`; página
`/transferencias`; ação na lista de [`ContasModule`](src/features/contas/ContasModule.tsx).

## ADR-023 — Parceiro ligado ao título
**Decisão:** `contas_pagar.fornecedor_id` e `contas_receber.cliente_id` são opcionais
e somem se o cadastro for excluído. CPF/CNPJ e telefone não são copiados para a conta:
a lista lê o cadastro pelo id ou, enquanto não houver id, pelo nome. Ao editar o
cadastro, o nome novo substitui o antigo nas contas que casaram e o id fica gravado.
Vendas e CRM acompanham o `cliente_id`; compras acompanham o `fornecedor_id`.
**Motivo:** mudar o nome, o documento ou o telefone no cadastro precisa aparecer
nas contas já lançadas, sem duplicar documento e telefone em cada título.
**Implementação:** migration `0024_parceiro_nos_titulos.sql`;
`clienteService.update` e `fornecedorService.update` em `src/data/cadastros.ts`;
página `/parceiros`.

## ADR-024 — CPF/CNPJ único no cadastro do parceiro
**Decisão:** em cada empresa, um CPF (11) ou CNPJ (14) só pode existir uma vez em
`clientes` e uma vez em `fornecedores`. A comparação ignora pontuação. Documento
vazio ou incompleto não entra na regra. O `id` continua sendo o uuid: o documento
pode ser corrigido, e a mesma pessoa pode ser cliente e fornecedor.
**Motivo:** gravar a Denise de novo, com o mesmo CPF, não pode criar outro cadastro.
**Implementação:** migration `0025_documento_unico_parceiro.sql`;
`exigirDocumentoLivre` em `src/data/cadastros.ts`.

## ADR-025 — Extrato conciliado como transferência
**Decisão:** na conciliação, uma linha pendente pode virar transferência entre contas.
O formulário pede conta de origem e conta de destino, como em `/transferencias`.
A linha fica conciliada e ligada a `transferencias_contas`. Desfazer ou apagar a
transferência devolve a linha do extrato para pendente. Não nasce conta a pagar
nem a receber.
**Motivo:** um rendimento ou TED no extrato pode ser só movimento entre contas
da mesma empresa.
**Implementação:** migration `0026_transacao_transferencia.sql`;
`conciliacaoService.lancarTransferencia` em `src/data/conciliacao.ts`.

## ADR-026 — E-mail @iafeoficial.com entra na IAFE TECNOLOGIA
**Decisão:** quem se cadastra com e-mail `@iafeoficial.com` vira administrador da empresa
`IAFE TECNOLOGIA LTDA`, a mesma em que a Denise já lançou o movimento. Outros domínios
continuam sem esse acesso e entram só por convite.
**Motivo:** uma conta nova da IAFE não pode abrir uma empresa vazia e deixar de ver as
contas que já existem.
**Implementação:** migration `0027_acesso_email_iafe.sql` (backfill, trigger no cadastro
e RPC `vincular_email_iafe_atual`); chamada em `EmpresaContext` ao entrar.

## ADR-027 — Parcelamento e repetição em Contas a Receber
**Decisão:** `contas_receber` ganha as mesmas colunas de série de `contas_pagar`
(`parcela_numero`/`parcela_total`/`grupo_parcelamento`, `recorrencia`/`recorrencia_dias`/
`grupo_recorrencia`). Na criação, N parcelas dividem o valor em títulos mensais; a
repetição gera títulos futuros. Desconto, juros, NF, impostos e histórico de baixa
continuam só em pagar.
**Motivo:** o recebimento também chega parcelado (ex.: entrada de capital em 3x).
**Implementação:** migration `0028_contas_receber_parcelas.sql`;
`contaReceberService.create`; aba “Parcelas / repetição” no ContasModule.

## ADR-028 — Vencimento em dia útil
**Decisão:** na criação de contas a pagar e a receber (título único, parcelas e
repetição), o vencimento que cair em sábado, domingo ou feriado nacional pode
**atrasar**, **antecipar** ou **manter**. Padrão: atrasar. Feriados nacionais
são calculados (fixos + móveis pela Páscoa). A empresa cadastra estaduais e
municipais em `/feriados` (`repete_anual`). Se o dia 30/31 não existe no mês
(fevereiro, abril etc.), usa o último dia do mês; o ajuste de dia útil **não
sai desse mês**. Só o vencimento muda; a competência permanece.
**Implementação:** `src/lib/diaUtil.ts`; migration `0029_feriados.sql`;
`feriadoService`; aba Parcelas no ContasModule e na conciliação. Na criação,
`montarSimulacao` lista cada título (valor, vencimento, dia da semana, competência);
valor e vencimento são editáveis e `create` grava essa lista (`simulacao`) em vez
de gerar de novo. Sem coluna nova.

## ADR-029 — Filtros persistentes e tipo na importação OFX
**Decisão:** os filtros de Contas a Pagar/Receber (período, busca, status) ficam no
`localStorage` do navegador, chave por empresa e lado, até o usuário mudar. Na
importação OFX o usuário informa se o extrato é **conta corrente** (padrão) ou
**cartão**; vários arquivos na mesma seleção recebem o mesmo tipo. Coluna
`extratos_bancarios.conta_tipo` (enum `conta_financeira_tipo`). Não há FK para
`contas_financeiras`: o vínculo com a conta cadastrada continua na hora de lançar
ou transferir. `contaDoExtrato` prefere contas daquele tipo e cai no número do OFX.
**Motivo:** o período de trabalho se perde ao sair da tela; o OFX não diz se é
conta ou fatura, e o lote de arquivos costuma ser da mesma origem.
**Implementação:** `usePersistedState`; `ContasModule`; migration
`0030_extrato_conta_tipo.sql`; modal em `ConciliacaoPage`.

## ADR-030 — Importação de NFS-e (XML) em Contas a Pagar/Receber
**Decisão:** Contas a Pagar e Contas a Receber aceitam XML de NFS-e nacional (sped 1.01).
A empresa ativa deve ser **tomador** na tela de pagar e **emitente/prestador** na de receber;
caso contrário o XML é rejeitado. A chave (`infNFSe@Id`) é única por empresa em
`documentos.documento` (índice parcial). `nNFSe` vai para `numero_nf` do título (exibição).
Valor do lançamento = `vLiq`. Documento tipo `nfse` pode vincular `conta_pagar_id` ou
`conta_receber_id`. Confirmação manual (categoria/vencimento) antes de gravar.
**Motivo:** evitar lançamento duplicado e garantir que a nota pertence à empresa na
vertente fiscal correta.
**Implementação:** `src/lib/nfse.ts`; migration `0031_nfse_documentos.sql`;
`documentoService` + botão Importar XML no ContasModule.

## ADR-031 — Convite de equipe envia e-mail
**Decisão:** o convite continua sendo uma linha em `convites`. A Edge Function
`enviar-convite` dispara o e-mail do Auth (convite de usuário novo, ou magic link
se o e-mail já tem conta). Ao entrar, `aceitar_meus_convites_pendentes` aceita
sozinho os convites daquele e-mail — o link do e-mail já entra na empresa, sem
passo extra em Empresas. Ainda há **Reenviar** e o bloco em Empresas.
**Motivo:** gravar só no banco fazia o toast dizer “enviado” sem cair na caixa;
o magic link autenticava e a pessoa via só a empresa antiga.
**Implementação:** `supabase/functions/enviar-convite`; migrations `0032`/`0033`;
`conviteService` + `EmpresaContext.refreshEmpresas`.

## ADR-032 — DRE visual (waterfall + detalhe YoY)
**Decisão:** a tela DRE segue o layout do manual (waterfall Receita→Lucro líquido e tabela com
% da receita, variação vs. período equivalente do ano anterior e sparkline mensal). Os filtros
Início/Fim permanecem. CMV / despesas operacionais / impostos são classificados pelo **nome**
do grupo/categoria (heurística), sem coluna nova no schema — o restante das despesas cai em opex.
**Motivo:** espelhar a identidade visual sem inventar números; o cálculo continua em cima de
contas a pagar/receber por competência.
**Implementação:** `getDRE` em `analytics.ts`; `DREPage.tsx`.

## ADR-006 — Invalidação de cache via `version`/`bumpData`
**Decisão:** leituras são memoizadas com dependência em `version` do `EmpresaContext`; mutações
chamam `bumpData()` para incrementá-lo.
**Motivo:** com persistência síncrona em `localStorage`, esse contador é suficiente para refazer as
leituras após escrever, sem uma camada de cache mais complexa (ex.: React Query) nesta fase.
