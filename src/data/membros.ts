// Transversal — membros e convites (multiusuário + RBAC), assíncrono.
import type { Papel } from "@/lib/rbac";
import { db, rowToEntity } from "./db";
import { logAudit } from "./audit";

export interface Membro {
  id: string;
  empresaId: string;
  userId: string;
  email: string;
  papel: Papel;
  createdAt: string;
}

export interface Convite {
  id: string;
  empresaId: string;
  email: string;
  papel: Papel;
  status: string;
  token: string;
  createdAt: string;
}

export interface ConvitePreview {
  id: string;
  empresaId: string;
  email: string;
  papel: Papel;
  status: string;
  empresaNome: string;
}

function throwIf(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export const membroService = {
  async list(empresaId: string): Promise<Membro[]> {
    const { data, error } = await db()
      .from("empresa_membros")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: true });
    throwIf(error);
    return (data ?? []).map((r) => rowToEntity<Membro>(r));
  },

  /** Papéis do usuário atual por empresa (para o contexto). */
  async minhasAssociacoes(userId: string): Promise<{ empresaId: string; papel: Papel }[]> {
    const { data, error } = await db()
      .from("empresa_membros")
      .select("empresa_id,papel")
      .eq("user_id", userId);
    throwIf(error);
    return (data ?? []).map((r) => ({ empresaId: r.empresa_id as string, papel: r.papel as Papel }));
  },

  async updatePapel(empresaId: string, id: string, papel: Papel) {
    const { error } = await db().from("empresa_membros").update({ papel }).eq("id", id).eq("empresa_id", empresaId);
    throwIf(error);
    await logAudit({ empresaId, entidade: "Membro", entidadeId: id, acao: "alteracao", descricao: `Papel alterado para ${papel}.` });
  },

  async remove(empresaId: string, id: string) {
    const { error } = await db().from("empresa_membros").delete().eq("id", id).eq("empresa_id", empresaId);
    throwIf(error);
    await logAudit({ empresaId, entidade: "Membro", entidadeId: id, acao: "exclusao", descricao: "Membro removido." });
  },
};

export const conviteService = {
  async listDaEmpresa(empresaId: string): Promise<Convite[]> {
    const { data, error } = await db()
      .from("convites")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    throwIf(error);
    return (data ?? []).map((r) => rowToEntity<Convite>(r));
  },

  async meusPendentes(email: string): Promise<Convite[]> {
    const { data, error } = await db()
      .from("convites")
      .select("*")
      .eq("status", "pendente")
      .ilike("email", email);
    throwIf(error);
    return (data ?? []).map((r) => rowToEntity<Convite>(r));
  },

  async create(empresaId: string, email: string, papel: Papel): Promise<Convite> {
    const { data, error } = await db()
      .from("convites")
      .insert({ empresa_id: empresaId, email: email.trim(), papel })
      .select("*")
      .single();
    throwIf(error);
    const convite = rowToEntity<Convite>(data);
    await logAudit({
      empresaId,
      entidade: "Convite",
      entidadeId: convite.id,
      acao: "inclusao",
      descricao: `Convite criado para ${email} (${papel}).`,
    });
    return convite;
  },

  async buscarPorToken(token: string): Promise<ConvitePreview | null> {
    const { data, error } = await db().rpc("get_invite_by_token", { p_token: token });
    throwIf(error);
    const row = (data as Record<string, unknown>[] | null)?.[0];
    if (!row) return null;
    return {
      id: row.id as string,
      empresaId: row.empresa_id as string,
      email: row.email as string,
      papel: row.papel as Papel,
      status: row.status as string,
      empresaNome: row.empresa_nome as string,
    };
  },

  async aceitar(conviteId: string) {
    const { error } = await db().rpc("accept_invite", { p_convite_id: conviteId });
    throwIf(error);
  },

  async aceitarPorToken(token: string) {
    const { error } = await db().rpc("accept_invite_by_token", { p_token: token });
    throwIf(error);
  },

  async cancelar(empresaId: string, id: string) {
    const { error } = await db().from("convites").update({ status: "cancelado" }).eq("id", id).eq("empresa_id", empresaId);
    throwIf(error);
  },
};
