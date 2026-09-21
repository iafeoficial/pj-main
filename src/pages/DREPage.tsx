import { useState } from "react";
import { Download } from "lucide-react";
import { getDRE, type DREData, type DREGrupoLinha } from "@/data/analytics";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatBRL, monthRange } from "@/lib/utils";
import { exportCSV } from "@/lib/csv";
import { PageHeader } from "@/components/ui/PageHeader";
import { Field } from "@/components/ui/Field";
import { DatePicker } from "@/components/ui/DatePicker";
import { RequireEmpresa } from "@/components/RequireEmpresa";

const EMPTY: DREData = {
  inicio: "",
  fim: "",
  receitas: [],
  despesas: [],
  totalReceitas: 0,
  totalDespesas: 0,
  resultado: 0,
  margem: 0,
};

function flattenExport(grupos: DREGrupoLinha[], sign: 1 | -1): (string | number)[][] {
  const rows: (string | number)[][] = [];
  for (const g of grupos) {
    rows.push([g.rotulo, "", (sign * g.total).toFixed(2)]);
    for (const c of g.categorias) {
      rows.push([`  ${c.rotulo}`, c.qtd, (sign * c.total).toFixed(2)]);
    }
  }
  return rows;
}

function Inner({ empresaId }: { empresaId: string }) {
  const { version, empresaAtiva } = useEmpresa();
  const initial = monthRange();
  const [inicio, setInicio] = useState(initial.start);
  const [fim, setFim] = useState(initial.end);

  const { data: dre } = useAsyncData(
    () => getDRE(empresaId, inicio, fim),
    [empresaId, inicio, fim, version],
    EMPTY
  );

  function exportar() {
    const rows: (string | number)[][] = [
      ["RECEITAS", "", ""],
      ...flattenExport(dre.receitas, 1),
      ["Total de Receitas", "", dre.totalReceitas.toFixed(2)],
      ["", "", ""],
      ["DESPESAS", "", ""],
      ...flattenExport(dre.despesas, -1),
      ["Total de Despesas", "", (-dre.totalDespesas).toFixed(2)],
      ["", "", ""],
      ["RESULTADO DO PERÍODO", "", dre.resultado.toFixed(2)],
    ];
    exportCSV(`dre_${empresaAtiva?.nomeFantasia ?? "empresa"}`, ["Descrição", "Qtde", "Valor"], rows);
  }

  return (
    <>
      <PageHeader
        title="DRE"
        subtitle="Demonstração do Resultado do Exercício — regime de competência."
        actions={
          <button className="btn-outline" onClick={exportar}>
            <Download className="h-4 w-4" /> Exportar CSV
          </button>
        }
      />

      <div className="card mb-6 flex flex-wrap items-end gap-4 p-4">
        <Field label="Início">
          <DatePicker value={inicio} onChange={setInicio} />
        </Field>
        <Field label="Fim">
          <DatePicker value={fim} onChange={setFim} />
        </Field>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            <SectionRow titulo="Receitas Operacionais" />
            {dre.receitas.length === 0 ? (
              <EmptyRow />
            ) : (
              dre.receitas.map((g) => <GrupoBlock key={g.chave} grupo={g} sign={1} />)
            )}
            <TotalRow label="(=) Total de Receitas" valor={dre.totalReceitas} tone="receita" />

            <SectionRow titulo="(−) Despesas" />
            {dre.despesas.length === 0 ? (
              <EmptyRow />
            ) : (
              dre.despesas.map((g) => <GrupoBlock key={g.chave} grupo={g} sign={-1} />)
            )}
            <TotalRow label="(=) Total de Despesas" valor={-dre.totalDespesas} tone="despesa" />

            <tr className="border-t-2 border-border bg-muted/50">
              <td className="px-4 py-3 font-semibold">(=) Resultado do Período</td>
              <td
                className={`px-4 py-3 text-right text-base font-bold tabular-nums ${
                  dre.resultado >= 0 ? "text-emerald-700" : "text-red-600"
                }`}
              >
                {formatBRL(dre.resultado)}
              </td>
            </tr>
            <tr className="bg-muted/30">
              <td className="px-4 py-2 text-xs text-muted-foreground">Margem sobre receitas</td>
              <td className="px-4 py-2 text-right text-xs text-muted-foreground tabular-nums">
                {dre.margem.toFixed(1)}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

function GrupoBlock({ grupo, sign }: { grupo: DREGrupoLinha; sign: 1 | -1 }) {
  return (
    <>
      <tr className="border-b border-border/80 bg-muted/15">
        <td className="px-4 py-2 pl-6 font-medium">{grupo.rotulo}</td>
        <td
          className={`px-4 py-2 text-right font-medium tabular-nums ${
            sign < 0 ? "text-red-600" : ""
          }`}
        >
          {formatBRL(sign * grupo.total)}
        </td>
      </tr>
      {grupo.categorias.map((c) => (
        <tr key={c.chave} className="border-b border-border/40 hover:bg-muted/20">
          <td className="px-4 py-1.5 pl-12 text-muted-foreground">{c.rotulo}</td>
          <td
            className={`px-4 py-1.5 text-right tabular-nums text-muted-foreground ${
              sign < 0 ? "text-red-600/80" : ""
            }`}
          >
            {formatBRL(sign * c.total)}
          </td>
        </tr>
      ))}
    </>
  );
}

function SectionRow({ titulo }: { titulo: string }) {
  return (
    <tr className="border-b border-border bg-muted/40">
      <td colSpan={2} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </td>
    </tr>
  );
}

function TotalRow({ label, valor, tone }: { label: string; valor: number; tone: "receita" | "despesa" }) {
  return (
    <tr className="border-b border-border bg-muted/20 font-medium">
      <td className="px-4 py-2">{label}</td>
      <td className={`px-4 py-2 text-right tabular-nums ${tone === "receita" ? "text-emerald-700" : "text-red-600"}`}>
        {formatBRL(valor)}
      </td>
    </tr>
  );
}

function EmptyRow() {
  return (
    <tr>
      <td colSpan={2} className="px-4 py-2 pl-8 text-sm text-muted-foreground">
        Sem lançamentos no período.
      </td>
    </tr>
  );
}

export function DREPage() {
  return <RequireEmpresa>{(id) => <Inner empresaId={id} />}</RequireEmpresa>;
}
