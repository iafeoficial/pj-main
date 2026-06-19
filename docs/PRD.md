# PRD — Plataforma Financeira PJ (Fase 1 / MVP)

> Derivado de `PROJETO_FINANCEIRO_PJ_MASTER.md`. Este documento descreve o escopo entregue na Fase 1.

## Objetivo
Centralizar a operação financeira de pequenas e médias empresas, reduzindo controles manuais e
aumentando a previsibilidade, com suporte **multiempresa** desde o início.

## Usuário-alvo
Pequenas e médias empresas (prestadores de serviço, consultorias, agências, comércio,
distribuidoras, empresas de tecnologia etc.).

## Escopo da Fase 1 — o usuário consegue
- Cadastrar e selecionar **empresas** (dados isolados por empresa/CNPJ).
- Cadastrar **categorias** (receita/despesa) e **centros de custo**.
- Controlar **contas a pagar** e **contas a receber** (criar, editar, baixar parcial/total,
  cancelar, excluir).
- Visualizar **fluxo de caixa** projetado.
- Consultar **dashboard financeiro** com indicadores-chave.
- Gerar **relatórios** básicos e exportá-los em CSV.
- Acompanhar **auditoria** das ações.

## Fora do escopo da Fase 1
Open Finance, OCR, fiscal/SPED, compras, vendas, estoque, cobrança automática e integrações
bancárias (ver `ROADMAP.md`).

## Entidades (resumo)
- **Empresa**: cnpj, razaoSocial, nomeFantasia, email, telefone, status.
- **Categoria**: nome, tipo (receita/despesa), ativo — *por empresa*.
- **CentroCusto**: nome, codigo, ativo — *por empresa*.
- **ContaPagar**: fornecedor, categoria, centro de custo, valor, valorPago, competência,
  vencimento, pagamento, status, observação — *por empresa*.
- **ContaReceber**: cliente, categoria, centro de custo, valor, valorRecebido, competência,
  vencimento, recebimento, status, observação — *por empresa*.
- **AuditLog**: entidade, ação, descrição, usuário — *por empresa*.

### Status
- Pagar: `rascunho · aberta · parcial · paga · vencida · cancelada`
- Receber: `rascunho · aberta · parcial · recebida · vencida · cancelada`
- `vencida` é **derivada** (calculada na leitura quando o vencimento já passou e há saldo).

## Indicadores do Dashboard
Saldo atual, total a receber, total a pagar, saldo projetado, receitas do mês, despesas do mês,
inadimplência e resultado do mês.

## Princípios respeitados
Multiempresa desde o início · dados isolados por empresa · toda ação relevante gera auditoria ·
simplicidade antes de complexidade · implementação por fases · sem IA em decisões financeiras críticas.
