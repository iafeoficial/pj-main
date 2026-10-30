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
  createdAt: string;
  /** Razão social — só preenchida em `meusPendentes`. */
  empresaNome?: string;
}

function redirectConvite(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/empresas`;
}

async function enviarEmailConvite(empresaId: string, email: string) {
  const { error, data } = await db().functions.invoke("enviar-convite", {
    body: { empresaId, email, redirectTo: redirectConvite() },
  });
  if (error) {
    const ctx = error as { context?: Response; message?: string };
    let detalhe = ctx.message || "Falha ao enviar o e-mail do convite.";
    try {
      const body = ctx.context ? await ctx.context.json() : null;
      if (body?.error) detalhe = String(body.error);
    } catch {
      /* mantém detalhe */
    }
    throw new Error(detalhe);
  }
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String(data.error));
  }
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

  /**
   * Se o e-mail logado for @iafeoficial.com, garante membership de administrador
   * na IAFE TECNOLOGIA. Não faz nada para outros domínios.
   */
  async vincularEmailIafe(): Promise<void> {
    const { error } = await db().rpc("vincular_email_iafe_atual");
    if (error && !/vincular_email_iafe_atual|schema cache/i.test(error.message)) {
      throw new Error(error.message);
    }
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

  async meusPendentes(_email?: string): Promise<Convite[]> {
    const { data, error } = await db().rpc("meus_convites_pendentes");
    throwIf(error);
    return ((data ?? []) as Record<string, unknown>[]).map((row) => {
      const c = rowToEntity<Convite>(row);
      c.empresaNome = String(row.empresa_nome ?? row.empresaNome ?? "");
      return c;
    });
  },

  async create(empresaId: string, email: string, papel: Papel) {
    const destino = email.trim().toLowerCase();
    const { error } = await db()
      .from("convites")
      .insert({ empresa_id: empresaId, email: destino, papel });
    if (error) {
      if (/uq_convites_pendente_email|duplicate key/i.test(error.message)) {
        throw new Error("Já existe um convite pendente para este e-mail.");
      }
      throw new Error(error.message);
    }
    await logAudit({
      empresaId,
      entidade: "Convite",
      entidadeId: null,
      acao: "inclusao",
      descricao: `Convite enviado para ${destino} (${papel}).`,
    });
    try {
      await enviarEmailConvite(empresaId, destino);
    } catch (e) {
      throw new Error(
        `Convite salvo, mas o e-mail não saiu: ${(e as Error).message} Use Reenviar ou peça para a pessoa abrir Empresas depois do login.`
      );
    }
  },

  async reenviar(empresaId: string, email: string) {
    await enviarEmailConvite(empresaId, email.trim().toLowerCase());
  },

  async aceitar(conviteId: string) {
    const { error } = await db().rpc("accept_invite", { p_convite_id: conviteId });
    throwIf(error);
  },

  /** Aceita todos os convites pendentes do e-mail logado. Retorna quantos entrou. */
  async aceitarPendentes(): Promise<number> {
    const { data, error } = await db().rpc("aceitar_meus_convites_pendentes");
    if (error && /aceitar_meus_convites_pendentes|schema cache/i.test(error.message)) {
      return 0;
    }
    throwIf(error);
    const n = Number(data ?? 0);
    return Number.isFinite(n) ? n : 0;
  },

  async cancelar(empresaId: string, id: string) {
    const { error } = await db().from("convites").update({ status: "cancelado" }).eq("id", id).eq("empresa_id", empresaId);
    throwIf(error);
  },
};
