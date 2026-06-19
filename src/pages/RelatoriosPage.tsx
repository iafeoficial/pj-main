import { useState } from "react";
import { Download } from "lucide-react";
import type { GroupRow, RelatoriosData } from "@/data/analytics";
import { getRelatorios } from "@/data/analytics";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatBRL, monthRange } from "@/lib/utils";

const EMPTY_REL: RelatoriosData = {
  porCategoria: { receitas: [], despesas: [] },
  porCentroCusto: [],
  porCliente: [],
  porFornecedor: [],
};
import { exportCSV } from "@/lib/csv";
import { PageHeader } from "@/components/ui/PageHeader";
import { Field } from "@/components/ui/Field";
import { RequireEmpresa } from "@/components/RequireEmpresa";

function Inner({ empresaId }: { empresaId: string }) {
  const { version, empresaAtiva } = useEmpresa();
  const initial = monthRange();
  const [inicio, setInicio] = useState(initial.start);
  const [fim, setFim] = useState(initial.end);

  const { data: rel } = useAsyncData(
    () => getRelatorios(empresaId, inicio, fim),
    [empresaId, inicio, fim, version],
    EMPTY_REL
  );

  const totalReceitas = rel.porCategoria.receitas.reduce((s, r) => s + r.total, 0);
  const totalDespesas = rel.porCategoria.despesas.reduce((s, r) => s + r.total, 0);

  function exportar(nome: string, rows: GroupRow[]) {
    exportCSV(
      `${nome}_${empresaAtiva?.nomeFantasia ?? "empresa"}`,
      ["Descrição", "Qtde", "Total"],
      rows.map((r) => [r.rotulo, r.qtd, r.total.toFixed(2)])
    );
  }

  return (
    <>
      <PageHeader
        title="Relatórios"
        subtitle="Análises gerenciais por período (data de competência)."
      />

      <div className="card mb-6 flex flex-wrap items-end gap-4 p-4">
        <Field label="Início">
          <input className="input" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </Field>
        <Field label="Fim">
          <input className="input" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
        </Field>
        <div className="ml-auto flex gap-6 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Receitas</p>
            <p className="font-semibold text-emerald-600">{formatBRL(totalReceitas)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Despesas</p>
            <p className="font-semibold text-red-600">{formatBRL(totalDespesas)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Resultado</p>
            <p className={`font-semibold ${totalReceitas - totalDespesas >= 0 ? "text-emerald-700" : "text-red-600"}`}>
              {formatBRL(totalReceitas - totalDespesas)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ReportTable
          title="Receitas por categoria"
          rows={rel.porCategoria.receitas}
          onExport={() => exportar("receitas_por_categoria", rel.porCategoria.receitas)}
        />
        <ReportTable
          title="Despesas por categoria"
          rows={rel.porCategoria.despesas}
          onExport={() => exportar("despesas_por_categoria", rel.porCategoria.despesas)}
        />
        <ReportTable
          title="Por centro de custo"
          rows={rel.porCentroCusto}
          onExport={() => exportar("por_centro_custo", rel.porCentroCusto)}
        />
        <ReportTable
          title="Recebimentos por cliente"
          rows={rel.porCliente}
          onExport={() => exportar("por_cliente", rel.porCliente)}
        />
        <ReportTable
          title="Pagamentos por fornecedor"
          rows={rel.porFornecedor}
          onExport={() => exportar("por_fornecedor", rel.porFornecedor)}
        />
      </div>
    </>
  );
}

function ReportTable({
  title,
  rows,
  onExport,
}: {
  title: string;
  rows: GroupRow[];
  onExport: () => void;
}) {
  const total = rows.reduce((s, r) => s + r.total, 0);
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        <button className="btn-ghost btn-sm" onClick={onExport} disabled={rows.length === 0}>
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">Sem dados no período.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.chave} className="hover:bg-muted/30">
                <td className="px-4 py-2.5">{r.rotulo}</td>
                <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{r.qtd}x</td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">{formatBRL(r.total)}</td>
              </tr>
            ))}
            <tr className="bg-muted/40 font-semibold">
              <td className="px-4 py-2.5">Total</td>
              <td />
              <td className="px-4 py-2.5 text-right tabular-nums">{formatBRL(total)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

export function RelatoriosPage() {
  return <RequireEmpresa>{(id) => <Inner empresaId={id} />}</RequireEmpresa>;
}
