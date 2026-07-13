import { useState } from "react";
import { Download, Percent } from "lucide-react";
import { getComissoes, type ComissaoRow } from "@/data/operacao";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatBRL, monthRange } from "@/lib/utils";
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

  const { data: rows } = useAsyncData(
    () => getComissoes(empresaId, inicio, fim),
    [empresaId, inicio, fim, version],
    [] as ComissaoRow[]
  );

  const totalComissao = rows.reduce((s, r) => s + r.comissao, 0);

  function exportar() {
    exportCSV(
      `comissoes_${empresaAtiva?.nomeFantasia ?? "empresa"}`,
      ["Vendedor", "Qtd vendas", "Total vendido", "Comissão"],
      rows.map((r) => [r.vendedor, r.qtdVendas, r.totalVendido.toFixed(2), r.comissao.toFixed(2)])
    );
  }

  return (
    <>
      <PageHeader
        title="Comissões"
        subtitle="Comissões por vendedor sobre as vendas faturadas no período."
        actions={
          <button className="btn-outline" onClick={exportar} disabled={rows.length === 0}>
            <Download className="h-4 w-4" /> CSV
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
          <p className="text-xs text-muted-foreground">Total de comissões</p>
          <p className="font-semibold">{formatBRL(totalComissao)}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Percent}
          title="Sem comissões no período"
          description="Comissões aparecem quando há vendas faturadas com vendedor associado."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Vendedor</th>
                <th className="px-4 py-2.5 text-right font-medium">Vendas</th>
                <th className="px-4 py-2.5 text-right font-medium">Total vendido</th>
                <th className="px-4 py-2.5 text-right font-medium">Comissão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.vendedorId} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{r.vendedor}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.qtdVendas}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatBRL(r.totalVendido)}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-emerald-700">{formatBRL(r.comissao)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function ComissoesPage() {
  return <RequireEmpresa>{(id) => <Inner empresaId={id} />}</RequireEmpresa>;
}
