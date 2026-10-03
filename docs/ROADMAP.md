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
- [x] **Lançar** a partir do extrato → Conta a Pagar (débito) / Receber (crédito), já baixada
- [x] Excluir título vinculado reabre a linha OFX como pendente
- [x] Regras de categorização **aplicadas na UI** (badge categoria sugerida) + pré-seleção no Lançar
- [x] Histórico de extratos importados na Conciliação
- [x] **Backend Supabase** (Postgres + Auth + RLS por membership)

## ✅ Fase 3 — Documentos (ENTREGUE, exceto Open Finance)
- [x] OCR de boletos (`tesseract.js` assistivo) + parser de linha digitável
- [x] Captura XML (importação de NF-e → conta a pagar)
- [x] DRE (Demonstração do Resultado do Exercício)
- [x] Links cruzados documento → conta a pagar
- [ ] Open Finance — **planejado** (requer provedor certificado; ver `docs/OPEN_FINANCE.md`)

## ◑ Fase 4 — Fiscal (parcial)
- [x] Exportação contábil (lançamentos D/C em CSV para o contador)
- [x] Certificado digital — cadastro/controle de validade (sem chave privada)
- [ ] NFS-e / NF-e — **planejado** (requer certificado A1 server-side + provedor; ver `docs/FISCAL.md`)
- [ ] SPED — **planejado** (requer camada fiscal completa; ver `docs/SPED.md`)

## ✅ Fase 5 — Operação (ENTREGUE)
- [x] Cadastros: Fornecedores, Clientes, Vendedores
- [x] Estoque: Produtos + movimentações (entrada/saída/ajuste, custo médio)
- [x] Compras: pedido → aprovar → receber (gera conta a pagar + entrada de estoque)
- [x] Vendas: orçamento/pedido → faturar (gera conta a receber + saída de estoque + comissão)
- [x] CRM integrado (cliente/vendedor dos cadastros, conversão ganho → venda)
- [x] Comissões → contas a pagar (geração idempotente por período)
- [x] Links cruzados entre Compras/Vendas/Documentos/Conciliação/Estoque/Contas

## Itens técnicos transversais
- [x] Backend persistente (Supabase/Postgres) substituindo a camada local
- [x] Autenticação (Supabase Auth, e-mail/senha)
- [x] **RBAC por papéis** (Administrador, Financeiro, Gestor, Comprador, Vendedor, Contador, Consulta)
- [x] **Multiusuário por empresa** (membros + convites por e-mail; RLS por membership)
- [x] **RequireCapability** nas rotas sensíveis (`/equipe`) + gating de escrita na UI
- [x] **Nav mobile** (drawer/hamburger abaixo de `md`)
- [x] **Hardening Supabase** (REVOKE anon em RPCs, search_path em triggers, cleanup debug)
- [ ] Endurecer RLS por módulo×papel (hoje a granularidade fina é na UI) — opcional
- [ ] LGPD (consentimento, exportação/exclusão de dados, logs de acesso)
- [ ] Alçadas de aprovação por valor
- [ ] Lançamentos recorrentes e alertas
