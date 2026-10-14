import type { TransferenciaConta } from "@/types/domain";
import { logAudit } from "./audit";
import { transferenciaContaTable } from "./repos";

export const transferenciaService = {
  list: (empresaId: string) =>
    transferenciaContaTable.list(empresaId, { column: "data", ascending: false }),
  async create(
    empresaId: string,
    data: Omit<TransferenciaConta, "id" | "createdAt" | "updatedAt" | "empresaId">
  ) {
    if (data.contaOrigemId === data.contaDestinoId) {
      throw new Error("A conta de origem e a de destino precisam ser diferentes.");
    }
    if (!(data.valor > 0)) throw new Error("Informe um valor maior que zero.");
    if (!data.data) throw new Error("Informe a data.");
    const t = await transferenciaContaTable.create(empresaId, {
      ...data,
      observacao: data.observacao.trim(),
    });
    await logAudit({
      empresaId,
      entidade: "TransferenciaConta",
      entidadeId: t.id,
      acao: "inclusao",
      descricao: "Transferência entre contas registrada.",
    });
    return t;
  },
  async update(
    empresaId: string,
    id: string,
    data: Omit<TransferenciaConta, "id" | "createdAt" | "updatedAt" | "empresaId">
  ) {
    if (data.contaOrigemId === data.contaDestinoId) {
      throw new Error("A conta de origem e a de destino precisam ser diferentes.");
    }
    if (!(data.valor > 0)) throw new Error("Informe um valor maior que zero.");
    if (!data.data) throw new Error("Informe a data.");
    const t = await transferenciaContaTable.update(empresaId, id, {
      ...data,
      observacao: data.observacao.trim(),
    });
    await logAudit({
      empresaId,
      entidade: "TransferenciaConta",
      entidadeId: id,
      acao: "alteracao",
      descricao: "Transferência entre contas alterada.",
    });
    return t;
  },
  async remove(empresaId: string, id: string) {
    await transferenciaContaTable.remove(empresaId, id);
    await logAudit({
      empresaId,
      entidade: "TransferenciaConta",
      entidadeId: id,
      acao: "exclusao",
      descricao: "Transferência entre contas excluída.",
    });
  },
};
