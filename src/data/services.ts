// Serviços de domínio (C3 — Supabase, assíncronos). Encapsulam regras de negócio + auditoria.
import type {
  Categoria,
  CategoriaGrupo,
  CategoriaTipo,
  CentroCusto,
  ContaFinanceira,
  ContaPagar,
  ContaReceber,
  Empresa,
  ImpostosRetidos,
  PagamentoConta,
  RecorrenciaTipo,
} from "@/types/domain";
import { today, uid } from "@/lib/utils";
import {
  addMonthsIso,
  splitParcelas,
  valorDevido,
  type LinhaSimulacao,
} from "@/lib/contaPagarExtras";
import {
  ajustarDiaUtil,
  vencimentoOcorrencia,
  vencimentoParcela,
  type AjusteDiaNaoUtil,
} from "@/lib/diaUtil";
import { getCurrentUser, logAudit } from "./audit";
import { feriadoService } from "./feriados";
import {
  categoriaGrupoTable,
  categoriaTable,
  centroCustoTable,
  contaFinanceiraTable,
  contaPagarTable,
  contaReceberTable,
  empresaTable,
  pagamentoContaTable,
} from "./repos";
import { reativarTransacoesPorTitulo } from "./transacaoVinculo";

// ---------------------------------------------------------------------------
// Empresas
// ---------------------------------------------------------------------------
export const empresaService = {
  async list(): Promise<Empresa[]> {
    return empresaTable.list({ column: "nome_fantasia" });
  },
  find: (id: string) => empresaTable.find(id),
  async create(
    data: Omit<
      Empresa,
      | "id"
      | "createdAt"
      | "updatedAt"
      | "acessoInicio"
      | "acessoFim"
      | "acessoBloqueado"
      | "acessoMotivo"
    >
  ): Promise<Empresa> {
    // Período grátis (30 dias) vem do trigger no banco.
    const e = await empresaTable.create(data as Omit<Empresa, "id" | "createdAt" | "updatedAt">);
    await logAudit({
      empresaId: e.id,
      entidade: "Empresa",
      entidadeId: e.id,
      acao: "inclusao",
      descricao: `Empresa "${e.nomeFantasia}" cadastrada.`,
    });
    return e;
  },
  async update(id: string, data: Partial<Empresa>): Promise<Empresa> {
    const e = await empresaTable.update(id, data);
    await logAudit({
      empresaId: id,
      entidade: "Empresa",
      entidadeId: id,
      acao: "alteracao",
      descricao: `Empresa "${e.nomeFantasia}" alterada.`,
    });
    return e;
  },
  async remove(id: string): Promise<void> {
    const e = await empresaTable.find(id);
    await empresaTable.remove(id);
    if (e) {
      await logAudit({
        empresaId: id,
        entidade: "Empresa",
        entidadeId: id,
        acao: "exclusao",
        descricao: `Empresa "${e.nomeFantasia}" excluída.`,
      });
    }
  },
};

// ---------------------------------------------------------------------------
// Categorias e grupos
// ---------------------------------------------------------------------------
export const categoriaGrupoService = {
  async list(empresaId: string): Promise<CategoriaGrupo[]> {
    return (await categoriaGrupoTable.list(empresaId)).sort((a, b) => a.nome.localeCompare(b.nome));
  },
  async listAtivos(empresaId: string, tipo?: CategoriaTipo): Promise<CategoriaGrupo[]> {
    return (await categoriaGrupoTable.list(empresaId))
      .filter((g) => g.ativo && (!tipo || g.tipo === tipo))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  },
  async create(empresaId: string, data: { nome: string; tipo: CategoriaTipo; ativo: boolean }) {
    const g = await categoriaGrupoTable.create(empresaId, data);
    await logAudit({
      empresaId,
      entidade: "CategoriaGrupo",
      entidadeId: g.id,
      acao: "inclusao",
      descricao: `Grupo de categoria "${g.nome}" criado.`,
    });
    return g;
  },
  async update(empresaId: string, id: string, data: Partial<CategoriaGrupo>) {
    const g = await categoriaGrupoTable.update(empresaId, id, data);
    await logAudit({
      empresaId,
      entidade: "CategoriaGrupo",
      entidadeId: id,
      acao: "alteracao",
      descricao: `Grupo de categoria "${g.nome}" alterado.`,
    });
    return g;
  },
  async remove(empresaId: string, id: string) {
    const g = await categoriaGrupoTable.find(empresaId, id);
    await categoriaGrupoTable.remove(empresaId, id);
    if (g) {
      await logAudit({
        empresaId,
        entidade: "CategoriaGrupo",
        entidadeId: id,
        acao: "exclusao",
        descricao: `Grupo de categoria "${g.nome}" excluído.`,
      });
    }
  },
};

export const categoriaService = {
  async list(empresaId: string): Promise<Categoria[]> {
    return (await categoriaTable.list(empresaId)).sort((a, b) => a.nome.localeCompare(b.nome));
  },
  /** Categorias-folha ativas (usadas em lançamentos — nunca são grupos). */
  async listAtivas(empresaId: string, tipo?: CategoriaTipo): Promise<Categoria[]> {
    return (await categoriaTable.list(empresaId))
      .filter((c) => c.ativo && (!tipo || c.tipo === tipo))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  },
  async create(
    empresaId: string,
    data: { nome: string; tipo: CategoriaTipo; ativo: boolean; grupoId?: string | null }
  ) {
    const c = await categoriaTable.create(empresaId, {
      nome: data.nome,
      tipo: data.tipo,
      ativo: data.ativo,
      grupoId: data.grupoId ?? null,
    });
    await logAudit({ empresaId, entidade: "Categoria", entidadeId: c.id, acao: "inclusao", descricao: `Categoria "${c.nome}" criada.` });
    return c;
  },
  async update(empresaId: string, id: string, data: Partial<Categoria>) {
    const c = await categoriaTable.update(empresaId, id, data);
    await logAudit({ empresaId, entidade: "Categoria", entidadeId: id, acao: "alteracao", descricao: `Categoria "${c.nome}" alterada.` });
    return c;
  },
  async remove(empresaId: string, id: string) {
    const c = await categoriaTable.find(empresaId, id);
    await categoriaTable.remove(empresaId, id);
    if (c) await logAudit({ empresaId, entidade: "Categoria", entidadeId: id, acao: "exclusao", descricao: `Categoria "${c.nome}" excluída.` });
  },
};

// ---------------------------------------------------------------------------
// Centro de Custo
// ---------------------------------------------------------------------------
export const centroCustoService = {
  async list(empresaId: string): Promise<CentroCusto[]> {
    return (await centroCustoTable.list(empresaId)).sort((a, b) => a.nome.localeCompare(b.nome));
  },
  async listAtivos(empresaId: string): Promise<CentroCusto[]> {
    return (await centroCustoTable.list(empresaId))
      .filter((c) => c.ativo !== false)
      .sort((a, b) => a.nome.localeCompare(b.nome));
  },
  async create(empresaId: string, data: { nome: string; codigo: string; ativo: boolean }) {
    const c = await centroCustoTable.create(empresaId, data);
    await logAudit({ empresaId, entidade: "CentroCusto", entidadeId: c.id, acao: "inclusao", descricao: `Centro de custo "${c.nome}" criado.` });
    return c;
  },
  async update(empresaId: string, id: string, data: Partial<CentroCusto>) {
    const c = await centroCustoTable.update(empresaId, id, data);
    await logAudit({ empresaId, entidade: "CentroCusto", entidadeId: id, acao: "alteracao", descricao: `Centro de custo "${c.nome}" alterado.` });
    return c;
  },
  async remove(empresaId: string, id: string) {
    const c = await centroCustoTable.find(empresaId, id);
    await centroCustoTable.remove(empresaId, id);
    if (c) await logAudit({ empresaId, entidade: "CentroCusto", entidadeId: id, acao: "exclusao", descricao: `Centro de custo "${c.nome}" excluído.` });
  },
};

// ---------------------------------------------------------------------------
// Contas e Cartões
// ---------------------------------------------------------------------------
export type ContaFinanceiraInput = Omit<
  ContaFinanceira,
  "id" | "createdAt" | "updatedAt" | "empresaId"
>;

function descreveContaFinanceira(c: ContaFinanceira): string {
  const titular = c.titular?.trim() ? ` (titular ${c.titular.trim()})` : "";
  return c.tipo === "cartao_credito"
    ? `Cartão "${c.nome}"${titular}`
    : `Conta "${c.nome}"${titular}`;
}

export const contaFinanceiraService = {
  async list(empresaId: string): Promise<ContaFinanceira[]> {
    return (await contaFinanceiraTable.list(empresaId)).sort((a, b) =>
      a.nome.localeCompare(b.nome)
    );
  },
  async listAtivas(empresaId: string): Promise<ContaFinanceira[]> {
    return (await contaFinanceiraTable.list(empresaId))
      .filter((c) => c.ativo !== false)
      .sort((a, b) => a.nome.localeCompare(b.nome));
  },
  async create(empresaId: string, data: ContaFinanceiraInput) {
    const c = await contaFinanceiraTable.create(empresaId, data);
    await logAudit({ empresaId, entidade: "ContaFinanceira", entidadeId: c.id, acao: "inclusao", descricao: `${descreveContaFinanceira(c)} cadastrado(a).` });
    return c;
  },
  async update(empresaId: string, id: string, data: Partial<ContaFinanceira>) {
    const c = await contaFinanceiraTable.update(empresaId, id, data);
    await logAudit({ empresaId, entidade: "ContaFinanceira", entidadeId: id, acao: "alteracao", descricao: `${descreveContaFinanceira(c)} alterado(a).` });
    return c;
  },
  async remove(empresaId: string, id: string) {
    const c = await contaFinanceiraTable.find(empresaId, id);
    await contaFinanceiraTable.remove(empresaId, id);
    if (c) await logAudit({ empresaId, entidade: "ContaFinanceira", entidadeId: id, acao: "exclusao", descricao: `${descreveContaFinanceira(c)} excluído(a).` });
  },
};

// ---------------------------------------------------------------------------
// Status derivado (vencida) — calculado em tempo de leitura
// ---------------------------------------------------------------------------
function isOverdue(dataVencimento: string): boolean {
  return dataVencimento < today();
}

export function withDerivedPagarStatus(c: ContaPagar): ContaPagar {
  if ((c.status === "aberta" || c.status === "parcial") && isOverdue(c.dataVencimento)) {
    return { ...c, status: "vencida" };
  }
  return c;
}

export function withDerivedReceberStatus(c: ContaReceber): ContaReceber {
  if ((c.status === "aberta" || c.status === "parcial") && isOverdue(c.dataVencimento)) {
    return { ...c, status: "vencida" };
  }
  return c;
}

// ---------------------------------------------------------------------------
// Contas a Pagar
// ---------------------------------------------------------------------------
/** Campos de criação; extras da Fase 2 têm default para não quebrar callers legados. */
type ContaPagarInput = Omit<
  ContaPagar,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "empresaId"
  | "createdBy"
  | "valorPago"
  | "dataPagamento"
  | "contaFinanceiraId"
  | "fornecedorId"
  | "desconto"
  | "juros"
  | "numeroNf"
  | "impostos"
  | "parcelaNumero"
  | "parcelaTotal"
  | "grupoParcelamento"
  | "recorrencia"
  | "recorrenciaDias"
  | "grupoRecorrencia"
  | "transferencia"
> & {
  valorPago?: number;
  dataPagamento?: string | null;
  contaFinanceiraId?: string | null;
  fornecedorId?: string | null;
  desconto?: number;
  juros?: number;
  numeroNf?: string;
  impostos?: ImpostosRetidos | null;
  parcelaNumero?: number | null;
  parcelaTotal?: number | null;
  grupoParcelamento?: string | null;
  recorrencia?: RecorrenciaTipo | null;
  recorrenciaDias?: number | null;
  grupoRecorrencia?: string | null;
  /** Ao criar: gera N títulos mensais (parcelamento). Ignorado na edição. */
  parcelas?: number;
  /** Ao criar com `recorrencia`: quantas ocorrências gerar (inclui a primeira). */
  recorrenciaOcorrencias?: number;
  transferencia?: boolean;
  ajusteDiaNaoUtil?: AjusteDiaNaoUtil;
  /** Se informado, grava estes títulos em vez de gerar as datas/valores. */
  simulacao?: LinhaSimulacao[];
};

function normalizePagarExtras(data: ContaPagarInput) {
  const recorrencia = data.recorrencia ?? null;
  const dias =
    recorrencia === "personalizada"
      ? Math.max(1, Math.min(365, Math.floor(data.recorrenciaDias ?? 1)))
      : null;
  return {
    desconto: data.desconto ?? 0,
    juros: data.juros ?? 0,
    numeroNf: data.numeroNf ?? "",
    impostos: data.impostos ?? null,
    parcelaNumero: data.parcelaNumero ?? null,
    parcelaTotal: data.parcelaTotal ?? null,
    grupoParcelamento: data.grupoParcelamento ?? null,
    recorrencia,
    recorrenciaDias: dias,
    grupoRecorrencia: data.grupoRecorrencia ?? null,
  };
}

async function insertPagar(
  empresaId: string,
  data: ContaPagarInput,
  overrides: Partial<ContaPagar> = {}
): Promise<ContaPagar> {
  const extras = normalizePagarExtras(data);
  const {
    parcelas: _p,
    recorrenciaOcorrencias: _r,
    ajusteDiaNaoUtil: _a,
    simulacao: _s,
    ...rest
  } = data;
  void _p;
  void _r;
  void _a;
  void _s;
  return contaPagarTable.create(empresaId, {
    ...rest,
    ...extras,
    valorPago: data.valorPago ?? 0,
    dataPagamento: data.dataPagamento ?? null,
    transferencia: data.transferencia ?? false,
    contaFinanceiraId: data.contaFinanceiraId ?? null,
    fornecedorId: data.fornecedorId ?? null,
    createdBy: getCurrentUser(),
    ...overrides,
  } as Omit<ContaPagar, "id" | "createdAt" | "updatedAt" | "empresaId">);
}

export const contaPagarService = {
  async list(empresaId: string): Promise<ContaPagar[]> {
    return (await contaPagarTable.list(empresaId))
      .map(withDerivedPagarStatus)
      .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento));
  },
  async find(empresaId: string, id: string) {
    const c = await contaPagarTable.find(empresaId, id);
    return c ? withDerivedPagarStatus(c) : undefined;
  },
  /**
   * Cria um título. Com `parcelas` > 1 gera série parcelada; com `recorrencia` +
   * `recorrenciaOcorrencias` > 1 gera série recorrente. Parcelamento tem prioridade.
   * Retorna o primeiro título da série (quando aplicável).
   */
  async create(empresaId: string, data: ContaPagarInput): Promise<ContaPagar> {
    const parcelas = Math.max(1, Math.floor(data.parcelas ?? 1));
    const ocorrencias = Math.max(1, Math.floor(data.recorrenciaOcorrencias ?? 1));
    const ajuste: AjusteDiaNaoUtil = data.ajusteDiaNaoUtil ?? "atrasar";
    const feriados = await feriadoService.extras(empresaId);
    const sim = data.simulacao ?? [];

    if (parcelas > 1) {
      const grupo = uid();
      const valores = splitParcelas(data.valor, parcelas);
      const criadas: ContaPagar[] = [];
      const n = sim.length > 1 ? sim.length : parcelas;
      for (let i = 0; i < n; i++) {
        const linha = sim[i];
        const c = await insertPagar(empresaId, data, {
          valor: linha?.valor ?? valores[i] ?? data.valor,
          parcelaNumero: i + 1,
          parcelaTotal: n,
          grupoParcelamento: grupo,
          dataVencimento:
            linha?.dataVencimento ?? vencimentoParcela(data.dataVencimento, i, ajuste, feriados),
          dataCompetencia: linha?.dataCompetencia ?? addMonthsIso(data.dataCompetencia, i),
          recorrencia: null,
          recorrenciaDias: null,
          grupoRecorrencia: null,
        });
        criadas.push(c);
      }
      await logAudit({
        empresaId,
        entidade: "ContaPagar",
        entidadeId: criadas[0].id,
        acao: "inclusao",
        descricao: `Parcelamento (${parcelas}x) p/ "${data.fornecedor}" criado.`,
      });
      return criadas[0];
    }

    if (data.recorrencia && ocorrencias > 1) {
      if (data.recorrencia === "personalizada") {
        const dias = Math.floor(data.recorrenciaDias ?? 0);
        if (!dias || dias < 1) {
          throw new Error("Informe o intervalo em dias para a repetição personalizada.");
        }
      }
      const grupo = uid();
      const criadas: ContaPagar[] = [];
      const dias =
        data.recorrencia === "personalizada"
          ? Math.max(1, Math.min(365, Math.floor(data.recorrenciaDias ?? 1)))
          : null;
      const n = sim.length > 1 ? sim.length : ocorrencias;
      for (let i = 0; i < n; i++) {
        const linha = sim[i];
        const c = await insertPagar(empresaId, data, {
          valor: linha?.valor ?? data.valor,
          dataVencimento:
            linha?.dataVencimento ??
            vencimentoOcorrencia(data.dataVencimento, i, data.recorrencia, dias, ajuste, feriados),
          dataCompetencia:
            linha?.dataCompetencia ??
            vencimentoOcorrencia(data.dataCompetencia, i, data.recorrencia, dias, "manter"),
          recorrencia: data.recorrencia,
          recorrenciaDias: dias,
          grupoRecorrencia: grupo,
          parcelaNumero: null,
          parcelaTotal: null,
          grupoParcelamento: null,
        });
        criadas.push(c);
      }
      const rotulo =
        data.recorrencia === "personalizada"
          ? `a cada ${dias} dia(s)`
          : data.recorrencia;
      await logAudit({
        empresaId,
        entidade: "ContaPagar",
        entidadeId: criadas[0].id,
        acao: "inclusao",
        descricao: `Série recorrente (${ocorrencias}× ${rotulo}) p/ "${data.fornecedor}" criada.`,
      });
      return criadas[0];
    }

    const c = await insertPagar(empresaId, data, {
      dataVencimento: ajustarDiaUtil(data.dataVencimento, ajuste, feriados),
    });
    await logAudit({
      empresaId,
      entidade: "ContaPagar",
      entidadeId: c.id,
      acao: "inclusao",
      descricao: `Conta a pagar p/ "${c.fornecedor}" criada.`,
    });
    return c;
  },
  async update(empresaId: string, id: string, data: Partial<ContaPagar>) {
    const c = await contaPagarTable.update(empresaId, id, data);
    await logAudit({ empresaId, entidade: "ContaPagar", entidadeId: id, acao: "alteracao", descricao: `Conta a pagar p/ "${c.fornecedor}" alterada.` });
    return c;
  },
  /** Pagamento avulso: baixa parcial ou total + linha em `pagamentos_conta`. */
  async registrarPagamento(
    empresaId: string,
    id: string,
    valor: number,
    data: string,
    observacao = ""
  ) {
    const atual = await contaPagarTable.find(empresaId, id);
    if (!atual) throw new Error("Conta não encontrada.");
    if (valor <= 0) throw new Error("O valor do pagamento deve ser positivo.");
    const devido = valorDevido(atual);
    const saldo = Math.max(0, devido - (atual.valorPago ?? 0));
    if (valor > saldo + 0.001) {
      throw new Error(`Valor excede o saldo em aberto (${saldo.toFixed(2)}).`);
    }
    const valorPago = Number(((atual.valorPago ?? 0) + valor).toFixed(2));
    const quitada = valorPago >= devido - 0.001;
    const c = await contaPagarTable.update(empresaId, id, {
      valorPago,
      dataPagamento: quitada ? data : atual.dataPagamento ?? data,
      status: quitada ? "paga" : "parcial",
    });
    await pagamentoContaTable.create(empresaId, {
      contaPagarId: id,
      data,
      valor,
      observacao,
    });
    await logAudit({
      empresaId,
      entidade: "ContaPagar",
      entidadeId: id,
      acao: "baixa",
      descricao: `Pagamento de ${valor} registrado (${c.status}).`,
    });
    return c;
  },
  /** Desfaz uma baixa (conciliação desfeita): devolve o título a aberto se não restar pagamento. */
  async estornarPagamento(empresaId: string, id: string, valor: number) {
    const atual = await contaPagarTable.find(empresaId, id);
    if (!atual || valor <= 0) return atual;
    const valorPago = Math.max(0, Number(((atual.valorPago ?? 0) - valor).toFixed(2)));
    const devido = valorDevido(atual);
    const status = valorPago <= 0.001 ? "aberta" : valorPago >= devido - 0.001 ? "paga" : "parcial";
    const c = await contaPagarTable.update(empresaId, id, {
      valorPago,
      dataPagamento: valorPago <= 0.001 ? null : atual.dataPagamento,
      status,
    });
    const pagamentos = (await pagamentoContaTable.list(empresaId))
      .filter((p) => p.contaPagarId === id && Math.abs(p.valor - valor) < 0.001)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (pagamentos[0]) await pagamentoContaTable.remove(empresaId, pagamentos[0].id);
    await logAudit({
      empresaId,
      entidade: "ContaPagar",
      entidadeId: id,
      acao: "alteracao",
      descricao: `Baixa de ${valor} desfeita. Título voltou para ${c.status}.`,
    });
    return c;
  },
  async listPagamentos(empresaId: string, contaPagarId: string): Promise<PagamentoConta[]> {
    return (await pagamentoContaTable.list(empresaId))
      .filter((p) => p.contaPagarId === contaPagarId)
      .sort((a, b) => a.data.localeCompare(b.data) || a.createdAt.localeCompare(b.createdAt));
  },
  async cancelar(empresaId: string, id: string) {
    const c = await contaPagarTable.update(empresaId, id, { status: "cancelada" });
    await logAudit({ empresaId, entidade: "ContaPagar", entidadeId: id, acao: "cancelamento", descricao: "Conta a pagar cancelada." });
    return c;
  },
  async remove(empresaId: string, id: string) {
    await reativarTransacoesPorTitulo(empresaId, { contaPagarId: id });
    await contaPagarTable.remove(empresaId, id);
    await logAudit({
      empresaId,
      entidade: "ContaPagar",
      entidadeId: id,
      acao: "exclusao",
      descricao: "Conta a pagar excluída.",
    });
  },
};

// ---------------------------------------------------------------------------
// Contas a Receber
// ---------------------------------------------------------------------------
type ContaReceberInput = Omit<
  ContaReceber,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "empresaId"
  | "createdBy"
  | "valorRecebido"
  | "dataRecebimento"
  | "contaFinanceiraId"
  | "clienteId"
  | "transferencia"
  | "parcelaNumero"
  | "parcelaTotal"
  | "grupoParcelamento"
  | "recorrencia"
  | "recorrenciaDias"
  | "grupoRecorrencia"
  | "numeroNf"
> & {
  valorRecebido?: number;
  dataRecebimento?: string | null;
  contaFinanceiraId?: string | null;
  clienteId?: string | null;
  transferencia?: boolean;
  parcelaNumero?: number | null;
  parcelaTotal?: number | null;
  grupoParcelamento?: string | null;
  recorrencia?: RecorrenciaTipo | null;
  recorrenciaDias?: number | null;
  grupoRecorrencia?: string | null;
  numeroNf?: string;
  parcelas?: number;
  recorrenciaOcorrencias?: number;
  ajusteDiaNaoUtil?: AjusteDiaNaoUtil;
  simulacao?: LinhaSimulacao[];
};

function normalizeReceberSerie(data: ContaReceberInput) {
  const recorrencia = data.recorrencia ?? null;
  const dias =
    recorrencia === "personalizada"
      ? Math.max(1, Math.min(365, Math.floor(data.recorrenciaDias ?? 1)))
      : null;
  return {
    parcelaNumero: data.parcelaNumero ?? null,
    parcelaTotal: data.parcelaTotal ?? null,
    grupoParcelamento: data.grupoParcelamento ?? null,
    recorrencia,
    recorrenciaDias: dias,
    grupoRecorrencia: data.grupoRecorrencia ?? null,
  };
}

async function insertReceber(
  empresaId: string,
  data: ContaReceberInput,
  overrides: Partial<ContaReceber> = {}
): Promise<ContaReceber> {
  const extras = normalizeReceberSerie(data);
  const { parcelas: _p, recorrenciaOcorrencias: _r, ajusteDiaNaoUtil: _a, simulacao: _s, ...rest } = data;
  void _p;
  void _r;
  void _a;
  void _s;
  return contaReceberTable.create(empresaId, {
    ...rest,
    ...extras,
    numeroNf: data.numeroNf ?? "",
    contaFinanceiraId: data.contaFinanceiraId ?? null,
    clienteId: data.clienteId ?? null,
    valorRecebido: data.valorRecebido ?? 0,
    dataRecebimento: data.dataRecebimento ?? null,
    transferencia: data.transferencia ?? false,
    createdBy: getCurrentUser(),
    ...overrides,
  } as Omit<ContaReceber, "id" | "createdAt" | "updatedAt" | "empresaId">);
}

export const contaReceberService = {
  async list(empresaId: string): Promise<ContaReceber[]> {
    return (await contaReceberTable.list(empresaId))
      .map(withDerivedReceberStatus)
      .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento));
  },
  async find(empresaId: string, id: string) {
    const c = await contaReceberTable.find(empresaId, id);
    return c ? withDerivedReceberStatus(c) : undefined;
  },
  /**
   * Cria um título. Com `parcelas` > 1 gera série parcelada; com `recorrencia` +
   * `recorrenciaOcorrencias` > 1 gera série recorrente. Parcelamento tem prioridade.
   */
  async create(empresaId: string, data: ContaReceberInput): Promise<ContaReceber> {
    const parcelas = Math.max(1, Math.floor(data.parcelas ?? 1));
    const ocorrencias = Math.max(1, Math.floor(data.recorrenciaOcorrencias ?? 1));
    const ajuste: AjusteDiaNaoUtil = data.ajusteDiaNaoUtil ?? "atrasar";
    const feriados = await feriadoService.extras(empresaId);
    const sim = data.simulacao ?? [];

    if (parcelas > 1) {
      const grupo = uid();
      const valores = splitParcelas(data.valor, parcelas);
      const criadas: ContaReceber[] = [];
      const n = sim.length > 1 ? sim.length : parcelas;
      for (let i = 0; i < n; i++) {
        const linha = sim[i];
        const c = await insertReceber(empresaId, data, {
          valor: linha?.valor ?? valores[i] ?? data.valor,
          parcelaNumero: i + 1,
          parcelaTotal: n,
          grupoParcelamento: grupo,
          dataVencimento:
            linha?.dataVencimento ?? vencimentoParcela(data.dataVencimento, i, ajuste, feriados),
          dataCompetencia: linha?.dataCompetencia ?? addMonthsIso(data.dataCompetencia, i),
          recorrencia: null,
          recorrenciaDias: null,
          grupoRecorrencia: null,
        });
        criadas.push(c);
      }
      await logAudit({
        empresaId,
        entidade: "ContaReceber",
        entidadeId: criadas[0].id,
        acao: "inclusao",
        descricao: `Parcelamento (${parcelas}x) de "${data.cliente}" criado.`,
      });
      return criadas[0];
    }

    if (data.recorrencia && ocorrencias > 1) {
      if (data.recorrencia === "personalizada") {
        const dias = Math.floor(data.recorrenciaDias ?? 0);
        if (!dias || dias < 1) {
          throw new Error("Informe o intervalo em dias para a repetição personalizada.");
        }
      }
      const grupo = uid();
      const criadas: ContaReceber[] = [];
      const dias =
        data.recorrencia === "personalizada"
          ? Math.max(1, Math.min(365, Math.floor(data.recorrenciaDias ?? 1)))
          : null;
      const n = sim.length > 1 ? sim.length : ocorrencias;
      for (let i = 0; i < n; i++) {
        const linha = sim[i];
        const c = await insertReceber(empresaId, data, {
          valor: linha?.valor ?? data.valor,
          dataVencimento:
            linha?.dataVencimento ??
            vencimentoOcorrencia(data.dataVencimento, i, data.recorrencia, dias, ajuste, feriados),
          dataCompetencia:
            linha?.dataCompetencia ??
            vencimentoOcorrencia(data.dataCompetencia, i, data.recorrencia, dias, "manter"),
          recorrencia: data.recorrencia,
          recorrenciaDias: dias,
          grupoRecorrencia: grupo,
          parcelaNumero: null,
          parcelaTotal: null,
          grupoParcelamento: null,
        });
        criadas.push(c);
      }
      const rotulo =
        data.recorrencia === "personalizada"
          ? `a cada ${dias} dia(s)`
          : data.recorrencia;
      await logAudit({
        empresaId,
        entidade: "ContaReceber",
        entidadeId: criadas[0].id,
        acao: "inclusao",
        descricao: `Série recorrente (${ocorrencias}× ${rotulo}) de "${data.cliente}" criada.`,
      });
      return criadas[0];
    }

    const c = await insertReceber(empresaId, data, {
      dataVencimento: ajustarDiaUtil(data.dataVencimento, ajuste, feriados),
    });
    await logAudit({
      empresaId,
      entidade: "ContaReceber",
      entidadeId: c.id,
      acao: "inclusao",
      descricao: `Conta a receber de "${c.cliente}" criada.`,
    });
    return c;
  },
  async update(empresaId: string, id: string, data: Partial<ContaReceber>) {
    const c = await contaReceberTable.update(empresaId, id, data);
    await logAudit({ empresaId, entidade: "ContaReceber", entidadeId: id, acao: "alteracao", descricao: `Conta a receber de "${c.cliente}" alterada.` });
    return c;
  },
  async registrarRecebimento(empresaId: string, id: string, valor: number, data: string) {
    const atual = await contaReceberTable.find(empresaId, id);
    if (!atual) throw new Error("Conta não encontrada.");
    if (valor <= 0) throw new Error("O valor do recebimento deve ser positivo.");
    const valorRecebido = Math.min(atual.valor, atual.valorRecebido + valor);
    const quitada = valorRecebido >= atual.valor - 0.001;
    const c = await contaReceberTable.update(empresaId, id, {
      valorRecebido,
      dataRecebimento: quitada ? data : atual.dataRecebimento ?? data,
      status: quitada ? "recebida" : "parcial",
    });
    await logAudit({ empresaId, entidade: "ContaReceber", entidadeId: id, acao: "baixa", descricao: `Recebimento de ${valor} registrado (${c.status}).` });
    return c;
  },
  /** Desfaz um recebimento (conciliação desfeita): devolve o título a aberto se não restar valor. */
  async estornarRecebimento(empresaId: string, id: string, valor: number) {
    const atual = await contaReceberTable.find(empresaId, id);
    if (!atual || valor <= 0) return atual;
    const valorRecebido = Math.max(0, Number((atual.valorRecebido - valor).toFixed(2)));
    const status = valorRecebido <= 0.001 ? "aberta" : valorRecebido >= atual.valor - 0.001 ? "recebida" : "parcial";
    const c = await contaReceberTable.update(empresaId, id, {
      valorRecebido,
      dataRecebimento: valorRecebido <= 0.001 ? null : atual.dataRecebimento,
      status,
    });
    await logAudit({
      empresaId,
      entidade: "ContaReceber",
      entidadeId: id,
      acao: "alteracao",
      descricao: `Recebimento de ${valor} desfeito. Título voltou para ${c.status}.`,
    });
    return c;
  },
  async cancelar(empresaId: string, id: string) {
    const c = await contaReceberTable.update(empresaId, id, { status: "cancelada" });
    await logAudit({ empresaId, entidade: "ContaReceber", entidadeId: id, acao: "cancelamento", descricao: "Conta a receber cancelada." });
    return c;
  },
  async remove(empresaId: string, id: string) {
    await reativarTransacoesPorTitulo(empresaId, { contaReceberId: id });
    await contaReceberTable.remove(empresaId, id);
    await logAudit({
      empresaId,
      entidade: "ContaReceber",
      entidadeId: id,
      acao: "exclusao",
      descricao: "Conta a receber excluída.",
    });
  },
};
