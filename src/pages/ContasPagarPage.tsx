import { ArrowUpCircle } from "lucide-react";
import { contaPagarService } from "@/data/services";
import { RequireEmpresa } from "@/components/RequireEmpresa";
import {
  ContasModule,
  type ContasConfig,
  type ContaLike,
} from "@/features/contas/ContasModule";

const config: ContasConfig = {
  titulo: "Contas a Pagar",
  subtitulo: "Despesas e obrigações da empresa.",
  icon: ArrowUpCircle,
  pessoaLabel: "Fornecedor",
  categoriaTipo: "despesa",
  baixaLabel: "Registrar pagamento",
  statusBaixado: "paga",
  list: async (empresaId): Promise<ContaLike[]> =>
    (await contaPagarService.list(empresaId)).map((c) => ({
      id: c.id,
      empresaId: c.empresaId,
      pessoa: c.fornecedor,
      categoriaId: c.categoriaId,
      centroCustoId: c.centroCustoId,
      valor: c.valor,
      valorBaixado: c.valorPago,
      dataCompetencia: c.dataCompetencia,
      dataVencimento: c.dataVencimento,
      dataBaixa: c.dataPagamento,
      status: c.status,
      observacao: c.observacao,
    })),
  create: (empresaId, input) =>
    contaPagarService.create(empresaId, {
      fornecedor: input.pessoa,
      categoriaId: input.categoriaId,
      centroCustoId: input.centroCustoId,
      valor: input.valor,
      dataCompetencia: input.dataCompetencia,
      dataVencimento: input.dataVencimento,
      status: input.status,
      observacao: input.observacao,
    }),
  update: (empresaId, id, input) =>
    contaPagarService.update(empresaId, id, {
      fornecedor: input.pessoa,
      categoriaId: input.categoriaId,
      centroCustoId: input.centroCustoId,
      valor: input.valor,
      dataCompetencia: input.dataCompetencia,
      dataVencimento: input.dataVencimento,
      status: input.status,
      observacao: input.observacao,
    }),
  baixar: (empresaId, id, valor, data) =>
    contaPagarService.registrarPagamento(empresaId, id, valor, data),
  cancelar: (empresaId, id) => contaPagarService.cancelar(empresaId, id),
  remove: (empresaId, id) => contaPagarService.remove(empresaId, id),
};

export function ContasPagarPage() {
  return (
    <RequireEmpresa>
      {(id) => <ContasModule empresaId={id} config={config} />}
    </RequireEmpresa>
  );
}
