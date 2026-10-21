// Fase 2 — serviços de Conciliação Bancária (C3 — Supabase, assíncronos).
import type {
  ConciliacaoStatus,
  ContaFinanceiraTipo,
  ContaPagar,
  ContaReceber,
  ExtratoBancario,
  RecorrenciaTipo,
  RegraConciliacao,
  TransacaoBancaria,
  TransacaoTipo,
} from "@/types/domain";
import type { OfxResultado } from "@/lib/ofx";
import { montarSimulacao, type LinhaSimulacao } from "@/lib/contaPagarExtras";
import type { AjusteDiaNaoUtil } from "@/lib/diaUtil";
import { logAudit } from "./audit";
import { feriadoService } from "./feriados";
import { extratoTable, regraTable, transacaoTable } from "./repos";
import { contaPagarService, contaReceberService } from "./services";
import { transferenciaService } from "./transferencias";
import { reativarTransacoesPorTitulo } from "./transacaoVinculo";

export type LancarDeTransacaoInput = {
  pessoa: string;
  categoriaId: string;
  centroCustoId?: string | null;
  contaFinanceiraId?: string | null;
  observacao?: string;
  /** N títulos mensais; valor do extrato = valor de cada parcela. */
  parcelas?: number;
  recorrencia?: RecorrenciaTipo | null;
  recorrenciaDias?: number | null;
  /** Inclui a ocorrência baixada do extrato. */
  recorrenciaOcorrencias?: number;
  ajusteDiaNaoUtil?: AjusteDiaNaoUtil;
  simulacao?: LinhaSimulacao[];
};

export interface ImportResumo {
  extratoId: string;
  importadas: number;
  duplicadas: number;
}

export const conciliacaoService = {
  listExtratos: (empresaId: string) =>
    extratoTable.list(empresaId, { column: "created_at", ascending: false }),

  async updateExtrato(
    empresaId: string,
    id: string,
    data: Partial<Pick<ExtratoBancario, "banco" | "conta" | "dataInicio" | "dataFim" | "arquivoNome">>
  ) {
    const e = await extratoTable.update(empresaId, id, data);
    await logAudit({
      empresaId,
      entidade: "ExtratoBancario",
      entidadeId: id,
      acao: "alteracao",
      descricao: `Extrato bancário alterado (${e.banco || "—"} / ${e.conta || "—"}).`,
    });
    return e;
  },

  /**
   * Remove o extrato e, por cascade, todas as transações vinculadas.
   * Títulos em Contas a Pagar/Receber não são apagados.
   */
  async removeExtrato(empresaId: string, id: string) {
    const txs = (await transacaoTable.list(empresaId)).filter((t) => t.extratoId === id);
    const conciliadas = txs.filter((t) => t.statusConciliacao === "conciliada").length;
    await extratoTable.remove(empresaId, id);
    await logAudit({
      empresaId,
      entidade: "ExtratoBancario",
      entidadeId: id,
      acao: "exclusao",
      descricao: `Extrato excluído (${txs.length} transação(ões)${
        conciliadas ? `, ${conciliadas} conciliada(s)` : ""
      }).`,
    });
    return { total: txs.length, conciliadas };
  },

  listTransacoes: (empresaId: string) =>
    transacaoTable.list(empresaId, { column: "data", ascending: false }),

  async importarOFX(
    empresaId: string,
    ofx: OfxResultado,
    opts?: { contaTipo?: ContaFinanceiraTipo; arquivoNome?: string }
  ): Promise<ImportResumo> {
    const contaTipo: ContaFinanceiraTipo = opts?.contaTipo ?? "conta_corrente";
    const extrato = await extratoTable.create(empresaId, {
      banco: ofx.banco,
      conta: ofx.conta,
      contaTipo,
      dataInicio: ofx.dataInicio,
      dataFim: ofx.dataFim,
      arquivoNome: opts?.arquivoNome ?? "",
    });

    const existentes = new Set((await transacaoTable.list(empresaId)).map((t) => t.fitid));
    let importadas = 0;
    let duplicadas = 0;

    for (const t of ofx.transacoes) {
      if (existentes.has(t.fitid)) {
        duplicadas++;
        continue;
      }
      await transacaoTable.create(empresaId, {
        extratoId: extrato.id,
        fitid: t.fitid,
        data: t.data,
        valor: t.valor,
        tipo: t.tipo,
        descricao: t.descricao,
        documento: t.documento,
        statusConciliacao: "pendente",
        contaPagarId: null,
        contaReceberId: null,
        transferenciaId: null,
      });
      existentes.add(t.fitid);
      importadas++;
    }

    await logAudit({
      empresaId,
      entidade: "ExtratoBancario",
      entidadeId: extrato.id,
      acao: "inclusao",
      descricao: `Extrato importado: ${importadas} transações (${duplicadas} duplicadas ignoradas).`,
    });

    return { extratoId: extrato.id, importadas, duplicadas };
  },

  async ignorar(empresaId: string, id: string) {
    await transacaoTable.update(empresaId, id, {
      statusConciliacao: "ignorada",
      contaPagarId: null,
      contaReceberId: null,
    });
    await logAudit({ empresaId, entidade: "TransacaoBancaria", entidadeId: id, acao: "alteracao", descricao: "Transação marcada como ignorada." });
  },

  async desfazer(empresaId: string, id: string) {
    const t = await transacaoTable.find(empresaId, id);
    if (!t) throw new Error("Transação não encontrada.");
    if (t.transferenciaId) {
      try {
        await transferenciaService.remove(empresaId, t.transferenciaId);
      } catch {
        // A transferência já pode ter sido excluída na página de transferências.
      }
    }
    const valor = Math.abs(t.valor);
    if (t.contaPagarId) await contaPagarService.estornarPagamento(empresaId, t.contaPagarId, valor);
    if (t.contaReceberId) await contaReceberService.estornarRecebimento(empresaId, t.contaReceberId, valor);
    await transacaoTable.update(empresaId, id, {
      statusConciliacao: "pendente",
      contaPagarId: null,
      contaReceberId: null,
      transferenciaId: null,
    });
    await logAudit({ empresaId, entidade: "TransacaoBancaria", entidadeId: id, acao: "alteracao", descricao: "Conciliação desfeita. O título voltou a ficar em aberto." });
  },

  /**
   * Registra a linha do extrato como transferência entre contas e a marca conciliada.
   * Não cria conta a pagar nem a receber.
   */
  async lancarTransferencia(
    empresaId: string,
    transacaoId: string,
    input: {
      contaOrigemId: string;
      contaDestinoId: string;
      data: string;
      valor: number;
      observacao: string;
    }
  ) {
    const t = await transacaoTable.find(empresaId, transacaoId);
    if (!t) throw new Error("Transação não encontrada.");
    if (t.statusConciliacao !== "pendente") {
      throw new Error("Só é possível lançar transações pendentes.");
    }
    const transferencia = await transferenciaService.create(empresaId, {
      contaOrigemId: input.contaOrigemId,
      contaDestinoId: input.contaDestinoId,
      data: input.data,
      valor: input.valor,
      observacao: input.observacao.trim() || t.descricao || "",
    });
    await transacaoTable.update(empresaId, transacaoId, {
      statusConciliacao: "conciliada",
      contaPagarId: null,
      contaReceberId: null,
      transferenciaId: transferencia.id,
    });
    await logAudit({
      empresaId,
      entidade: "TransacaoBancaria",
      entidadeId: transacaoId,
      acao: "baixa",
      descricao: "Transação conciliada como transferência entre contas.",
    });
    return transferencia;
  },

  /** Confirma a conciliação (sempre manual) vinculando a transação a um título e baixando-o. */
  async conciliar(
    empresaId: string,
    transacaoId: string,
    alvo: { contaPagarId?: string; contaReceberId?: string }
  ) {
    const t = await transacaoTable.find(empresaId, transacaoId);
    if (!t) throw new Error("Transação não encontrada.");

    if (alvo.contaReceberId) {
      await contaReceberService.registrarRecebimento(empresaId, alvo.contaReceberId, Math.abs(t.valor), t.data);
      await transacaoTable.update(empresaId, transacaoId, {
        statusConciliacao: "conciliada",
        contaReceberId: alvo.contaReceberId,
        contaPagarId: null,
      });
    } else if (alvo.contaPagarId) {
      await contaPagarService.registrarPagamento(empresaId, alvo.contaPagarId, Math.abs(t.valor), t.data);
      await transacaoTable.update(empresaId, transacaoId, {
        statusConciliacao: "conciliada",
        contaPagarId: alvo.contaPagarId,
        contaReceberId: null,
      });
    } else {
      throw new Error("Informe um título para conciliar.");
    }

    await logAudit({ empresaId, entidade: "TransacaoBancaria", entidadeId: transacaoId, acao: "baixa", descricao: "Transação conciliada e baixa registrada." });
  },

  /**
   * Cria Conta a Pagar (débito) ou Conta a Receber (crédito) a partir da linha do extrato,
   * já baixada na data do banco, e marca a transação como conciliada.
   *
   * Com `parcelas` > 1 ou `recorrencia` + ocorrências > 1: a 1ª título é baixada
   * (valor do extrato) e as demais ficam em aberto com vencimentos futuros.
   * No OFX o valor do extrato é o valor de cada parcela/ocorrência (não é rateado).
   */
  async lancarDeTransacao(
    empresaId: string,
    transacaoId: string,
    input: LancarDeTransacaoInput
  ) {
    const t = await transacaoTable.find(empresaId, transacaoId);
    if (!t) throw new Error("Transação não encontrada.");
    if (t.statusConciliacao !== "pendente") {
      throw new Error("Só é possível lançar transações pendentes.");
    }
    const pessoa = input.pessoa.trim();
    if (!pessoa) throw new Error("Informe o nome da pessoa (favorecido/pagador).");
    if (!input.categoriaId) throw new Error("Escolha a categoria.");

    const valor = Math.abs(t.valor);
    const origem = t.documento
      ? `Origem extrato OFX · Doc: ${t.documento}`
      : "Origem extrato OFX";
    const obsExtra = input.observacao?.trim();
    const observacaoBase = obsExtra ? `${origem}\n${obsExtra}` : origem;
    const centroCustoId = input.centroCustoId || null;
    const contaFinanceiraId = input.contaFinanceiraId || null;

    const parcelas = Math.max(1, Math.min(60, Math.floor(input.parcelas ?? 1)));
    const recorrencia = parcelas > 1 ? null : (input.recorrencia ?? null);
    const ocorrencias = recorrencia
      ? Math.max(1, Math.min(36, Math.floor(input.recorrenciaOcorrencias ?? 1)))
      : 1;
    if (recorrencia === "personalizada") {
      const dias = Math.floor(input.recorrenciaDias ?? 0);
      if (!dias || dias < 1) {
        throw new Error("Informe o intervalo em dias para a repetição personalizada.");
      }
    }
    const diasRec =
      recorrencia === "personalizada"
        ? Math.max(1, Math.min(365, Math.floor(input.recorrenciaDias ?? 1)))
        : null;
    const ajuste: AjusteDiaNaoUtil = input.ajusteDiaNaoUtil ?? "atrasar";
    const feriados = await feriadoService.extras(empresaId);
    const sim =
      input.simulacao && input.simulacao.length > 1
        ? input.simulacao
        : montarSimulacao({
            valor,
            dataVencimento: t.data,
            dataCompetencia: t.data,
            parcelas,
            recorrencia,
            recorrenciaDias: diasRec,
            recorrenciaOcorrencias: ocorrencias,
            ajuste,
            extras: feriados,
            dividirValor: false,
          });

    if (t.tipo === "debito") {
      let primeira: ContaPagar;
      let qtdExtra = 0;

      if (parcelas > 1) {
        primeira = await contaPagarService.create(empresaId, {
          fornecedor: pessoa,
          categoriaId: input.categoriaId,
          centroCustoId,
          contaFinanceiraId,
          valor,
          dataCompetencia: t.data,
          dataVencimento: t.data,
          status: "aberta",
          observacao: observacaoBase,
          parcelas,
          simulacao: sim,
          ajusteDiaNaoUtil: ajuste,
        });
        qtdExtra = Math.max(0, (sim.length || parcelas) - 1);
      } else if (recorrencia && ocorrencias > 1) {
        primeira = await contaPagarService.create(empresaId, {
          fornecedor: pessoa,
          categoriaId: input.categoriaId,
          centroCustoId,
          contaFinanceiraId,
          valor,
          dataCompetencia: t.data,
          dataVencimento: t.data,
          status: "aberta",
          observacao: observacaoBase,
          recorrencia,
          recorrenciaDias: diasRec,
          recorrenciaOcorrencias: ocorrencias,
          simulacao: sim,
          ajusteDiaNaoUtil: ajuste,
        });
        qtdExtra = Math.max(0, (sim.length || ocorrencias) - 1);
      } else {
        primeira = await contaPagarService.create(empresaId, {
          fornecedor: pessoa,
          categoriaId: input.categoriaId,
          centroCustoId,
          contaFinanceiraId,
          valor,
          dataCompetencia: t.data,
          dataVencimento: t.data,
          status: "aberta",
          observacao: observacaoBase,
          ajusteDiaNaoUtil: ajuste,
        });
      }

      await contaPagarService.registrarPagamento(empresaId, primeira.id, valor, t.data);
      await transacaoTable.update(empresaId, transacaoId, {
        statusConciliacao: "conciliada",
        contaPagarId: primeira.id,
        contaReceberId: null,
      });
      await logAudit({
        empresaId,
        entidade: "TransacaoBancaria",
        entidadeId: transacaoId,
        acao: "inclusao",
        descricao:
          qtdExtra > 0
            ? `Conta a pagar (1ª de ${qtdExtra + 1}) criada/baixada a partir do extrato (${pessoa}).`
            : `Conta a pagar criada e baixada a partir do extrato (${pessoa}).`,
      });
      return { tipo: "pagar" as const, contaId: primeira.id, extras: qtdExtra };
    }

    let primeira: ContaReceber;
    let qtdExtra = 0;

    if (parcelas > 1) {
      primeira = await contaReceberService.create(empresaId, {
        cliente: pessoa,
        categoriaId: input.categoriaId,
        centroCustoId,
        contaFinanceiraId,
        valor,
        dataCompetencia: t.data,
        dataVencimento: t.data,
        status: "aberta",
        observacao: observacaoBase,
        parcelas,
        simulacao: sim,
        ajusteDiaNaoUtil: ajuste,
      });
      qtdExtra = Math.max(0, (sim.length || parcelas) - 1);
    } else if (recorrencia && ocorrencias > 1) {
      primeira = await contaReceberService.create(empresaId, {
        cliente: pessoa,
        categoriaId: input.categoriaId,
        centroCustoId,
        contaFinanceiraId,
        valor,
        dataCompetencia: t.data,
        dataVencimento: t.data,
        status: "aberta",
        observacao: observacaoBase,
        recorrencia,
        recorrenciaDias: diasRec,
        recorrenciaOcorrencias: ocorrencias,
        simulacao: sim,
        ajusteDiaNaoUtil: ajuste,
      });
      qtdExtra = Math.max(0, (sim.length || ocorrencias) - 1);
    } else {
      primeira = await contaReceberService.create(empresaId, {
        cliente: pessoa,
        categoriaId: input.categoriaId,
        centroCustoId,
        contaFinanceiraId,
        valor,
        dataCompetencia: t.data,
        dataVencimento: t.data,
        status: "aberta",
        observacao: observacaoBase,
        ajusteDiaNaoUtil: ajuste,
      });
    }

    await contaReceberService.registrarRecebimento(empresaId, primeira.id, valor, t.data);
    await transacaoTable.update(empresaId, transacaoId, {
      statusConciliacao: "conciliada",
      contaReceberId: primeira.id,
      contaPagarId: null,
    });
    await logAudit({
      empresaId,
      entidade: "TransacaoBancaria",
      entidadeId: transacaoId,
      acao: "inclusao",
      descricao:
        qtdExtra > 0
          ? `Conta a receber (1ª de ${qtdExtra + 1}) criada/baixada a partir do extrato (${pessoa}).`
          : `Conta a receber criada e baixada a partir do extrato (${pessoa}).`,
    });
    return { tipo: "receber" as const, contaId: primeira.id, extras: qtdExtra };
  },

  /**
   * Lança várias pendentes. `resolver` devolve pessoa + categoria por transação
   * (ou null para pular). Retorna contagens de sucesso / puladas / erros.
   */
  async lancarPendentes(
    empresaId: string,
    ids: string[],
    resolver: (
      t: TransacaoBancaria
    ) => { pessoa: string; categoriaId: string } | null | Promise<{ pessoa: string; categoriaId: string } | null>
  ): Promise<{ ok: number; puladas: number; erros: string[] }> {
    let ok = 0;
    let puladas = 0;
    const erros: string[] = [];
    for (const id of ids) {
      const t = await transacaoTable.find(empresaId, id);
      if (!t || t.statusConciliacao !== "pendente") {
        puladas++;
        continue;
      }
      const input = await resolver(t);
      if (!input?.categoriaId) {
        puladas++;
        continue;
      }
      try {
        await conciliacaoService.lancarDeTransacao(empresaId, id, {
          pessoa: input.pessoa || t.descricao || "Extrato bancário",
          categoriaId: input.categoriaId,
        });
        ok++;
      } catch (e) {
        erros.push(`${t.descricao || id}: ${(e as Error).message}`);
      }
    }
    return { ok, puladas, erros };
  },

  /** Reabre linhas do extrato quando o título CP/CR vinculado é excluído. */
  async reativarPorTitulo(
    empresaId: string,
    alvo: { contaPagarId?: string; contaReceberId?: string }
  ) {
    const n = await reativarTransacoesPorTitulo(empresaId, alvo);
    if (n > 0) {
      await logAudit({
        empresaId,
        entidade: "TransacaoBancaria",
        entidadeId: alvo.contaPagarId ?? alvo.contaReceberId ?? "",
        acao: "alteracao",
        descricao: `${n} transação(ões) do extrato voltaram a pendente após exclusão do título.`,
      });
    }
    return n;
  },

  setStatus(empresaId: string, id: string, status: ConciliacaoStatus) {
    return transacaoTable.update(empresaId, id, { statusConciliacao: status });
  },

  remove: (empresaId: string, id: string) => transacaoTable.remove(empresaId, id),
};

// ---------------------------------------------------------------------------
// Motor de sugestões (valor, data, histórico, documento)
// ---------------------------------------------------------------------------
export interface Sugestao {
  tipo: "pagar" | "receber";
  id: string;
  pessoa: string;
  valor: number;
  saldo: number;
  dataVencimento: string;
  score: number;
  motivo: string;
}

function diffDias(a: string, b: string): number {
  return Math.abs(
    (new Date(a + "T00:00:00").getTime() - new Date(b + "T00:00:00").getTime()) / 86400000
  );
}

function titulosAbertos(status: string): boolean {
  return status === "aberta" || status === "parcial" || status === "vencida";
}

export async function sugerirConciliacao(empresaId: string, t: TransacaoBancaria): Promise<Sugestao[]> {
  const abs = Math.abs(t.valor);
  const sugestoes: Sugestao[] = [];

  const avaliar = (saldo: number, venc: string, documento: string, pessoa: string): { score: number; motivo: string } | null => {
    const motivos: string[] = [];
    let score = 0;
    const difValor = Math.abs(saldo - abs);
    if (difValor <= 0.01) {
      score += 60;
      motivos.push("valor exato");
    } else if (abs > 0 && difValor / abs <= 0.02) {
      score += 35;
      motivos.push("valor aproximado");
    } else {
      return null;
    }
    const dd = diffDias(t.data, venc);
    if (dd <= 2) {
      score += 25;
      motivos.push("data próxima");
    } else if (dd <= 7) {
      score += 12;
      motivos.push("data na semana");
    }
    if (documento && t.documento && documento === t.documento) {
      score += 20;
      motivos.push("documento igual");
    }
    if (pessoa && t.descricao && t.descricao.toLowerCase().includes(pessoa.toLowerCase().slice(0, 6))) {
      score += 15;
      motivos.push("histórico");
    }
    return { score, motivo: motivos.join(", ") };
  };

  if (t.tipo === "credito") {
    const receber = (await contaReceberService.list(empresaId)).filter(
      (c) => titulosAbertos(c.status) && !c.transferencia
    ) as ContaReceber[];
    for (const c of receber) {
      const saldo = c.valor - c.valorRecebido;
      const r = avaliar(saldo, c.dataVencimento, "", c.cliente);
      if (r) sugestoes.push({ tipo: "receber", id: c.id, pessoa: c.cliente, valor: c.valor, saldo, dataVencimento: c.dataVencimento, ...r });
    }
  } else {
    const pagar = (await contaPagarService.list(empresaId)).filter(
      (c) => titulosAbertos(c.status) && !c.transferencia
    ) as ContaPagar[];
    for (const c of pagar) {
      const saldo = c.valor - c.valorPago;
      const r = avaliar(saldo, c.dataVencimento, "", c.fornecedor);
      if (r) sugestoes.push({ tipo: "pagar", id: c.id, pessoa: c.fornecedor, valor: c.valor, saldo, dataVencimento: c.dataVencimento, ...r });
    }
  }

  return sugestoes.sort((a, b) => b.score - a.score).slice(0, 5);
}

// ---------------------------------------------------------------------------
// Regras de conciliação/categorização
// ---------------------------------------------------------------------------
export const regraService = {
  list: (empresaId: string) =>
    regraTable.list(empresaId, { column: "prioridade", ascending: false }),

  async create(empresaId: string, data: Omit<RegraConciliacao, "id" | "createdAt" | "updatedAt" | "empresaId">) {
    const r = await regraTable.create(empresaId, data);
    await logAudit({ empresaId, entidade: "RegraConciliacao", entidadeId: r.id, acao: "inclusao", descricao: `Regra "${r.nome}" criada.` });
    return r;
  },
  async update(empresaId: string, id: string, data: Partial<RegraConciliacao>) {
    const r = await regraTable.update(empresaId, id, data);
    await logAudit({ empresaId, entidade: "RegraConciliacao", entidadeId: id, acao: "alteracao", descricao: `Regra "${r.nome}" alterada.` });
    return r;
  },
  async remove(empresaId: string, id: string) {
    await regraTable.remove(empresaId, id);
    await logAudit({ empresaId, entidade: "RegraConciliacao", entidadeId: id, acao: "exclusao", descricao: "Regra excluída." });
  },
};

export function categoriaSugerida(regras: RegraConciliacao[], tipo: TransacaoTipo, descricao: string): string | null {
  const desc = descricao.toLowerCase();
  for (const r of regras) {
    if (!r.ativo) continue;
    if (r.tipo && r.tipo !== tipo) continue;
    if (r.palavraChave && desc.includes(r.palavraChave.toLowerCase())) return r.categoriaId;
  }
  return null;
}
