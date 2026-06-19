// Fase 4 — serviço de Certificados Digitais (cadastro de metadados), assíncrono.
// Não armazena/usa a chave privada (.pfx) — assinatura fiscal exige backend seguro.
import type { Certificado, CertificadoTipo } from "@/types/domain";
import { logAudit } from "./audit";
import { certificadoTable } from "./repos";

export interface CertificadoInput {
  titular: string;
  tipo: CertificadoTipo;
  validade: string;
  observacao: string;
  ativo: boolean;
}

export const certificadoService = {
  list: (empresaId: string): Promise<Certificado[]> =>
    certificadoTable.list(empresaId, { column: "validade", ascending: true }),

  async create(empresaId: string, data: CertificadoInput) {
    const c = await certificadoTable.create(empresaId, data);
    await logAudit({
      empresaId,
      entidade: "Certificado",
      entidadeId: c.id,
      acao: "inclusao",
      descricao: `Certificado de "${c.titular}" cadastrado.`,
    });
    return c;
  },

  async update(empresaId: string, id: string, data: Partial<CertificadoInput>) {
    const c = await certificadoTable.update(empresaId, id, data);
    await logAudit({
      empresaId,
      entidade: "Certificado",
      entidadeId: id,
      acao: "alteracao",
      descricao: `Certificado de "${c.titular}" alterado.`,
    });
    return c;
  },

  async remove(empresaId: string, id: string) {
    await certificadoTable.remove(empresaId, id);
    await logAudit({
      empresaId,
      entidade: "Certificado",
      entidadeId: id,
      acao: "exclusao",
      descricao: "Certificado excluído.",
    });
  },
};

/** Dias até a validade (negativo = vencido). */
export function diasParaVencer(validade: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const v = new Date(validade + "T00:00:00");
  return Math.round((v.getTime() - hoje.getTime()) / 86400000);
}
