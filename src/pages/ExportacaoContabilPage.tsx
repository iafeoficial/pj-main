import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { getLancamentosContabeis, type LancamentoContabil } from "@/data/contabil";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatBRL, formatDate, monthRange } from "@/lib/utils";
import { exportCSV } from "@/lib/csv";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { RequireEmpresa } from "@/components/RequireEmpresa";

function Inner({ empresaId }: { empresaId: string }) {
  const { version, empresaAtiva } = useEmpresa();
  const initial = monthRange();
  const [inicio, setInicio] = useState(initial.start);
  const [fim, setFim] = useState(initial.end);

  const { data: lancamentos } = useAsyncData(
    () => getLancamentosContabeis(empresaId, inicio, fim),
    [empresaId, inicio, fim, version],
    [] as LancamentoContabil[]
  );

  const total = lancamentos.reduce((s, l) => s + l.valor, 0);

  function exportar() {
    exportCSV(
      `lancamentos_contabeis_${empresaAtiva?.nomeFantasia ?? "empresa"}`,
      ["Data", "Débito", "Crédito", "Valor", "Histórico"],
      lancamentos.map((l) => [l.data, l.contaDebito, l.contaCredito, l.valor.toFixed(2), l.historico])
    );
  }

  return (
    <>
      <PageHeader
        title="Exportação Contábil"
        subtitle="Lançamentos a débito/crédito gerados a partir das baixas, para envio ao contador."
        actions={
          <button className="btn-primary" onClick={exportar} disabled={lancamentos.length === 0}>
            <Download className="h-4 w-4" /> Exportar CSV
          </button>
        }
      />

      <div className="card mb-6 flex flex-wrap items-end gap-4 p-4">
        <Field label="Início">
          <input className="input" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </Field>
        <Field label="Fim">
          <input className="input" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
        </Field>
        <div className="ml-auto text-sm">
          <p className="text-xs text-muted-foreground">Total no período</p>
          <p className="font-semibold">{formatBRL(total)}</p>
        </div>
      </div>

      {lancamentos.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          title="Sem lançamentos no período"
          description="Os lançamentos contábeis vêm das baixas (pagamentos/recebimentos) registradas."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Data</th>
                <th className="px-4 py-2.5 font-medium">Débito</th>
                <th className="px-4 py-2.5 font-medium">Crédito</th>
                <th className="px-4 py-2.5 text-right font-medium">Valor</th>
                <th className="px-4 py-2.5 font-medium">Histórico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lancamentos.map((l, i) => (
                <tr key={i} className="hover:bg-muted/30">
                  <td className="whitespace-nowrap px-4 py-2.5">{formatDate(l.data)}</td>
                  <td className="px-4 py-2.5">{l.contaDebito}</td>
                  <td className="px-4 py-2.5">{l.contaCredito}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatBRL(l.valor)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{l.historico}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Modelo simplificado de partidas dobradas (contrapartida em "{`Caixa/Bancos`}"). O plano de
        contas definitivo deve ser ajustado com seu contador.
      </p>
    </>
  );
}

export function ExportacaoContabilPage() {
  return <RequireEmpresa>{(id) => <Inner empresaId={id} />}</RequireEmpresa>;
}
