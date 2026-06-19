# Finanças PJ

Plataforma web de **gestão financeira para empresas (PJ)** — multiempresa, com contas a pagar/receber,
fluxo de caixa, dashboard e relatórios. Construída por fases conforme `PROJETO_FINANCEIRO_PJ_MASTER.md`.

> **Fase 1 (MVP)** — núcleo financeiro completo, rodando 100% no navegador (persistência local),
> pronto para evoluir para um backend (Supabase/Postgres) nas próximas fases.

## ✨ Funcionalidades (Fase 1)
- **Multiempresa** — cadastro de empresas (CNPJ validado) com dados isolados por empresa.
- **Categorias** de receita/despesa e **Centros de custo**.
- **Contas a pagar** e **contas a receber** com baixa parcial/total, status automático de
  vencimento e cancelamento.
- **Dashboard** com indicadores: saldo atual, saldo projetado, a pagar/receber, receitas/despesas
  do mês e inadimplência.
- **Fluxo de caixa** projetado (entradas × saídas e saldo acumulado).
- **Relatórios** gerenciais (por categoria, centro de custo, cliente e fornecedor) com export CSV.
- **Auditoria** de todas as ações relevantes.

## 🚀 Como rodar
```bash
npm install
npm run dev      # http://localhost:5173
```
Na primeira execução, vá em **Cadastros → Empresas** e clique em **Carregar demonstração**
para popular dados de exemplo, ou cadastre sua empresa.

### Scripts
| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Type-check + build de produção |
| `npm run lint` | Verificação de lint |
| `npm run preview` | Servir o build de produção |

## 🧱 Stack
Vite · React 18 · TypeScript · Tailwind CSS · React Router · Recharts · lucide-react.

## 📁 Estrutura e contribuição
Veja [`CLAUDE.md`](./CLAUDE.md) para arquitetura, convenções e regras do projeto, e
[`docs/`](./docs) para PRD, roadmap, decisões técnicas e checkpoints.

## 🔒 Dados
Nesta fase os dados ficam no `localStorage` do navegador (chave `financas_pj:v1:*`). Toda a
persistência está isolada em `src/data/` para facilitar a migração para um backend real.
