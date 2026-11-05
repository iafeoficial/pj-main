import type { Empresa, UserProfile } from "@/types/domain";
import { db, rowToEntity } from "./db";

type Row = Record<string, unknown>;

/** Serviços exclusivos do admin de plataforma (@iafeoficial.com). */
export const plataformaService = {
  async listEmpresas(): Promise<Empresa[]> {
    const { data, error } = await db().rpc("admin_list_empresas");
    if (error) throw new Error(error.message);
    return ((data ?? []) as Row[]).map((r) => rowToEntity<Empresa>(r));
  },

  async updateEmpresaAcesso(
    id: string,
    input: {
      acessoInicio: string | null;
      acessoFim: string | null;
      acessoBloqueado: boolean;
      acessoMotivo: string | null;
    }
  ): Promise<Empresa> {
    const { data, error } = await db().rpc("admin_update_empresa_acesso", {
      p_id: id,
      p_acesso_inicio: input.acessoInicio,
      p_acesso_fim: input.acessoFim,
      p_acesso_bloqueado: input.acessoBloqueado,
      p_acesso_motivo: input.acessoMotivo,
    });
    if (error) throw new Error(error.message);
    return rowToEntity<Empresa>(data as Row);
  },

  async listProfiles(): Promise<UserProfile[]> {
    const { data, error } = await db().rpc("admin_list_profiles");
    if (error) throw new Error(error.message);
    return ((data ?? []) as Row[]).map((r) => rowToEntity<UserProfile>(r));
  },

  async setProfileBloqueado(
    userId: string,
    bloqueado: boolean,
    motivo: string | null
  ): Promise<UserProfile> {
    const { data, error } = await db().rpc("admin_set_profile_bloqueado", {
      p_user_id: userId,
      p_bloqueado: bloqueado,
      p_motivo: motivo,
    });
    if (error) throw new Error(error.message);
    return rowToEntity<UserProfile>(data as Row);
  },

  async getMeuProfile(): Promise<UserProfile | null> {
    const { data: sessionData } = await db().auth.getUser();
    const uid = sessionData.user?.id;
    if (!uid) return null;
    const { data, error } = await db().from("profiles").select("*").eq("user_id", uid).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return rowToEntity<UserProfile>(data as Row);
  },
};
