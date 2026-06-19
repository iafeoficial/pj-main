# Context.md — Plataforma Financeira PJ

Documento de contexto do projeto: o que é, como foi construído, decisões, estado atual e como rodar.
Serve como visão geral única (resumo de `CLAUDE.md`, `docs/` e dos arquivos `TAREFAS_*.md`).

> Projeto criado do zero a partir de `PROJETO_FINANCEIRO_PJ_MASTER.md`, implementado **por fases**,
> validando build + lint a cada etapa (regra de ouro do master).

---

## 1. Visão geral

Plataforma web de **gestão financeira para empresas (PJ)**, **multiempresa** e **multiusuário**, cobrindo
do núcleo financeiro à operação (compras/vendas/estoque), com backend real (Supabase), autenticação e
controle de acesso por papéis (RBAC).

- **Diretório:** `/Users/brunofernadesdealmeida/Documents/projeto_cursor/financas_pj_app`
- **Idioma da UI:** português (pt-BR); valores em BRL.
- **Status:** Fases 1–5 do roadmap + transversais (Auth, RBAC, multiusuário) concluídos. Alguns itens
  fiscais/integrações ficaram **planejados** (exigem provedor/credenciais externas) — ver seção 9.

---

## 2. Stack

- **Frontend:** Vite + React 18 + TypeScript (SPA), React Router.
- **Estilo:** Tailwind CSS v3 (design tokens em `src/index.css`, estética shadcn) + lucide-react (ícones).
- **Gráficos:** Recharts. **Datas:** date-fns. **OCR:** tesseract.js (lazy). **Cliente DB:** @supabase/supabase-js.
- **Backend:** **Supabase** (Postgres + Auth + RLS). Schema versionado em `supabase/migrations/`.

---

## 3. Como rodar

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check (tsc -b) + build de produção
npm run lint      # ESLint (deve passar sem erros)
npm run preview   # servir o build
```

Variáveis de ambiente (`.env`, baseado em `.env.example`):
```
VITE_SUPABASE_URL=https://wtsolaqeidphgtgcfvnr.supabase.co
VITE_SUPABASE_ANON_KEY=<anon/public key>
```

Primeiro acesso: tela de **login** → entrar/cadastrar → **Cadastros → Empresas → Carregar demonstração**
para popular dados de exemplo (empresa, categorias, contas, extrato, fornecedor/cliente/produto).

> Observação: novos cadastros pelo app exigem **confirmação de e-mail** (config do projeto Supabase).
> Para liberar acesso imediato em dev, criar usuário no painel **Authentication → Users → Add user**
> com **"Auto Confirm User"**, ou desativar **Providers → Email → "Confirm email"**.

---

## 4. Supabase

- **Projeto:** `wtsolaqeidphgtgcfvnr` (região East US/Ohio, Postgres 17).
- **Acesso a dados isolado** em `src/data/` (única parte que fala com o Supabase).
- **Migrations** (`supabase/migrations/`) aplicadas via `supabase db push`:
  - `0001_init` — schema da Fase 1 + Fase 2 (financeiro + conciliação) + RLS por dono.
  - `0002_documentos` — Fase 3 (documentos NF-e/boleto).
  - `0003_certificados` — Fase 4 (certificados digitais — metadados).
  - `0004_operacao` — Fase 5 (cadastros, estoque, compras, vendas, CRM).
  - `0005`–`0012` — Transversais: RBAC + multiusuário (membros/convites) e correções de RLS.
- Guia detalhado de setup: `docs/SUPABASE_SETUP.md`.

---

## 5. Arquitetura de pastas

```
src/
├── types/domain.ts          # entidades de domínio (tipos TS)
├── lib/                     # utilidades puras
│   ├── utils.ts             #   BRL, datas, CNPJ, cn(), monthRange...
│   ├── csv.ts               #   exportação CSV
│   ├── ofx.ts               #   parser de extrato OFX
│   ├── nfe.ts               #   parser de NF-e (XML)
│   ├── boleto.ts            #   parser de linha digitável de boleto
│   ├── ocr.ts               #   OCR assistido (tesseract.js lazy)
│   ├── rbac.ts              #   papéis e capabilities (can/canWrite)
│   └── supabase.ts          #   cliente Supabase (opcional via env)
├── data/                    # CAMADA DE DADOS (Supabase) — assíncrona
│   ├── db.ts                #   CRUD genérico + conversão camelCase<->snake_case
│   ├── repos.ts             #   tabelas por entidade (OwnedTable/GlobalTable)
│   ├── audit.ts             #   log de auditoria + usuário atual
│   ├── services.ts          #   financeiro: empresas, categorias, centros, contas
│   ├── analytics.ts         #   dashboard, fluxo de caixa, relatórios, DRE
│   ├── conciliacao.ts       #   extratos, transações, regras, motor de sugestões
│   ├── documentos.ts        #   NF-e/boleto → conta a pagar
│   ├── contabil.ts          #   baixas → lançamentos contábeis (D/C)
│   ├── certificados.ts      #   certificados digitais (metadados)
│   ├── cadastros.ts         #   fornecedores, clientes, vendedores
│   ├── estoque.ts           #   produtos + movimentações (custo médio)
│   ├── operacao.ts          #   compras, vendas, CRM, comissões
│   ├── membros.ts           #   membros + convites (multiusuário)
│   └── seed.ts              #   dados de demonstração
├── hooks/useAsyncData.ts    # carrega dados async e revalida por deps (version)
├── context/
│   ├── AuthContext.tsx      # sessão Supabase (signIn/signUp/signOut)
│   └── EmpresaContext.tsx   # empresa ativa, papel do usuário, version/bumpData
├── components/              # AppShell (layout+nav), seletor de empresa, RequireEmpresa, UI/
│   └── ui/                  #   Modal, Field, Toast, StatusBadge, ConfirmDialog, EmptyState, PageHeader
├── features/                # ContasModule (pagar/receber), ItensEditor, SimpleCrud
└── pages/                   # uma página por rota (+ LoginPage)
```

### Padrões importantes
- **Isolamento por empresa:** telas nunca falam com o Supabase direto — usam os `*Service` (assíncronos),
  que recebem `empresaId` e geram **auditoria**.
- **Leitura nas telas:** `useAsyncData(fn, [empresaId, version], inicial)`; após mutações chamar
  `bumpData()` do `useEmpresa()` para revalidar.
- **Telas financeiras/operacionais** são embrulhadas em `<RequireEmpresa>`.
- **Conversão de chaves:** `db.ts` converte automaticamente camelCase (TS) ↔ snake_case (Postgres).

---

## 6. Autenticação, RBAC e multiusuário

- **Auth:** Supabase Auth (e-mail/senha). Login obrigatório — gate em `App.tsx`. Logout no rodapé.
- **Multiempresa:** dados isolados por empresa; seletor de empresa ativa no topo.
- **Multiusuário:** tabela `empresa_membros` (vários usuários por empresa). **Convites por e-mail**
  (`convites`) aceitos pelo próprio usuário (RPC `accept_invite`), sem backend.
- **RBAC (7 papéis):** Administrador, Financeiro, Gestor, Comprador, Vendedor, Contador, Consulta.
  - **RLS:** leitura para qualquer membro; **escrita** só para papéis operacionais (Contador/Consulta =
    somente leitura no servidor). O dono é admin implícito (via `owner_id`).
  - **UI:** `lib/rbac.ts` define capabilities por papel; a navegação mostra só os módulos permitidos;
    há **banner de somente-leitura** e o papel aparece no rodapé.
  - **Gestão:** página **Equipe** (`/equipe`, admin) — convidar, trocar papel, remover. Aceitar convite:
    página **Empresas**.
- **Nota de segurança:** a granularidade fina **módulo×papel** (ex.: Comprador só Compras) é aplicada na
  **UI**; no servidor a RLS garante multi-tenant + leitura/escrita por papel. Endurecer por módulo no RLS
  é um próximo passo opcional. Detalhes em `docs/DECISOES_TECNICAS.md` (ADR-009/010).

---

## 7. Funcionalidades por fase

### Fase 1 — Núcleo Financeiro
Multiempresa (CNPJ validado), **Categorias** (receita/despesa), **Centros de custo**, **Contas a pagar**
e **a receber** (com baixa parcial/total, status automático de vencimento, cancelamento), **Dashboard**
(saldo, projetado, a pagar/receber, receitas/despesas do mês, inadimplência), **Fluxo de caixa**,
**Relatórios** (por categoria/centro/cliente/fornecedor, com CSV) e **Auditoria** de todas as ações.

### Fase 2 — Conciliação Bancária (+ backend)
Importação de **OFX** (parser próprio, dedupe por FITID), **motor de sugestões** (valor, data, histórico,
documento) cruzando com títulos, **confirmação manual** (com baixa do título) e **regras** de
categorização. Aqui o backend migrou de `localStorage` para **Supabase** (Auth + Postgres + RLS).

### Fase 3 — Documentos
**DRE** (Demonstração do Resultado), **importação de NF-e (XML)** → revisão → conta a pagar,
**boletos** (parser determinístico da linha digitável + **OCR** assistido de imagem). *Open Finance*
ficou planejado (ver seção 9).

### Fase 4 — Fiscal
**Exportação contábil** (lançamentos D/C em CSV para o contador) e **cadastro de certificado digital**
(metadados + alerta de validade; sem chave privada). *Emissão NFS-e/NF-e* e *SPED* ficaram planejados.

### Fase 5 — Operação
**Cadastros** (Fornecedores, Clientes, Vendedores), **Estoque** (Produtos + movimentações com saldo e
**custo médio**), **Compras** (pedido → aprovar → receber, gerando **conta a pagar** + entrada de estoque),
**Vendas** (orçamento/pedido → faturar, gerando **conta a receber** + saída de estoque + **comissão**),
**CRM** (oportunidades por estágio) e **Comissões** (relatório por vendedor).

### Transversais
**RBAC** + **multiusuário** (ver seção 6).

---

## 8. Modelo de dados (tabelas principais)

- **Núcleo:** `empresas`, `categorias`, `centros_custo`, `contas_pagar`, `contas_receber`, `audit_logs`.
- **Conciliação:** `extratos_bancarios`, `transacoes_bancarias`, `regras_conciliacao`.
- **Documentos/Fiscal:** `documentos`, `certificados`.
- **Operação:** `fornecedores`, `clientes`, `vendedores`, `produtos`, `estoque_movimentos`,
  `pedidos_compra`(+`pedido_compra_itens`), `pedidos_venda`(+`pedido_venda_itens`), `oportunidades`.
- **Acesso:** `empresa_membros`, `convites`.

Todas as tabelas de negócio têm `empresa_id`, RLS (isolamento por membership), triggers de `updated_at`
e índices. Funções de apoio: `user_is_member`, `user_can_write`, `user_has_role`, `accept_invite`.

---

## 9. Itens planejados (não implementados — exigem terceiros)

| Item | Por que está planejado | Doc |
|---|---|---|
| **Open Finance** | Requer provedor certificado pelo BC + consentimento | `docs/OPEN_FINANCE.md` |
| **Emissão NFS-e/NF-e** | Requer certificado A1 server-side + provedor homologado + backend de assinatura | `docs/FISCAL.md` |
| **SPED** | Requer camada fiscal completa (NF-e com itens/CFOP/tributos, plano de contas) | `docs/SPED.md` |

Cada um tem o caminho de implementação documentado. A ponte prática hoje: **OFX** (conciliação) e
**Exportação Contábil** (para o contador).

---

## 10. Estado de validação

- `npm run build` ✅ e `npm run lint` ✅ (0 erros/avisos) ao final de cada fase.
- Fluxos críticos validados contra o Supabase real (auth, CRUD, RLS, cascade, RBAC, conciliação/operação)
  via smoke tests com usuário autenticado.
- Dados isolados por empresa e por membership comprovados (consulta anônima retorna vazio).

---

## 11. Documentação relacionada

- `CLAUDE.md` — guia para desenvolvimento (arquitetura, convenções, regras).
- `README.md` — apresentação e como rodar.
- `docs/PRD.md`, `docs/ROADMAP.md`, `docs/DECISOES_TECNICAS.md` (ADRs), `docs/CHECKPOINTS.md`.
- `docs/SUPABASE_SETUP.md`, `docs/OPEN_FINANCE.md`, `docs/FISCAL.md`, `docs/SPED.md`.
- Planos de execução por fase: `TAREFAS.md`, `TAREFAS_FASE2.md` … `TAREFAS_FASE5.md`, `TAREFAS_TRANSVERSAIS.md`.
- Documento-mãe: `PROJETO_FINANCEIRO_PJ_MASTER.md` (e cópia em `docs/`).

---

## 12. Próximos passos sugeridos

- LGPD (consentimento, exportação/exclusão de dados, logs de acesso).
- Alçadas de aprovação por valor (ex.: compras acima de X exigem gestor/diretor).
- Endurecer RLS por módulo×papel.
- Integração com provedor para Emissão Fiscal / Open Finance.
- Lançamentos recorrentes e alertas (vencimento, saldo negativo, inadimplência).
