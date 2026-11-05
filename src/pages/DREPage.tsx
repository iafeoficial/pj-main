import { useState } from "react";
import { Download } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getDRE, type DREData, type DREDetalheLinha, type DREGrupoLinha, type DREWaterfallStep } from "@/data/analytics";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { cn, formatBRL, monthRange, roundBRL } from "@/lib/utils";
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
  anoLabel: "",
  anoAnteriorLabel: "",
  waterfall: [],
  detalhe: [],
};

const COR = {
  total: "#8CCBA5",
  subtotal: "#143D2B",
  deducao: "#C9A59A",
  barraPct: "#8CCBA5",
  sparkUp: "#5E9C78",
  sparkDown: "#C9A59A",
} as const;

/** Compacta valores grandes no waterfall (ex.: R$ 48,2 mi). */
function formatCompactBRL(value: number): string {
  const n = roundBRL(value);
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1_000_000) {
    return `${sign}R$ ${(abs / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  }
  if (abs >= 10_000) {
    return `${sign}R$ ${(abs / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  }
  return formatBRL(n);
}

function formatVar(value: number): string {
  const prefix = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${prefix}${formatBRL(Math.abs(value))}`;
}

function formatVarPct(value: number | null): string {
  if (value == null) return "—";
  const prefix = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${prefix}${Math.abs(value).toFixed(1).replace(".", ",")}%`;
}

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

function corBarra(kind: DREWaterfallStep["kind"]): string {
  if (kind === "deducao") return COR.deducao;
  if (kind === "subtotal") return COR.subtotal;
  return COR.total;
}

function Sparkline({ values, tone }: { values: number[]; tone: "up" | "down" }) {
  const series = values.length >= 2 ? values : values.length === 1 ? [values[0], values[0]] : [];
  if (series.length < 2) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const w = 72;
  const h = 22;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const pts = series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 2) - 1;
      return `${x},${y}`;
    })
    .join(" ");
  const stroke = tone === "up" ? COR.sparkUp : COR.sparkDown;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="inline-block">
      <polyline fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

function PctBar({ pct }: { pct: number }) {
  const width = Math.min(100, Math.max(0, Math.abs(pct)));
  return (
    <div className="flex min-w-[7rem] items-center gap-2">
      <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
        {pct.toFixed(1).replace(".", ",")}%
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full" style={{ width: `${width}%`, background: COR.barraPct }} />
      </div>
    </div>
  );
}

/** Quebra rótulos longos do eixo X em até 2 linhas. */
function WaterfallTick(props: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  const { x = 0, y = 0, payload } = props;
  const raw = String(payload?.value ?? "");
  const parts = raw.includes(" ") ? raw.split(/\s+/) : [raw];
  const line1 = parts.length > 2 ? parts.slice(0, Math.ceil(parts.length / 2)).join(" ") : parts[0];
  const line2 = parts.length > 2 ? parts.slice(Math.ceil(parts.length / 2)).join(" ") : parts[1];
  return (
    <text x={x} y={y + 10} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={10}>
      <tspan x={x} dy="0">
        {line1}
      </tspan>
      {line2 ? (
        <tspan x={x} dy="12">
          {line2}
        </tspan>
      ) : null}
    </text>
  );
}

function WaterfallChart({ steps }: { steps: DREWaterfallStep[] }) {
  if (steps.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">Sem dados no período para o gráfico.</p>
    );
  }
  return (
    <div className="h-80 w-full sm:h-[22rem]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={steps} margin={{ top: 28, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis
            dataKey="rotulo"
            tickLine={false}
            axisLine={false}
            interval={0}
            tick={<WaterfallTick />}
            height={44}
          />
          {/* padding inferior: espaço para rótulos das deduções sem cruzar o eixo */}
          <YAxis hide domain={[0, "auto"]} padding={{ top: 8, bottom: 28 }} />
          <Tooltip
            formatter={(_v: number, _n: string, item: { payload?: DREWaterfallStep }) => [
              formatBRL(item.payload?.valor ?? 0),
              item.payload?.rotulo ?? "",
            ]}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Bar dataKey="base" stackId="wf" fill="transparent" isAnimationActive={false} />
          <Bar
            dataKey="altura"
            stackId="wf"
            isAnimationActive={false}
            shape={(raw: unknown) => {
              const props = raw as {
                x?: number;
                y?: number;
                width?: number;
                height?: number;
                index?: number;
                payload?: DREWaterfallStep;
              };
              const step = props.payload ?? (props.index != null ? steps[props.index] : undefined);
              const kind = step?.kind ?? "total";
              // Totais sobem do eixo (arredonda em cima). Deduções caem de cima (arredonda embaixo).
              const radius: [number, number, number, number] =
                kind === "deducao" ? [0, 0, 4, 4] : [4, 4, 0, 0];
              return (
                <Rectangle
                  x={props.x}
                  y={props.y}
                  width={props.width}
                  height={props.height}
                  fill={corBarra(kind)}
                  radius={radius}
                />
              );
            }}
          >
            <LabelList
              dataKey="altura"
              content={(props) => {
                const {
                  x = 0,
                  y = 0,
                  width = 0,
                  height = 0,
                  index = 0,
                  parentViewBox,
                } = props as {
                  x?: number;
                  y?: number;
                  width?: number;
                  height?: number;
                  index?: number;
                  parentViewBox?: { y?: number; height?: number };
                };
                const step = steps[index];
                if (!step) return null;

                const barTop = Number(y);
                const barBottom = Number(y) + Number(height);
                const plotBottom =
                  parentViewBox?.y != null && parentViewBox?.height != null
                    ? Number(parentViewBox.y) + Number(parentViewBox.height)
                    : barBottom + 40;

                // Totais: acima. Deduções (caem de cima): valor embaixo da barra.
                let labelY = step.kind === "deducao" ? barBottom + 13 : barTop - 6;
                const limiteEixo = plotBottom - 2;
                if (step.kind === "deducao" && labelY > limiteEixo) {
                  labelY = Math.min(barBottom + 13, limiteEixo);
                }

                return (
                  <text
                    x={Number(x) + Number(width) / 2}
                    y={labelY}
                    textAnchor="middle"
                    fill="#143D2B"
                    fontSize={11}
                    fontWeight={600}
                  >
                    {formatCompactBRL(step.valor)}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DetalheTable({ linhas, anoLabel }: { linhas: DREDetalheLinha[]; anoLabel: string }) {
  if (linhas.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-muted-foreground">Sem lançamentos no período.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[52rem] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-semibold">Conta</th>
            <th className="px-4 py-3 text-right font-semibold">{anoLabel || "Período"}</th>
            <th className="px-4 py-3 font-semibold">% da receita</th>
            <th className="px-4 py-3 text-right font-semibold">Var. vs. anterior</th>
            <th className="px-4 py-3 text-right font-semibold">Var. %</th>
            <th className="px-4 py-3 font-semibold">Tendência mensal</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const sparkTone =
              l.mensal.length >= 2 && l.mensal[l.mensal.length - 1] < l.mensal[0] ? "down" : "up";
            return (
              <tr
                key={l.chave}
                className={cn(
                  "border-b border-border/60",
                  l.destaque && "bg-secondary/40",
                  l.nivel === 0 && !l.destaque && "bg-card"
                )}
              >
                <td
                  className={cn(
                    "px-4 py-2.5",
                    l.nivel === 1 && "pl-10 text-muted-foreground",
                    l.nivel === 0 && "font-medium text-foreground",
                    l.destaque && "font-display font-semibold"
                  )}
                >
                  {l.rotulo}
                </td>
                <td
                  className={cn(
                    "px-4 py-2.5 text-right tabular-nums",
                    l.destaque ? "font-display font-semibold" : "",
                    l.nivel === 1 && "text-muted-foreground"
                  )}
                >
                  {formatBRL(l.valor)}
                </td>
                <td className="px-4 py-2.5">
                  <PctBar pct={l.pctReceita} />
                </td>
                <td
                  className={cn(
                    "px-4 py-2.5 text-right tabular-nums",
                    l.varAbs > 0 ? "text-success" : l.varAbs < 0 ? "text-[#A67B70]" : "text-muted-foreground"
                  )}
                >
                  {formatVar(l.varAbs)}
                </td>
                <td
                  className={cn(
                    "px-4 py-2.5 text-right tabular-nums",
                    (l.varPct ?? 0) > 0
                      ? "text-success"
                      : (l.varPct ?? 0) < 0
                        ? "text-[#A67B70]"
                        : "text-muted-foreground"
                  )}
                >
                  {formatVarPct(l.varPct)}
                </td>
                <td className="px-4 py-2.5">
                  <Sparkline values={l.mensal} tone={sparkTone} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
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
        subtitle="Demonstrativo do Resultado do Exercício"
        actions={
          <button className="btn-primary" onClick={exportar}>
            <Download className="h-4 w-4" /> Baixar CSV
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

      <div className="card mb-6 p-5">
        <h2 className="mb-1 font-display text-sm font-semibold tracking-tight text-foreground">
          Da receita ao lucro líquido
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">Acumulado no período filtrado</p>
        <WaterfallChart steps={dre.waterfall} />
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-display text-sm font-semibold tracking-tight">Detalhamento</h2>
        </div>
        <DetalheTable linhas={dre.detalhe} anoLabel={dre.anoLabel} />
      </div>
    </>
  );
}

export function DREPage() {
  return <RequireEmpresa>{(id) => <Inner empresaId={id} />}</RequireEmpresa>;
}
