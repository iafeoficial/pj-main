// Instâncias de tabelas Supabase por entidade (C3).
import type {
  Categoria,
  CentroCusto,
  ContaPagar,
  Certificado,
  Cliente,
  ContaReceber,
  Documento,
  Empresa,
  EstoqueMovimento,
  ExtratoBancario,
  Fornecedor,
  Oportunidade,
  PedidoCompra,
  PedidoItem,
  PedidoVenda,
  Produto,
  RegraConciliacao,
  TransacaoBancaria,
  Vendedor,
} from "@/types/domain";
import { GlobalTable, OwnedTable } from "./db";

export const empresaTable = new GlobalTable<Empresa>("empresas");
export const categoriaTable = new OwnedTable<Categoria>("categorias");
export const centroCustoTable = new OwnedTable<CentroCusto>("centros_custo");
export const contaPagarTable = new OwnedTable<ContaPagar>("contas_pagar");
export const contaReceberTable = new OwnedTable<ContaReceber>("contas_receber");
export const extratoTable = new OwnedTable<ExtratoBancario>("extratos_bancarios");
export const transacaoTable = new OwnedTable<TransacaoBancaria>("transacoes_bancarias");
export const regraTable = new OwnedTable<RegraConciliacao>("regras_conciliacao");
export const documentoTable = new OwnedTable<Documento>("documentos");
export const certificadoTable = new OwnedTable<Certificado>("certificados");

// Fase 5 — Operação
export const fornecedorTable = new OwnedTable<Fornecedor>("fornecedores");
export const clienteTable = new OwnedTable<Cliente>("clientes");
export const vendedorTable = new OwnedTable<Vendedor>("vendedores");
export const produtoTable = new OwnedTable<Produto>("produtos");
export const estoqueMovTable = new OwnedTable<EstoqueMovimento>("estoque_movimentos");
export const pedidoCompraTable = new OwnedTable<PedidoCompra>("pedidos_compra");
export const pedidoCompraItemTable = new OwnedTable<PedidoItem>("pedido_compra_itens");
export const pedidoVendaTable = new OwnedTable<PedidoVenda>("pedidos_venda");
export const pedidoVendaItemTable = new OwnedTable<PedidoItem>("pedido_venda_itens");
export const oportunidadeTable = new OwnedTable<Oportunidade>("oportunidades");
