// Fase 2 — serviços de Conciliação Bancária (C3 — Supabase, assíncronos).
import type {
  ConciliacaoStatus,
  ContaPagar,
  ContaReceber,
  RegraConciliacao,
  TransacaoBancaria,
  TransacaoTipo,
} from "@/types/domain";
import type { OfxResultado } from "@/lib/ofx";
import { logAudit } from "./audit";
import { extratoTable, regraTable, transacaoTable } from "./repos";
import { contaPagarService, contaReceberService } from "./services";

export interface ImportResumo {
  extratoId: string;
  importadas: number;
  duplicadas: number;
}

export const conciliacaoService = {
  listExtratos: (empresaId: string) =>
    extratoTable.list(empresaId, { column: "created_at", ascending: false }),

  listTransacoes: (empresaId: string) =>
    transacaoTable.list(empresaId, { column: "data", ascending: false }),

  async importarOFX(empresaId: string, ofx: OfxResultado): Promise<ImportResumo> {
    const extrato = await extratoTable.create(empresaId, {
      banco: ofx.banco,
      conta: ofx.conta,
      dataInicio: ofx.dataInicio,
      dataFim: ofx.dataFim,
      arquivoNome: "",
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
    await transacaoTable.update(empresaId, id, {
      statusConciliacao: "pendente",
      contaPagarId: null,
      contaReceberId: null,
    });
    await logAudit({ empresaId, entidade: "TransacaoBancaria", entidadeId: id, acao: "alteracao", descricao: "Conciliação desfeita." });
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
    const receber = (await contaReceberService.list(empresaId)).filter((c) => titulosAbertos(c.status)) as ContaReceber[];
    for (const c of receber) {
      const saldo = c.valor - c.valorRecebido;
      const r = avaliar(saldo, c.dataVencimento, "", c.cliente);
      if (r) sugestoes.push({ tipo: "receber", id: c.id, pessoa: c.cliente, valor: c.valor, saldo, dataVencimento: c.dataVencimento, ...r });
    }
  } else {
    const pagar = (await contaPagarService.list(empresaId)).filter((c) => titulosAbertos(c.status)) as ContaPagar[];
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
