# CLAUDE.md — Plataforma Financeira PJ

Guia para o Claude Code trabalhar neste repositório. Leia antes de modificar qualquer arquivo.

## O que é
Plataforma web de **gestão financeira PJ** (multiempresa). Implementação por fases, conforme
`PROJETO_FINANCEIRO_PJ_MASTER.md`. Este repositório contém a **Fase 1 (MVP)**.

## Stack
- **Vite + React 18 + TypeScript** (SPA)
- **Tailwind CSS v3** (tokens em `src/index.css`, estilo shadcn)
- **React Router** (`src/App.tsx`)
- **Recharts** (gráficos), **lucide-react** (ícones), **date-fns** disponível
- **Backend: Supabase** (Postgres + Auth + RLS). Acesso isolado em `src/data/` (`db.ts`).
  Schema em `supabase/migrations/`. Login obrigatório (e-mail/senha). Ver `docs/SUPABASE_SETUP.md`.

## Comandos
```bash
npm install      # instalar dependências
npm run dev      # ambiente de desenvolvimento (http://localhost:5173)
npm run build    # type-check (tsc -b) + build de produção
npm run lint     # ESLint (deve terminar sem erros)
npm run preview  # servir o build de produção
```
Sempre rode `npm run build` e `npm run lint` após cada implementação (checkpoint do master).

## Arquitetura
```
src/
├── types/domain.ts        # entidades do domínio (Empresa, ContaPagar, ...)
├── lib/                   # utils puros (BRL/data, CNPJ, cn, csv, ofx, nfe, boleto, ocr) + supabase.ts
├── data/                  # CAMADA DE DADOS (única que toca o Supabase)
│   ├── db.ts              #   CRUD genérico Supabase + conversão camelCase<->snake_case
│   ├── repos.ts           #   tabelas por entidade (OwnedTable/GlobalTable)
│   ├── audit.ts           #   log de auditoria (+ usuário atual)
│   ├── services.ts        #   regras de negócio + auditoria — ASSÍNCRONO (USAR nas telas)
│   ├── analytics.ts       #   cálculos de dashboard/fluxo/relatórios/DRE (async)
│   ├── conciliacao.ts     #   Fase 2: extratos, transações, regras, motor de sugestões (async)
│   ├── documentos.ts      #   Fase 3: NF-e/boleto → conta a pagar (async)
│   ├── contabil.ts        #   Fase 4: baixas → lançamentos contábeis D/C (async)
│   ├── certificados.ts    #   Fase 4: cadastro de certificados (async)
│   ├── cadastros.ts       #   Fase 5: fornecedores, clientes, vendedores (async)
│   ├── estoque.ts         #   Fase 5: produtos + movimentações (custo médio) (async)
│   ├── operacao.ts        #   Fase 5: compras, vendas, CRM, comissões (async)
│   └── seed.ts            #   dados de demonstração (async)
├── hooks/useAsyncData.ts  # carrega dados async e revalida por deps (use `version`)
├── context/AuthContext.tsx     # sessão Supabase (signIn/signUp/signOut)
├── context/EmpresaContext.tsx  # empresa ativa + invalidação de cache (version/bumpData)
├── components/            # AppShell, seletor de empresa, UI (Modal, Field, Toast, ...)
├── features/contas/       # ContasModule genérico (pagar/receber)
└── pages/                 # uma página por rota (+ LoginPage)
```

## Regras (do master — obrigatórias)
1. Inspecionar a estrutura atual antes de modificar.
2. Não recriar componentes existentes.
3. Não alterar autenticação sem confirmação.
4. Não modificar schema/tipos sem registrar decisão em `docs/DECISOES_TECNICAS.md`.
5. Não instalar dependências sem justificar.
6. Respeitar o layout existente.
7. Trabalhar **uma feature por vez**.
8. Rodar build e lint após cada implementação.
9. Manter compatibilidade **multiempresa** (todo dado de negócio passa por `empresaId`).
10. Documentar alterações relevantes.

## Convenções
- **Isolamento por empresa**: nunca acesse o Supabase direto nas telas. Use os `*Service`
  (`src/data/`), que recebem `empresaId`, geram auditoria e são **assíncronos**.
- Leituras nas telas usam `useAsyncData(fn, [empresaId, version], inicial)`; após mutações chame
  `bumpData()` do `useEmpresa()` para revalidar.
- Telas financeiras devem ser embrulhadas em `<RequireEmpresa>`.
- A RLS no Supabase isola por dono (`auth.uid()`); login é obrigatório (gate em `App.tsx`).
- Idioma da UI: **português (pt-BR)**. Valores em BRL via `formatBRL`.

## Status
- ✅ Fase 1 (MVP): multiempresa, categorias, centro de custo, contas a pagar/receber,
  dashboard, fluxo de caixa, relatórios, auditoria.
- ✅ Fase 2: Conciliação Bancária (OFX, motor de sugestões, regras) + backend Supabase
  (Auth + Postgres + RLS).
- ✅ Fase 3: Documentos — DRE, importação de NF-e (XML), boletos (linha digitável + OCR assistido).
  Open Finance fica planejado (requer provedor certificado — ver `docs/OPEN_FINANCE.md`).
- ◑ Fase 4: Fiscal — exportação contábil (CSV D/C) e cadastro de certificado digital prontos.
  Emissão NFS-e/NF-e e SPED ficam planejados (exigem certificado A1 server-side + provedor +
  camada fiscal — ver `docs/FISCAL.md` e `docs/SPED.md`).
- ✅ Fase 5: Operação — cadastros (fornecedores/clientes/vendedores), estoque (produtos +
  movimentações com custo médio), compras (→ conta a pagar + estoque), vendas (→ conta a receber +
  estoque + comissão), CRM e comissões. Tudo integrado ao Financeiro.
- ✅ Transversais: **RBAC** (7 papéis) + **multiusuário por empresa** (membros + convites).
  RLS isola por membership; escrita por papel; UI gated por `lib/rbac.ts`. Gestão em **Equipe** (`/equipe`).
- Roadmap completo: ver `docs/ROADMAP.md`.

## RBAC / multiusuário (resumo)
- `lib/rbac.ts`: papéis e `can(papel, capability)` / `canWrite(papel)`.
- `useEmpresa().papel` = papel do usuário na empresa ativa. Use para gating de UI.
- Acesso a dados: leitura = qualquer membro; escrita = papéis operacionais (RLS). Contador/Consulta = leitura.
- Convidar/gerenciar membros: página **Equipe** (admin). Aceitar convite: página **Empresas**.
