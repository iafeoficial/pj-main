import { ArrowDownCircle } from "lucide-react";
import { contaReceberService } from "@/data/services";
import { RequireEmpresa } from "@/components/RequireEmpresa";
import { useEmpresa } from "@/context/EmpresaContext";
import { canWrite } from "@/lib/rbac";
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
  pessoaCadastro: "cliente",
  categoriaTipo: "receita",
  usaContaFinanceira: true,
  baixaLabel: "Registrar recebimento",
  statusBaixado: "recebida",
  list: async (empresaId): Promise<ContaLike[]> =>
    (await contaReceberService.list(empresaId)).map((c) => ({
      id: c.id,
      empresaId: c.empresaId,
      pessoa: c.cliente,
      parceiroId: c.clienteId,
      categoriaId: c.categoriaId,
      centroCustoId: c.centroCustoId,
      contaFinanceiraId: c.contaFinanceiraId,
      valor: c.valor,
      valorBaixado: c.valorRecebido,
      dataCompetencia: c.dataCompetencia,
      dataVencimento: c.dataVencimento,
      dataBaixa: c.dataRecebimento,
      status: c.status,
      observacao: c.observacao,
      transferencia: c.transferencia,
    })),
  create: (empresaId, input) =>
    contaReceberService.create(empresaId, {
      cliente: input.pessoa,
      clienteId: input.parceiroId,
      categoriaId: input.categoriaId,
      centroCustoId: input.centroCustoId,
      contaFinanceiraId: input.contaFinanceiraId ?? null,
      valor: input.valor,
      dataCompetencia: input.dataCompetencia,
      dataVencimento: input.dataVencimento,
      status: input.status,
      observacao: input.observacao,
    }),
  update: (empresaId, id, input) =>
    contaReceberService.update(empresaId, id, {
      cliente: input.pessoa,
      clienteId: input.parceiroId,
      categoriaId: input.categoriaId,
      centroCustoId: input.centroCustoId,
      contaFinanceiraId: input.contaFinanceiraId ?? null,
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
  setTransferencia: (empresaId, id, transferencia) =>
    contaReceberService.update(empresaId, id, { transferencia }),
};

export function ContasReceberPage() {
  return (
    <RequireEmpresa>
      {(id) => <ContasReceberInner empresaId={id} />}
    </RequireEmpresa>
  );
}

function ContasReceberInner({ empresaId }: { empresaId: string }) {
  const { papel } = useEmpresa();
  return <ContasModule empresaId={empresaId} config={config} readOnly={!canWrite(papel)} />;
}
