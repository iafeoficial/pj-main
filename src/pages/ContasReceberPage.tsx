import { ArrowDownCircle } from "lucide-react";
import { contaReceberService } from "@/data/services";
import { RequireEmpresa } from "@/components/RequireEmpresa";
import {
  ContasModule,
  type ContasConfig,
  type ContaLike,
} from "@/features/contas/ContasModule";

const config: ContasConfig = {
  titulo: "Contas a Receber",
  subtitulo: "Receitas e valores a receber de clientes.",
  icon: ArrowDownCircle,
  pessoaLabel: "Cliente",
  categoriaTipo: "receita",
  baixaLabel: "Registrar recebimento",
  statusBaixado: "recebida",
  list: async (empresaId): Promise<ContaLike[]> =>
    (await contaReceberService.list(empresaId)).map((c) => ({
      id: c.id,
      empresaId: c.empresaId,
      pessoa: c.cliente,
      categoriaId: c.categoriaId,
      centroCustoId: c.centroCustoId,
      valor: c.valor,
      valorBaixado: c.valorRecebido,
      dataCompetencia: c.dataCompetencia,
      dataVencimento: c.dataVencimento,
      dataBaixa: c.dataRecebimento,
      status: c.status,
      observacao: c.observacao,
    })),
  create: (empresaId, input) =>
    contaReceberService.create(empresaId, {
      cliente: input.pessoa,
      categoriaId: input.categoriaId,
      centroCustoId: input.centroCustoId,
      valor: input.valor,
      dataCompetencia: input.dataCompetencia,
      dataVencimento: input.dataVencimento,
      status: input.status,
      observacao: input.observacao,
    }),
  update: (empresaId, id, input) =>
    contaReceberService.update(empresaId, id, {
      cliente: input.pessoa,
      categoriaId: input.categoriaId,
      centroCustoId: input.centroCustoId,
      valor: input.valor,
      dataCompetencia: input.dataCompetencia,
      dataVencimento: input.dataVencimento,
      status: input.status,
      observacao: input.observacao,
    }),
  baixar: (empresaId, id, valor, data) =>
    contaReceberService.registrarRecebimento(empresaId, id, valor, data),
  cancelar: (empresaId, id) => contaReceberService.cancelar(empresaId, id),
  remove: (empresaId, id) => contaReceberService.remove(empresaId, id),
};

export function ContasReceberPage() {
  return (
    <RequireEmpresa>
      {(id) => <ContasModule empresaId={id} config={config} />}
    </RequireEmpresa>
  );
}
