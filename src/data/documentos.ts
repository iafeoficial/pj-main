// Fase 3 — serviço de Documentos (NF-e/boleto → conta a pagar), assíncrono.
import type { Documento, DocumentoTipo } from "@/types/domain";
import { logAudit } from "./audit";
import { documentoTable } from "./repos";
import { contaPagarService } from "./services";

export interface NovaContaPorDocumento {
  tipo: DocumentoTipo;
  origem: string; // xml | ocr | linha_digitavel
  arquivoNome: string;
  emitente: string;
  documento: string; // chave NF-e ou linha digitável
  dados: unknown;
  // campos da conta a pagar (já revisados pelo usuário)
  fornecedor: string;
  categoriaId: string | null;
  centroCustoId: string | null;
  valor: number;
  dataDocumento: string | null;
  dataVencimento: string;
  observacao: string;
}

export const documentoService = {
  list: (empresaId: string): Promise<Documento[]> =>
    documentoTable.list(empresaId, { column: "created_at", ascending: false }),

  /** Cria a conta a pagar a partir dos dados revisados e persiste o documento vinculado. */
  async criarContaPagar(empresaId: string, input: NovaContaPorDocumento) {
    if (!input.fornecedor.trim()) throw new Error("Informe o fornecedor.");
    if (!input.valor || input.valor <= 0) throw new Error("Informe um valor maior que zero.");
    if (!input.dataVencimento) throw new Error("Informe o vencimento.");

    const conta = await contaPagarService.create(empresaId, {
      fornecedor: input.fornecedor,
      categoriaId: input.categoriaId,
      centroCustoId: input.centroCustoId,
      valor: input.valor,
      dataCompetencia: input.dataDocumento ?? input.dataVencimento,
      dataVencimento: input.dataVencimento,
      status: "aberta",
      observacao: input.observacao,
    });

    const doc = await documentoTable.create(empresaId, {
      tipo: input.tipo,
      origem: input.origem,
      arquivoNome: input.arquivoNome,
      emitente: input.emitente,
      documento: input.documento,
      valor: input.valor,
      dataDocumento: input.dataDocumento,
      dados: input.dados,
      contaPagarId: conta.id,
      status: "vinculado",
    } as Omit<Documento, "id" | "createdAt" | "updatedAt" | "empresaId">);

    await logAudit({
      empresaId,
      entidade: "Documento",
      entidadeId: doc.id,
      acao: "inclusao",
      descricao: `Documento ${input.tipo.toUpperCase()} importado e vinculado a conta a pagar.`,
    });

    return { conta, doc };
  },
};
