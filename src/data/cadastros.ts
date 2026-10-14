// Fase 5 — serviços de cadastros (fornecedores, clientes, vendedores), assíncronos.
import type { Cliente, Fornecedor, Vendedor } from "@/types/domain";
import { logAudit } from "./audit";
import {
  clienteTable,
  contaPagarTable,
  contaReceberTable,
  fornecedorTable,
  oportunidadeTable,
  pedidoCompraTable,
  pedidoVendaTable,
  vendedorTable,
} from "./repos";

/** Liga títulos que ainda só têm o nome e copia o nome novo para contas, pedidos e CRM. */
async function propagarFornecedor(empresaId: string, anterior: Fornecedor, atual: Fornecedor) {
  const contas = await contaPagarTable.list(empresaId);
  for (const conta of contas) {
    const jaLigado = conta.fornecedorId === atual.id;
    const peloNome = !conta.fornecedorId && (conta.fornecedor === anterior.nome || conta.fornecedor === atual.nome);
    if (!jaLigado && !peloNome) continue;
    const patch: { fornecedor?: string; fornecedorId?: string } = {};
    if (conta.fornecedor !== atual.nome) patch.fornecedor = atual.nome;
    if (conta.fornecedorId !== atual.id) patch.fornecedorId = atual.id;
    if (Object.keys(patch).length > 0) await contaPagarTable.update(empresaId, conta.id, patch);
  }
  if (anterior.nome === atual.nome) return;
  const compras = await pedidoCompraTable.list(empresaId);
  for (const pedido of compras) {
    if (pedido.fornecedorId === atual.id && pedido.fornecedorNome !== atual.nome) {
      await pedidoCompraTable.update(empresaId, pedido.id, { fornecedorNome: atual.nome });
    }
  }
}

async function propagarCliente(empresaId: string, anterior: Cliente, atual: Cliente) {
  const contas = await contaReceberTable.list(empresaId);
  for (const conta of contas) {
    const jaLigado = conta.clienteId === atual.id;
    const peloNome = !conta.clienteId && (conta.cliente === anterior.nome || conta.cliente === atual.nome);
    if (!jaLigado && !peloNome) continue;
    const patch: { cliente?: string; clienteId?: string } = {};
    if (conta.cliente !== atual.nome) patch.cliente = atual.nome;
    if (conta.clienteId !== atual.id) patch.clienteId = atual.id;
    if (Object.keys(patch).length > 0) await contaReceberTable.update(empresaId, conta.id, patch);
  }
  if (anterior.nome === atual.nome) return;
  const vendas = await pedidoVendaTable.list(empresaId);
  for (const pedido of vendas) {
    if (pedido.clienteId === atual.id && pedido.clienteNome !== atual.nome) {
      await pedidoVendaTable.update(empresaId, pedido.id, { clienteNome: atual.nome });
    }
  }
  const oportunidades = await oportunidadeTable.list(empresaId);
  for (const item of oportunidades) {
    if (item.clienteId === atual.id && item.clienteNome !== atual.nome) {
      await oportunidadeTable.update(empresaId, item.id, { clienteNome: atual.nome });
    }
  }
}

export const fornecedorService = {
  list: (empresaId: string) => fornecedorTable.list(empresaId, { column: "nome" }),
  listAtivos: async (empresaId: string) =>
    (await fornecedorTable.list(empresaId, { column: "nome" })).filter((f) => f.ativo),
  async create(empresaId: string, data: Omit<Fornecedor, "id" | "createdAt" | "updatedAt" | "empresaId">) {
    const f = await fornecedorTable.create(empresaId, data);
    await logAudit({ empresaId, entidade: "Fornecedor", entidadeId: f.id, acao: "inclusao", descricao: `Fornecedor "${f.nome}" criado.` });
    return f;
  },
  async update(empresaId: string, id: string, data: Partial<Fornecedor>) {
    const anterior = await fornecedorTable.find(empresaId, id);
    const f = await fornecedorTable.update(empresaId, id, data);
    if (anterior) await propagarFornecedor(empresaId, anterior, f);
    await logAudit({ empresaId, entidade: "Fornecedor", entidadeId: id, acao: "alteracao", descricao: `Fornecedor "${f.nome}" alterado.` });
    return f;
  },
  async remove(empresaId: string, id: string) {
    await fornecedorTable.remove(empresaId, id);
    await logAudit({ empresaId, entidade: "Fornecedor", entidadeId: id, acao: "exclusao", descricao: "Fornecedor excluído." });
  },
};

export const clienteService = {
  list: (empresaId: string) => clienteTable.list(empresaId, { column: "nome" }),
  listAtivos: async (empresaId: string) =>
    (await clienteTable.list(empresaId, { column: "nome" })).filter((c) => c.ativo),
  async create(empresaId: string, data: Omit<Cliente, "id" | "createdAt" | "updatedAt" | "empresaId">) {
    const c = await clienteTable.create(empresaId, data);
    await logAudit({ empresaId, entidade: "Cliente", entidadeId: c.id, acao: "inclusao", descricao: `Cliente "${c.nome}" criado.` });
    return c;
  },
  async update(empresaId: string, id: string, data: Partial<Cliente>) {
    const anterior = await clienteTable.find(empresaId, id);
    const c = await clienteTable.update(empresaId, id, data);
    if (anterior) await propagarCliente(empresaId, anterior, c);
    await logAudit({ empresaId, entidade: "Cliente", entidadeId: id, acao: "alteracao", descricao: `Cliente "${c.nome}" alterado.` });
    return c;
  },
  async remove(empresaId: string, id: string) {
    await clienteTable.remove(empresaId, id);
    await logAudit({ empresaId, entidade: "Cliente", entidadeId: id, acao: "exclusao", descricao: "Cliente excluído." });
  },
};

export const vendedorService = {
  list: (empresaId: string) => vendedorTable.list(empresaId, { column: "nome" }),
  listAtivos: async (empresaId: string) =>
    (await vendedorTable.list(empresaId, { column: "nome" })).filter((v) => v.ativo),
  async create(empresaId: string, data: Omit<Vendedor, "id" | "createdAt" | "updatedAt" | "empresaId">) {
    const v = await vendedorTable.create(empresaId, data);
    await logAudit({ empresaId, entidade: "Vendedor", entidadeId: v.id, acao: "inclusao", descricao: `Vendedor "${v.nome}" criado.` });
    return v;
  },
  async update(empresaId: string, id: string, data: Partial<Vendedor>) {
    const v = await vendedorTable.update(empresaId, id, data);
    await logAudit({ empresaId, entidade: "Vendedor", entidadeId: id, acao: "alteracao", descricao: `Vendedor "${v.nome}" alterado.` });
    return v;
  },
  async remove(empresaId: string, id: string) {
    await vendedorTable.remove(empresaId, id);
    await logAudit({ empresaId, entidade: "Vendedor", entidadeId: id, acao: "exclusao", descricao: "Vendedor excluído." });
  },
};
