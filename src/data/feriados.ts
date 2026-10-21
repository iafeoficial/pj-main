import type { Feriado } from "@/types/domain";
import type { ExtraFeriado } from "@/lib/diaUtil";
import { logAudit } from "./audit";
import { feriadoTable } from "./repos";

export const feriadoService = {
  async list(empresaId: string): Promise<Feriado[]> {
    return (await feriadoTable.list(empresaId, { column: "data" })).sort((a, b) =>
      a.data.localeCompare(b.data)
    );
  },
  async extras(empresaId: string): Promise<ExtraFeriado[]> {
    return (await this.list(empresaId)).map((f) => ({
      data: f.data,
      nome: f.nome,
      repeteAnual: f.repeteAnual,
    }));
  },
  async create(empresaId: string, data: { data: string; nome: string; repeteAnual: boolean }) {
    const nome = data.nome.trim();
    if (!data.data) throw new Error("Informe a data do feriado.");
    if (!nome) throw new Error("Informe o nome do feriado.");
    const f = await feriadoTable.create(empresaId, {
      data: data.data,
      nome,
      repeteAnual: data.repeteAnual,
    });
    await logAudit({
      empresaId,
      entidade: "Feriado",
      entidadeId: f.id,
      acao: "inclusao",
      descricao: `Feriado "${f.nome}" em ${f.data} cadastrado.`,
    });
    return f;
  },
  async remove(empresaId: string, id: string) {
    const f = await feriadoTable.find(empresaId, id);
    await feriadoTable.remove(empresaId, id);
    if (f) {
      await logAudit({
        empresaId,
        entidade: "Feriado",
        entidadeId: id,
        acao: "exclusao",
        descricao: `Feriado "${f.nome}" excluído.`,
      });
    }
  },
};
