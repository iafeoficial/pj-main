// Fase 5 — Compras, Vendas, CRM e Comissões (async). Integra com Financeiro e Estoque.
import type {
  ItemEditavel,
  Oportunidade,
  PedidoCompra,
  PedidoItem,
  PedidoVenda,
} from "@/types/domain";
import { logAudit } from "./audit";
import {
  oportunidadeTable,
  pedidoCompraItemTable,
  pedidoCompraTable,
  pedidoVendaItemTable,
  pedidoVendaTable,
  produtoTable,
  vendedorTable,
} from "./repos";
import { contaPagarService, contaReceberService } from "./services";
import { estoqueService } from "./estoque";
import { today } from "@/lib/utils";

function totalItens(itens: ItemEditavel[]): number {
  return itens.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0);
}

async function inserirItens(
  empresaId: string,
  pedidoId: string,
  itens: ItemEditavel[],
  tabela: typeof pedidoCompraItemTable
) {
  for (const it of itens) {
    await tabela.create(empresaId, {
      pedidoId,
      produtoId: it.produtoId,
      descricao: it.descricao,
      quantidade: it.quantidade,
      valorUnitario: it.valorUnitario,
      valorTotal: Number((it.quantidade * it.valorUnitario).toFixed(2)),
    } as Omit<PedidoItem, "id" | "createdAt" | "updatedAt" | "empresaId">);
  }
}

// ---------------------------------------------------------------------------
// Compras
// ---------------------------------------------------------------------------
export const compraService = {
  list: (empresaId: string) => pedidoCompraTable.list(empresaId, { column: "data", ascending: false }),
  listItens: (empresaId: string, pedidoId: string) =>
    pedidoCompraItemTable.list(empresaId).then((l) => l.filter((i) => i.pedidoId === pedidoId)),

  async create(
    empresaId: string,
    data: { fornecedorId: string | null; fornecedorNome: string; data: string; observacao: string; itens: ItemEditavel[] }
  ) {
    if (data.itens.length === 0) throw new Error("Adicione ao menos um item.");
    const pedido = await pedidoCompraTable.create(empresaId, {
      fornecedorId: data.fornecedorId,
      fornecedorNome: data.fornecedorNome,
      status: "rascunho",
      data: data.data,
      valorTotal: Number(totalItens(data.itens).toFixed(2)),
      observacao: data.observacao,
      contaPagarId: null,
    } as Omit<PedidoCompra, "id" | "createdAt" | "updatedAt" | "empresaId">);
    await inserirItens(empresaId, pedido.id, data.itens, pedidoCompraItemTable);
    await logAudit({ empresaId, entidade: "PedidoCompra", entidadeId: pedido.id, acao: "inclusao", descricao: `Pedido de compra p/ "${pedido.fornecedorNome}" criado.` });
    return pedido;
  },

  async aprovar(empresaId: string, id: string) {
    const p = await pedidoCompraTable.update(empresaId, id, { status: "aprovado" });
    await logAudit({ empresaId, entidade: "PedidoCompra", entidadeId: id, acao: "alteracao", descricao: "Pedido de compra aprovado." });
    return p;
  },

  /** Recebe o pedido: gera conta a pagar e entradas de estoque. */
  async receber(
    empresaId: string,
    id: string,
    opts: { dataVencimento: string; categoriaId: string | null; centroCustoId: string | null }
  ) {
    const pedido = await pedidoCompraTable.find(empresaId, id);
    if (!pedido) throw new Error("Pedido não encontrado.");
    if (pedido.status === "recebido") throw new Error("Pedido já recebido.");

    const conta = await contaPagarService.create(empresaId, {
      fornecedor: pedido.fornecedorNome || "Fornecedor",
      categoriaId: opts.categoriaId,
      centroCustoId: opts.centroCustoId,
      valor: pedido.valorTotal,
      dataCompetencia: pedido.data,
      dataVencimento: opts.dataVencimento,
      status: "aberta",
      observacao: `Pedido de compra ${id.slice(0, 8)}`,
    });

    const itens = await this.listItens(empresaId, id);
    for (const it of itens) {
      if (it.produtoId) {
        await estoqueService.registrarMovimento(empresaId, {
          produtoId: it.produtoId,
          tipo: "entrada",
          quantidade: it.quantidade,
          custoUnitario: it.valorUnitario,
          documento: `Compra ${id.slice(0, 8)}`,
          data: opts.dataVencimento,
        });
      }
    }

    const p = await pedidoCompraTable.update(empresaId, id, { status: "recebido", contaPagarId: conta.id });
    await logAudit({ empresaId, entidade: "PedidoCompra", entidadeId: id, acao: "baixa", descricao: "Pedido recebido: conta a pagar e estoque atualizados." });
    return p;
  },

  async cancelar(empresaId: string, id: string) {
    const p = await pedidoCompraTable.update(empresaId, id, { status: "cancelado" });
    await logAudit({ empresaId, entidade: "PedidoCompra", entidadeId: id, acao: "cancelamento", descricao: "Pedido de compra cancelado." });
    return p;
  },

  async remove(empresaId: string, id: string) {
    await pedidoCompraTable.remove(empresaId, id); // itens caem por cascade
    await logAudit({ empresaId, entidade: "PedidoCompra", entidadeId: id, acao: "exclusao", descricao: "Pedido de compra excluído." });
  },
};

// ---------------------------------------------------------------------------
// Vendas
// ---------------------------------------------------------------------------
export const vendaService = {
  list: (empresaId: string) => pedidoVendaTable.list(empresaId, { column: "data", ascending: false }),
  listItens: (empresaId: string, pedidoId: string) =>
    pedidoVendaItemTable.list(empresaId).then((l) => l.filter((i) => i.pedidoId === pedidoId)),

  async create(
    empresaId: string,
    data: {
      clienteId: string | null;
      clienteNome: string;
      vendedorId: string | null;
      status: "orcamento" | "pedido";
      data: string;
      observacao: string;
      itens: ItemEditavel[];
    }
  ) {
    if (data.itens.length === 0) throw new Error("Adicione ao menos um item.");
    const total = Number(totalItens(data.itens).toFixed(2));
    let comissaoPercent = 0;
    if (data.vendedorId) {
      const v = await vendedorTable.find(empresaId, data.vendedorId);
      comissaoPercent = v?.comissaoPercent ?? 0;
    }
    const comissaoValor = Number(((total * comissaoPercent) / 100).toFixed(2));

    const pedido = await pedidoVendaTable.create(empresaId, {
      clienteId: data.clienteId,
      clienteNome: data.clienteNome,
      vendedorId: data.vendedorId,
      status: data.status,
      data: data.data,
      valorTotal: total,
      comissaoPercent,
      comissaoValor,
      observacao: data.observacao,
      contaReceberId: null,
    } as Omit<PedidoVenda, "id" | "createdAt" | "updatedAt" | "empresaId">);
    await inserirItens(empresaId, pedido.id, data.itens, pedidoVendaItemTable);
    await logAudit({ empresaId, entidade: "PedidoVenda", entidadeId: pedido.id, acao: "inclusao", descricao: `Venda p/ "${pedido.clienteNome}" criada (${data.status}).` });
    return pedido;
  },

  /** Fatura a venda: gera conta a receber e saídas de estoque. */
  async faturar(
    empresaId: string,
    id: string,
    opts: { dataVencimento: string; categoriaId: string | null; centroCustoId: string | null }
  ) {
    const pedido = await pedidoVendaTable.find(empresaId, id);
    if (!pedido) throw new Error("Venda não encontrada.");
    if (pedido.status === "faturado") throw new Error("Venda já faturada.");

    const conta = await contaReceberService.create(empresaId, {
      cliente: pedido.clienteNome || "Cliente",
      categoriaId: opts.categoriaId,
      centroCustoId: opts.centroCustoId,
      valor: pedido.valorTotal,
      dataCompetencia: pedido.data,
      dataVencimento: opts.dataVencimento,
      status: "aberta",
      observacao: `Venda ${id.slice(0, 8)}`,
    });

    const itens = await this.listItens(empresaId, id);
    for (const it of itens) {
      if (!it.produtoId) continue;
      const prod = await produtoTable.find(empresaId, it.produtoId);
      if (prod?.controlaEstoque) {
        await estoqueService.registrarMovimento(empresaId, {
          produtoId: it.produtoId,
          tipo: "saida",
          quantidade: it.quantidade,
          custoUnitario: prod.custoMedio,
          documento: `Venda ${id.slice(0, 8)}`,
          data: opts.dataVencimento,
        });
      }
    }

    const p = await pedidoVendaTable.update(empresaId, id, { status: "faturado", contaReceberId: conta.id });
    await logAudit({ empresaId, entidade: "PedidoVenda", entidadeId: id, acao: "baixa", descricao: "Venda faturada: conta a receber e estoque atualizados." });
    return p;
  },

  async cancelar(empresaId: string, id: string) {
    const p = await pedidoVendaTable.update(empresaId, id, { status: "cancelado" });
    await logAudit({ empresaId, entidade: "PedidoVenda", entidadeId: id, acao: "cancelamento", descricao: "Venda cancelada." });
    return p;
  },

  async remove(empresaId: string, id: string) {
    await pedidoVendaTable.remove(empresaId, id);
    await logAudit({ empresaId, entidade: "PedidoVenda", entidadeId: id, acao: "exclusao", descricao: "Venda excluída." });
  },
};

// ---------------------------------------------------------------------------
// Comissões (relatório)
// ---------------------------------------------------------------------------
export interface ComissaoRow {
  vendedorId: string;
  vendedor: string;
  qtdVendas: number;
  totalVendido: number;
  comissao: number;
}

export async function getComissoes(empresaId: string, inicio: string, fim: string): Promise<ComissaoRow[]> {
  const [vendas, vendedores] = await Promise.all([
    pedidoVendaTable.list(empresaId),
    vendedorTable.list(empresaId),
  ]);
  const nomeMap = new Map(vendedores.map((v) => [v.id, v.nome]));
  const faturadas = vendas.filter(
    (v) => v.status === "faturado" && v.vendedorId && v.data >= inicio && v.data <= fim
  );
  const map = new Map<string, ComissaoRow>();
  for (const v of faturadas) {
    const key = v.vendedorId as string;
    const row = map.get(key) ?? {
      vendedorId: key,
      vendedor: nomeMap.get(key) ?? "—",
      qtdVendas: 0,
      totalVendido: 0,
      comissao: 0,
    };
    row.qtdVendas += 1;
    row.totalVendido += v.valorTotal;
    row.comissao += v.comissaoValor;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.comissao - a.comissao);
}

/** Gera contas a pagar para comissões do período (idempotente por vendedor/período). */
export async function gerarContasComissao(
  empresaId: string,
  inicio: string,
  fim: string,
  opts: { categoriaId: string | null; dataVencimento: string }
): Promise<{ geradas: number; ids: string[] }> {
  const rows = await getComissoes(empresaId, inicio, fim);
  const contasExistentes = await contaPagarService.list(empresaId);
  const refTag = `Comissão ref. ${inicio} a ${fim}`;

  const ids: string[] = [];
  let geradas = 0;

  for (const row of rows) {
    if (row.comissao <= 0) continue;
    const dup = contasExistentes.find(
      (c) => c.observacao.includes(refTag) && c.fornecedor === row.vendedor
    );
    if (dup) continue;

    const conta = await contaPagarService.create(empresaId, {
      fornecedor: row.vendedor,
      categoriaId: opts.categoriaId,
      centroCustoId: null,
      valor: row.comissao,
      dataCompetencia: fim,
      dataVencimento: opts.dataVencimento,
      status: "aberta",
      observacao: `${refTag} — ${row.vendedor}`,
    });
    ids.push(conta.id);
    geradas++;
  }

  if (geradas > 0) {
    await logAudit({
      empresaId,
      entidade: "ContaPagar",
      entidadeId: ids[0],
      acao: "inclusao",
      descricao: `${geradas} conta(s) a pagar de comissão gerada(s) (${inicio} a ${fim}).`,
    });
  }

  return { geradas, ids };
}

// ---------------------------------------------------------------------------
// CRM — Oportunidades
// ---------------------------------------------------------------------------
export const oportunidadeService = {
  list: (empresaId: string) => oportunidadeTable.list(empresaId, { column: "created_at", ascending: false }),
  async create(empresaId: string, data: Omit<Oportunidade, "id" | "createdAt" | "updatedAt" | "empresaId">) {
    const o = await oportunidadeTable.create(empresaId, data);
    await logAudit({ empresaId, entidade: "Oportunidade", entidadeId: o.id, acao: "inclusao", descricao: `Oportunidade "${o.titulo}" criada.` });
    return o;
  },
  async update(empresaId: string, id: string, data: Partial<Oportunidade>) {
    const o = await oportunidadeTable.update(empresaId, id, data);
    await logAudit({ empresaId, entidade: "Oportunidade", entidadeId: id, acao: "alteracao", descricao: `Oportunidade "${o.titulo}" atualizada.` });
    return o;
  },
  async remove(empresaId: string, id: string) {
    await oportunidadeTable.remove(empresaId, id);
    await logAudit({ empresaId, entidade: "Oportunidade", entidadeId: id, acao: "exclusao", descricao: "Oportunidade excluída." });
  },

  /** Converte oportunidade ganha em pedido de venda. */
  async converterParaVenda(empresaId: string, id: string) {
    const op = await oportunidadeTable.find(empresaId, id);
    if (!op) throw new Error("Oportunidade não encontrada.");
    if (op.estagio !== "ganho") throw new Error("A oportunidade precisa estar no estágio Ganho.");
    if (op.pedidoVendaId) throw new Error("Já existe um pedido de venda vinculado.");

    const pedido = await vendaService.create(empresaId, {
      clienteId: op.clienteId,
      clienteNome: op.clienteNome,
      vendedorId: op.vendedorId,
      status: "pedido",
      data: today(),
      observacao: `Oportunidade: ${op.titulo}`,
      itens: [
        {
          produtoId: null,
          descricao: op.titulo,
          quantidade: 1,
          valorUnitario: op.valorEstimado,
        },
      ],
    });

    await oportunidadeTable.update(empresaId, id, { pedidoVendaId: pedido.id });
    await logAudit({
      empresaId,
      entidade: "Oportunidade",
      entidadeId: id,
      acao: "alteracao",
      descricao: `Oportunidade convertida em venda ${pedido.id.slice(0, 8)}.`,
    });
    return pedido;
  },
};
