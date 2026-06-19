// Fase 5 — serviços de cadastros (fornecedores, clientes, vendedores), assíncronos.
import type { Cliente, Fornecedor, Vendedor } from "@/types/domain";
import { logAudit } from "./audit";
import { clienteTable, fornecedorTable, vendedorTable } from "./repos";

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
    const f = await fornecedorTable.update(empresaId, id, data);
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
    const c = await clienteTable.update(empresaId, id, data);
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
