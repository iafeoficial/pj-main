import { ArrowUpCircle } from "lucide-react";
import { contaPagarService } from "@/data/services";
import { valorDevido } from "@/lib/contaPagarExtras";
import { RequireEmpresa } from "@/components/RequireEmpresa";
import { useEmpresa } from "@/context/EmpresaContext";
import { canWrite } from "@/lib/rbac";
import {
  ContasModule,
  type ContasConfig,
  type ContaLike,
} from "@/features/contas/ContasModule";

const config: ContasConfig = {
  titulo: "Contas a Pagar",
  subtitulo: "Despesas e obrigações da empresa.",
  icon: ArrowUpCircle,
  pessoaLabel: "Beneficiário",
  pessoaCadastro: "fornecedor",
  categoriaTipo: "despesa",
  usaContaFinanceira: true,
  extrasPagar: true,
  baixaLabel: "Registrar pagamento",
  statusBaixado: "paga",
  list: async (empresaId): Promise<ContaLike[]> =>
    (await contaPagarService.list(empresaId)).map((c) => ({
      id: c.id,
      empresaId: c.empresaId,
      pessoa: c.fornecedor,
      parceiroId: c.fornecedorId,
      categoriaId: c.categoriaId,
      centroCustoId: c.centroCustoId,
      contaFinanceiraId: c.contaFinanceiraId,
      valor: c.valor,
      valorBaixado: c.valorPago,
      valorDevido: valorDevido(c),
      desconto: c.desconto,
      juros: c.juros,
      numeroNf: c.numeroNf,
      impostos: c.impostos,
      parcelaNumero: c.parcelaNumero,
      parcelaTotal: c.parcelaTotal,
      recorrencia: c.recorrencia,
      recorrenciaDias: c.recorrenciaDias,
      dataCompetencia: c.dataCompetencia,
      dataVencimento: c.dataVencimento,
      dataBaixa: c.dataPagamento,
      status: c.status,
      observacao: c.observacao,
      transferencia: c.transferencia,
    })),
  create: (empresaId, input) =>
    contaPagarService.create(empresaId, {
      fornecedor: input.pessoa,
      fornecedorId: input.parceiroId,
      categoriaId: input.categoriaId,
      centroCustoId: input.centroCustoId,
      contaFinanceiraId: input.contaFinanceiraId,
      valor: input.valor,
      desconto: input.desconto ?? 0,
      juros: input.juros ?? 0,
      numeroNf: input.numeroNf ?? "",
      impostos: input.impostos ?? null,
      dataCompetencia: input.dataCompetencia,
      dataVencimento: input.dataVencimento,
      status: input.status,
      observacao: input.observacao,
      parcelas: input.parcelas,
      recorrencia: input.recorrencia ?? null,
      recorrenciaDias:
        input.recorrencia === "personalizada"
          ? Math.max(1, Math.min(365, Math.floor(input.recorrenciaDias || 30)))
          : null,
      recorrenciaOcorrencias: input.recorrenciaOcorrencias,
    }),
  update: (empresaId, id, input) =>
    contaPagarService.update(empresaId, id, {
      fornecedor: input.pessoa,
      fornecedorId: input.parceiroId,
      categoriaId: input.categoriaId,
      centroCustoId: input.centroCustoId,
      contaFinanceiraId: input.contaFinanceiraId,
      valor: input.valor,
      desconto: input.desconto ?? 0,
      juros: input.juros ?? 0,
      numeroNf: input.numeroNf ?? "",
      impostos: input.impostos ?? null,
      dataCompetencia: input.dataCompetencia,
      dataVencimento: input.dataVencimento,
      status: input.status,
      observacao: input.observacao,
    }),
  baixar: (empresaId, id, valor, data) =>
    contaPagarService.registrarPagamento(empresaId, id, valor, data),
  listPagamentos: (empresaId, id) => contaPagarService.listPagamentos(empresaId, id),
  cancelar: (empresaId, id) => contaPagarService.cancelar(empresaId, id),
  remove: (empresaId, id) => contaPagarService.remove(empresaId, id),
  setTransferencia: (empresaId, id, transferencia) =>
    contaPagarService.update(empresaId, id, { transferencia }),
};

export function ContasPagarPainel({ empresaId }: { empresaId: string }) {
  const { papel } = useEmpresa();
  return <ContasModule empresaId={empresaId} config={config} readOnly={!canWrite(papel)} />;
}

export function ContasPagarPage() {
  return (
    <RequireEmpresa>
      {(id) => <ContasPagarPainel empresaId={id} />}
    </RequireEmpresa>
  );
}
