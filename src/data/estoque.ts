// Fase 5 — Estoque: produtos + movimentações com saldo e custo médio (async).
import type { EstoqueMovimento, EstoqueMovTipo, Produto } from "@/types/domain";
import { logAudit } from "./audit";
import { estoqueMovTable, produtoTable } from "./repos";

export const produtoService = {
  list: (empresaId: string) => produtoTable.list(empresaId, { column: "nome" }),
  listAtivos: async (empresaId: string) =>
    (await produtoTable.list(empresaId, { column: "nome" })).filter((p) => p.ativo),
  find: (empresaId: string, id: string) => produtoTable.find(empresaId, id),
  async create(empresaId: string, data: Omit<Produto, "id" | "createdAt" | "updatedAt" | "empresaId">) {
    const p = await produtoTable.create(empresaId, data);
    await logAudit({ empresaId, entidade: "Produto", entidadeId: p.id, acao: "inclusao", descricao: `Produto "${p.nome}" criado.` });
    return p;
  },
  async update(empresaId: string, id: string, data: Partial<Produto>) {
    const p = await produtoTable.update(empresaId, id, data);
    await logAudit({ empresaId, entidade: "Produto", entidadeId: id, acao: "alteracao", descricao: `Produto "${p.nome}" alterado.` });
    return p;
  },
  async remove(empresaId: string, id: string) {
    await produtoTable.remove(empresaId, id);
    await logAudit({ empresaId, entidade: "Produto", entidadeId: id, acao: "exclusao", descricao: "Produto excluído." });
  },
};

export interface MovimentoInput {
  produtoId: string;
  tipo: EstoqueMovTipo;
  quantidade: number; // entrada/saida: positivo; ajuste: delta (+/-)
  custoUnitario?: number;
  documento?: string;
  observacao?: string;
  data: string;
}

export const estoqueService = {
  listMovimentos: (empresaId: string) =>
    estoqueMovTable.list(empresaId, { column: "data", ascending: false }),

  /**
   * Registra um movimento e atualiza saldo e custo médio do produto.
   * Não falha se o produto não controla estoque (apenas ignora a atualização de saldo).
   */
  async registrarMovimento(empresaId: string, input: MovimentoInput): Promise<EstoqueMovimento> {
    const produto = await produtoTable.find(empresaId, input.produtoId);
    if (!produto) throw new Error("Produto não encontrado.");

    const mov = await estoqueMovTable.create(empresaId, {
      produtoId: input.produtoId,
      tipo: input.tipo,
      quantidade: input.quantidade,
      custoUnitario: input.custoUnitario ?? 0,
      documento: input.documento ?? "",
      observacao: input.observacao ?? "",
      data: input.data,
    });

    if (produto.controlaEstoque) {
      const atual = Number(produto.estoqueAtual);
      let novoSaldo = atual;
      let novoCusto = Number(produto.custoMedio);

      if (input.tipo === "entrada") {
        novoSaldo = atual + input.quantidade;
        if (novoSaldo > 0 && (input.custoUnitario ?? 0) > 0) {
          novoCusto = (atual * novoCusto + input.quantidade * (input.custoUnitario ?? 0)) / novoSaldo;
        }
      } else if (input.tipo === "saida") {
        novoSaldo = atual - input.quantidade;
      } else {
        // ajuste: quantidade é um delta (pode ser negativo)
        novoSaldo = atual + input.quantidade;
      }

      await produtoTable.update(empresaId, produto.id, {
        estoqueAtual: Number(novoSaldo.toFixed(3)),
        custoMedio: Number(novoCusto.toFixed(4)),
      });
    }

    await logAudit({
      empresaId,
      entidade: "EstoqueMovimento",
      entidadeId: mov.id,
      acao: input.tipo === "ajuste" ? "alteracao" : "inclusao",
      descricao: `Estoque ${input.tipo}: ${input.quantidade} de "${produto.nome}".`,
    });

    return mov;
  },
};
