# ROADMAP

Conforme `PROJETO_FINANCEIRO_PJ_MASTER.md`.

## ✅ Fase 1 — Núcleo Financeiro (ENTREGUE)
- [x] Multiempresa
- [x] Categorias
- [x] Centro de custo
- [x] Contas a pagar
- [x] Contas a receber
- [x] Dashboard
- [x] Fluxo de caixa
- [x] Relatórios
- [x] Auditoria (base)

## ✅ Fase 2 — Conciliação Bancária (ENTREGUE)
- [x] Importação OFX (parser próprio, dedupe por FITID)
- [x] Motor de sugestões (valor, data, histórico, documento)
- [x] Sugestões + confirmação manual (com baixa do título)
- [x] Regras de categorização
- [x] **Backend Supabase** (Postgres + Auth + RLS por dono) — substituiu a camada local

## ✅ Fase 3 — Documentos (ENTREGUE)
- [x] OCR de boletos (`tesseract.js` assistivo) + parser de linha digitável
- [x] Captura XML (importação de NF-e → conta a pagar)
- [x] DRE (Demonstração do Resultado do Exercício)

## ◑ Fase 4 — Fiscal (parcial — no produto ativo)
- [x] Exportação contábil (lançamentos D/C em CSV para o contador)
- [x] Certificado digital — cadastro/controle de validade (sem chave privada)

## ✅ Fase 5 — Operação (ENTREGUE)
- [x] Cadastros: Fornecedores, Clientes, Vendedores
- [x] Estoque: Produtos + movimentações (entrada/saída/ajuste, custo médio)
- [x] Compras: pedido → aprovar → receber (gera conta a pagar + entrada de estoque)
- [x] Vendas: orçamento/pedido → faturar (gera conta a receber + saída de estoque + comissão)
- [x] CRM integrado (oportunidades → clientes → orçamento de venda)
- [x] Comissões (relatório por vendedor)

## Fora do escopo atual (roadmap futuro)
- Open Finance — requer provedor certificado (`docs/OPEN_FINANCE.md`)
- Emissão NFS-e / NF-e — requer certificado A1 server-side (`docs/FISCAL.md`)
- SPED — requer camada fiscal completa (`docs/SPED.md`)
- LGPD (consentimento, exportação/exclusão de dados)
- Alçadas de aprovação por valor
- Lançamentos recorrentes e alertas

## Itens técnicos transversais
- [x] Backend persistente (Supabase/Postgres) substituindo a camada local
- [x] Autenticação (Supabase Auth, e-mail/senha)
- [x] **RBAC por papéis** (Administrador, Financeiro, Gestor, Comprador, Vendedor, Contador, Consulta)
- [x] **Multiusuário por empresa** (membros + convites in-app com link; RLS por membership)
- [x] RBAC na UI (rotas + botões de escrita por papel)
- [ ] Endurecer RLS por módulo×papel (granularidade fina no banco) — opcional
