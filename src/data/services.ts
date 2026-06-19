// Serviços de domínio (C3 — Supabase, assíncronos). Encapsulam regras de negócio + auditoria.
import type {
  Categoria,
  CategoriaTipo,
  CentroCusto,
  ContaPagar,
  ContaReceber,
  Empresa,
} from "@/types/domain";
import { today } from "@/lib/utils";
import { getCurrentUser, logAudit } from "./audit";
import {
  categoriaTable,
  centroCustoTable,
  contaPagarTable,
  contaReceberTable,
  empresaTable,
} from "./repos";

// ---------------------------------------------------------------------------
// Empresas
// ---------------------------------------------------------------------------
export const empresaService = {
  async list(): Promise<Empresa[]> {
    return empresaTable.list({ column: "nome_fantasia" });
  },
  find: (id: string) => empresaTable.find(id),
  async create(data: Omit<Empresa, "id" | "createdAt" | "updatedAt">): Promise<Empresa> {
    const e = await empresaTable.create(data);
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
// Categorias
// ---------------------------------------------------------------------------
export const categoriaService = {
  async list(empresaId: string): Promise<Categoria[]> {
    return (await categoriaTable.list(empresaId)).sort((a, b) => a.nome.localeCompare(b.nome));
  },
  async listAtivas(empresaId: string, tipo?: CategoriaTipo): Promise<Categoria[]> {
    return (await categoriaTable.list(empresaId))
      .filter((c) => c.ativo && (!tipo || c.tipo === tipo))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  },
  async create(empresaId: string, data: { nome: string; tipo: CategoriaTipo; ativo: boolean }) {
    const c = await categoriaTable.create(empresaId, data);
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
      .filter((c) => c.ativo)
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
type ContaPagarInput = Omit<
  ContaPagar,
  "id" | "createdAt" | "updatedAt" | "empresaId" | "createdBy" | "valorPago" | "dataPagamento"
> & { valorPago?: number; dataPagamento?: string | null };

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
  async create(empresaId: string, data: ContaPagarInput) {
    const c = await contaPagarTable.create(empresaId, {
      ...data,
      valorPago: data.valorPago ?? 0,
      dataPagamento: data.dataPagamento ?? null,
      createdBy: getCurrentUser(),
    } as Omit<ContaPagar, "id" | "createdAt" | "updatedAt" | "empresaId">);
    await logAudit({ empresaId, entidade: "ContaPagar", entidadeId: c.id, acao: "inclusao", descricao: `Conta a pagar p/ "${c.fornecedor}" criada.` });
    return c;
  },
  async update(empresaId: string, id: string, data: Partial<ContaPagar>) {
    const c = await contaPagarTable.update(empresaId, id, data);
    await logAudit({ empresaId, entidade: "ContaPagar", entidadeId: id, acao: "alteracao", descricao: `Conta a pagar p/ "${c.fornecedor}" alterada.` });
    return c;
  },
  async registrarPagamento(empresaId: string, id: string, valor: number, data: string) {
    const atual = await contaPagarTable.find(empresaId, id);
    if (!atual) throw new Error("Conta não encontrada.");
    if (valor <= 0) throw new Error("O valor do pagamento deve ser positivo.");
    const valorPago = Math.min(atual.valor, atual.valorPago + valor);
    const quitada = valorPago >= atual.valor - 0.001;
    const c = await contaPagarTable.update(empresaId, id, {
      valorPago,
      dataPagamento: quitada ? data : atual.dataPagamento ?? data,
      status: quitada ? "paga" : "parcial",
    });
    await logAudit({ empresaId, entidade: "ContaPagar", entidadeId: id, acao: "baixa", descricao: `Pagamento de ${valor} registrado (${c.status}).` });
    return c;
  },
  async cancelar(empresaId: string, id: string) {
    const c = await contaPagarTable.update(empresaId, id, { status: "cancelada" });
    await logAudit({ empresaId, entidade: "ContaPagar", entidadeId: id, acao: "cancelamento", descricao: "Conta a pagar cancelada." });
    return c;
  },
  async remove(empresaId: string, id: string) {
    await contaPagarTable.remove(empresaId, id);
    await logAudit({ empresaId, entidade: "ContaPagar", entidadeId: id, acao: "exclusao", descricao: "Conta a pagar excluída." });
  },
};

// ---------------------------------------------------------------------------
// Contas a Receber
// ---------------------------------------------------------------------------
type ContaReceberInput = Omit<
  ContaReceber,
  "id" | "createdAt" | "updatedAt" | "empresaId" | "createdBy" | "valorRecebido" | "dataRecebimento"
> & { valorRecebido?: number; dataRecebimento?: string | null };

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
  async create(empresaId: string, data: ContaReceberInput) {
    const c = await contaReceberTable.create(empresaId, {
      ...data,
      valorRecebido: data.valorRecebido ?? 0,
      dataRecebimento: data.dataRecebimento ?? null,
      createdBy: getCurrentUser(),
    } as Omit<ContaReceber, "id" | "createdAt" | "updatedAt" | "empresaId">);
    await logAudit({ empresaId, entidade: "ContaReceber", entidadeId: c.id, acao: "inclusao", descricao: `Conta a receber de "${c.cliente}" criada.` });
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
  async cancelar(empresaId: string, id: string) {
    const c = await contaReceberTable.update(empresaId, id, { status: "cancelada" });
    await logAudit({ empresaId, entidade: "ContaReceber", entidadeId: id, acao: "cancelamento", descricao: "Conta a receber cancelada." });
    return c;
  },
  async remove(empresaId: string, id: string) {
    await contaReceberTable.remove(empresaId, id);
    await logAudit({ empresaId, entidade: "ContaReceber", entidadeId: id, acao: "exclusao", descricao: "Conta a receber excluída." });
  },
};
