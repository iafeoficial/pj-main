import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import type { GroupRow, RelatoriosData } from "@/data/analytics";
import { getPeriodoPadrao, getRelatorios } from "@/data/analytics";
import { clienteService, fornecedorService } from "@/data/cadastros";
import { combinaBusca, partesValor } from "@/lib/busca";
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
import { BuscaCampo } from "@/components/ui/BuscaCampo";
import { Field } from "@/components/ui/Field";
import { DatePicker } from "@/components/ui/DatePicker";
import { RequireEmpresa } from "@/components/RequireEmpresa";

function Inner({ empresaId }: { empresaId: string }) {
  const { version, empresaAtiva } = useEmpresa();
  const fallback = monthRange();
  const { data: periodo } = useAsyncData(
    () => getPeriodoPadrao(empresaId, "competencia"),
    [empresaId, version],
    null as { inicio: string; fim: string } | null
  );
  const [inicio, setInicio] = useState(fallback.start);
  const [fim, setFim] = useState(fallback.end);
  const [manual, setManual] = useState(false);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    setManual(false);
  }, [empresaId]);

  useEffect(() => {
    if (periodo && !manual) {
      setInicio(periodo.inicio);
      setFim(periodo.fim);
    }
  }, [periodo, manual]);

  const { data: rel } = useAsyncData(
    () => getRelatorios(empresaId, inicio, fim),
    [empresaId, inicio, fim, version],
    EMPTY_REL
  );

  const { data: clientes } = useAsyncData(() => clienteService.list(empresaId), [empresaId, version], []);
  const { data: fornecedores } = useAsyncData(
    () => fornecedorService.list(empresaId),
    [empresaId, version],
    []
  );
  const docPorNome = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of [...clientes, ...fornecedores]) {
      if (p.cnpjCpf && !map.has(p.nome)) map.set(p.nome, p.cnpjCpf);
    }
    return map;
  }, [clientes, fornecedores]);

  function filtrar(rows: GroupRow[], comDocumento: boolean) {
    const q = busca.trim();
    if (!q) return rows;
    return rows.filter((r) =>
      combinaBusca(q, [r.rotulo, comDocumento ? docPorNome.get(r.rotulo) : "", ...partesValor(r.total), r.qtd])
    );
  }

  const receitas = filtrar(rel.porCategoria.receitas, false);
  const despesas = filtrar(rel.porCategoria.despesas, false);
  const centros = filtrar(rel.porCentroCusto, false);
  const porCliente = filtrar(rel.porCliente, true);
  const porFornecedor = filtrar(rel.porFornecedor, true);

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
          <DatePicker
            value={inicio}
            onChange={(v) => {
              setManual(true);
              setInicio(v);
            }}
          />
        </Field>
        <Field label="Fim">
          <DatePicker
            value={fim}
            onChange={(v) => {
              setManual(true);
              setFim(v);
            }}
          />
        </Field>
        <div className="min-w-[16rem] flex-1">
          <BuscaCampo value={busca} onChange={setBusca} />
        </div>
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
          rows={receitas}
          buscaAtiva={busca.trim().length > 0}
          onExport={() => exportar("receitas_por_categoria", receitas)}
        />
        <ReportTable
          title="Despesas por categoria"
          rows={despesas}
          buscaAtiva={busca.trim().length > 0}
          onExport={() => exportar("despesas_por_categoria", despesas)}
        />
        <ReportTable
          title="Por centro de custo"
          rows={centros}
          buscaAtiva={busca.trim().length > 0}
          onExport={() => exportar("por_centro_custo", centros)}
        />
        <ReportTable
          title="Recebimentos por cliente"
          rows={porCliente}
          buscaAtiva={busca.trim().length > 0}
          onExport={() => exportar("por_cliente", porCliente)}
        />
        <ReportTable
          title="Pagamentos por fornecedor"
          rows={porFornecedor}
          buscaAtiva={busca.trim().length > 0}
          onExport={() => exportar("por_fornecedor", porFornecedor)}
        />
      </div>
    </>
  );
}

function ReportTable({
  title,
  rows,
  onExport,
  buscaAtiva = false,
}: {
  title: string;
  rows: GroupRow[];
  onExport: () => void;
  buscaAtiva?: boolean;
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
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          {buscaAtiva ? "Nenhum resultado para esta busca." : "Sem dados no período."}
        </p>
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
