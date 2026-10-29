// Fase 3 — Documentos (NF-e/boleto/NFS-e → conta a pagar ou receber), assíncrono.
import type { Documento, DocumentoTipo, ImpostosRetidos } from "@/types/domain";
import type { NFSeLadoEsperado, NFSeResultado } from "@/lib/nfse";
import { validarCnpjEmpresaNaNfse } from "@/lib/nfse";
import { db } from "./db";
import { logAudit } from "./audit";
import { documentoTable } from "./repos";
import { contaPagarService, contaReceberService } from "./services";

export interface NovaContaPorDocumento {
  tipo: DocumentoTipo;
  origem: string; // xml | ocr | linha_digitavel
  arquivoNome: string;
  emitente: string;
  documento: string; // chave NF-e/NFS-e ou linha digitável
  dados: unknown;
  // campos da conta a pagar (já revisados pelo usuário)
  fornecedor: string;
  categoriaId: string | null;
  centroCustoId: string | null;
  valor: number;
  dataDocumento: string | null;
  dataVencimento: string;
  observacao: string;
  numeroNf?: string;
  impostos?: ImpostosRetidos | null;
  contaFinanceiraId?: string | null;
}

export interface NovaContaNfse {
  lado: "pagar" | "receber";
  cnpjEmpresa: string;
  arquivoNome: string;
  nfse: NFSeResultado;
  /** Contraparte revisada (fornecedor ou cliente). */
  pessoa: string;
  categoriaId: string | null;
  centroCustoId: string | null;
  contaFinanceiraId: string | null;
  valor: number;
  dataCompetencia: string;
  dataVencimento: string;
  observacao: string;
  impostos?: ImpostosRetidos | null;
}

async function assertChaveLivre(empresaId: string, chave: string) {
  const doc = (chave || "").trim();
  if (!doc) throw new Error("Chave da nota ausente.");
  const { data, error } = await db()
    .from("documentos")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("documento", doc)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) throw new Error("NFS-e já importada (chave duplicada).");
}

export const documentoService = {
  list: (empresaId: string): Promise<Documento[]> =>
    documentoTable.list(empresaId, { column: "created_at", ascending: false }),

  async jaExisteChave(empresaId: string, chave: string): Promise<boolean> {
    const doc = (chave || "").trim();
    if (!doc) return false;
    const { data, error } = await db()
      .from("documentos")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("documento", doc)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return !!data;
  },

  /** Cria a conta a pagar a partir dos dados revisados e persiste o documento vinculado. */
  async criarContaPagar(empresaId: string, input: NovaContaPorDocumento) {
    if (!input.fornecedor.trim()) throw new Error("Informe o fornecedor.");
    if (!input.valor || input.valor <= 0) throw new Error("Informe um valor maior que zero.");
    if (!input.dataVencimento) throw new Error("Informe o vencimento.");
    if (input.documento?.trim()) await assertChaveLivre(empresaId, input.documento);

    const conta = await contaPagarService.create(empresaId, {
      fornecedor: input.fornecedor,
      categoriaId: input.categoriaId,
      centroCustoId: input.centroCustoId,
      contaFinanceiraId: input.contaFinanceiraId ?? null,
      valor: input.valor,
      numeroNf: input.numeroNf ?? "",
      impostos: input.impostos ?? null,
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
      contaReceberId: null,
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

  /**
   * Importa NFS-e após revisão: valida CNPJ no lado fiscal da tela,
   * rejeita chave duplicada e cria o título correspondente.
   */
  async criarDeNfse(empresaId: string, input: NovaContaNfse) {
    if (!input.pessoa.trim()) {
      throw new Error(input.lado === "pagar" ? "Informe o beneficiário." : "Informe o cliente.");
    }
    if (!input.valor || input.valor <= 0) throw new Error("Informe um valor maior que zero.");
    if (!input.dataVencimento) throw new Error("Informe o vencimento.");

    const ladoEsperado: NFSeLadoEsperado =
      input.lado === "receber" ? "emitente" : "tomador";
    validarCnpjEmpresaNaNfse(input.nfse, input.cnpjEmpresa, ladoEsperado);
    await assertChaveLivre(empresaId, input.nfse.chave);

    const dataCompetencia = input.dataCompetencia || input.dataVencimento;
    const observacao = input.observacao.slice(0, 500);
    const numeroNf = input.nfse.numero || "";

    if (input.lado === "pagar") {
      const conta = await contaPagarService.create(empresaId, {
        fornecedor: input.pessoa,
        categoriaId: input.categoriaId,
        centroCustoId: input.centroCustoId,
        contaFinanceiraId: input.contaFinanceiraId,
        valor: input.valor,
        numeroNf,
        impostos: input.impostos ?? input.nfse.impostos,
        dataCompetencia,
        dataVencimento: input.dataVencimento,
        status: "aberta",
        observacao,
      });

      const doc = await documentoTable.create(empresaId, {
        tipo: "nfse",
        origem: "xml",
        arquivoNome: input.arquivoNome,
        emitente: input.nfse.nomeEmitente || input.pessoa,
        documento: input.nfse.chave,
        valor: input.valor,
        dataDocumento: dataCompetencia,
        dados: input.nfse,
        contaPagarId: conta.id,
        contaReceberId: null,
        status: "vinculado",
      } as Omit<Documento, "id" | "createdAt" | "updatedAt" | "empresaId">);

      await logAudit({
        empresaId,
        entidade: "Documento",
        entidadeId: doc.id,
        acao: "inclusao",
        descricao: `NFS-e ${numeroNf || input.nfse.chave} importada → conta a pagar.`,
      });
      return { conta, doc, lado: "pagar" as const };
    }

    const conta = await contaReceberService.create(empresaId, {
      cliente: input.pessoa,
      categoriaId: input.categoriaId,
      centroCustoId: input.centroCustoId,
      contaFinanceiraId: input.contaFinanceiraId,
      valor: input.valor,
      numeroNf,
      dataCompetencia,
      dataVencimento: input.dataVencimento,
      status: "aberta",
      observacao,
    });

    const doc = await documentoTable.create(empresaId, {
      tipo: "nfse",
      origem: "xml",
      arquivoNome: input.arquivoNome,
      emitente: input.nfse.nomeEmitente || input.pessoa,
      documento: input.nfse.chave,
      valor: input.valor,
      dataDocumento: dataCompetencia,
      dados: input.nfse,
      contaPagarId: null,
      contaReceberId: conta.id,
      status: "vinculado",
    } as Omit<Documento, "id" | "createdAt" | "updatedAt" | "empresaId">);

    await logAudit({
      empresaId,
      entidade: "Documento",
      entidadeId: doc.id,
      acao: "inclusao",
      descricao: `NFS-e ${numeroNf || input.nfse.chave} importada → conta a receber.`,
    });
    return { conta, doc, lado: "receber" as const };
  },
};
