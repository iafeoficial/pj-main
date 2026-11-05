import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getDashboard,
  getFluxoCaixaPeriodo,
  getPeriodoPadrao,
  getSaldosContas,
  type DashboardData,
  type FluxoBucket,
  type SaldoContaLinha,
} from "@/data/analytics";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { CHART } from "@/lib/chartTheme";
import { cn, formatBRL, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { RequireEmpresa } from "@/components/RequireEmpresa";

const EMPTY_DASH: DashboardData = {
  saldoAtual: 0,
  totalAReceber: 0,
  totalAPagar: 0,
  saldoProjetado: 0,
  receitasMes: 0,
  despesasMes: 0,
  inadimplencia: 0,
  pagar: [],
  receber: [],
};

const TERRACOTA = "#C9A59A";

type PeriodoDash = "mes" | "seis" | "ano" | "tudo";

const PERIODOS: { id: PeriodoDash; label: string }[] = [
  { id: "mes", label: "Este mês" },
  { id: "seis", label: "6 meses" },
  { id: "ano", label: "Este ano" },
  { id: "tudo", label: "Tudo" },
];

function dataLocal(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function hojeIso(): string {
  return dataLocal(new Date());
}

/** Mês corrente, últimos 6 meses civis ou ano corrente. */
function intervaloCurto(modo: Exclude<PeriodoDash, "tudo">): { inicio: string; fim: string } {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  if (modo === "mes") {
    return { inicio: dataLocal(new Date(ano, mes, 1)), fim: dataLocal(new Date(ano, mes + 1, 0)) };
  }
  if (modo === "ano") {
    return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` };
  }
  return { inicio: dataLocal(new Date(ano, mes - 5, 1)), fim: dataLocal(new Date(ano, mes + 1, 0)) };
}

function shiftIsoDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return dataLocal(d);
}

/** Período imediatamente anterior, com a mesma duração. */
function periodoAnterior(inicio: string, fim: string): { inicio: string; fim: string } {
  const a = new Date(`${inicio}T00:00:00`);
  const b = new Date(`${fim}T00:00:00`);
  const dias = Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
  const fimAnt = shiftIsoDays(inicio, -1);
  const inicioAnt = shiftIsoDays(fimAnt, -(dias - 1));
  return { inicio: inicioAnt, fim: fimAnt };
}

function Sparkline({
  values,
  stroke,
  fill,
}: {
  values: number[];
  stroke: string;
  fill?: string;
}) {
  if (values.length < 2) {
    return <div className="h-8" />;
  }
  const w = 120;
  const h = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / span) * (h - 4) - 2;
    return [x, y] as const;
  });
  const line = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden className="mt-3 block">
      {fill ? <polygon points={area} fill={fill} opacity={0.35} /> : null}
      <polyline fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" points={line} />
    </svg>
  );
}

function Inner({ empresaId }: { empresaId: string }) {
  const { version, empresaAtiva } = useEmpresa();
  const [periodoDash, setPeriodoDash] = useState<PeriodoDash>("tudo");
  const { data } = useAsyncData(() => getDashboard(empresaId), [empresaId, version], EMPTY_DASH);
  const { data: periodo } = useAsyncData(
    () => getPeriodoPadrao(empresaId, "vencimento"),
    [empresaId, version],
    null as { inicio: string; fim: string } | null
  );
  const faixa = useMemo(
    () => (periodoDash === "tudo" ? periodo : intervaloCurto(periodoDash)),
    [periodoDash, periodo]
  );
  const faixaAnt = useMemo(
    () => (faixa ? periodoAnterior(faixa.inicio, faixa.fim) : null),
    [faixa]
  );
  const { data: fluxo } = useAsyncData(
    () =>
      faixa
        ? getFluxoCaixaPeriodo(empresaId, faixa.inicio, faixa.fim)
        : Promise.resolve([] as FluxoBucket[]),
    [empresaId, version, faixa?.inicio, faixa?.fim],
    [] as FluxoBucket[]
  );
  const { data: fluxoAnt } = useAsyncData(
    () =>
      faixaAnt
        ? getFluxoCaixaPeriodo(empresaId, faixaAnt.inicio, faixaAnt.fim)
        : Promise.resolve([] as FluxoBucket[]),
    [empresaId, version, faixaAnt?.inicio, faixaAnt?.fim],
    [] as FluxoBucket[]
  );
  const { data: saldos } = useAsyncData(
    () => getSaldosContas(empresaId),
    [empresaId, version],
    { contas: [] as SaldoContaLinha[], total: 0 }
  );

  const noPeriodo = (iso: string) =>
    periodoDash === "tudo" || (faixa != null && iso >= faixa.inicio && iso <= faixa.fim);

  const valorGanho = data.receber
    .filter((c) => c.status !== "cancelada" && noPeriodo(c.dataVencimento))
    .reduce((s, c) => s + c.valor, 0);
  const valorGasto = data.pagar
    .filter((c) => c.status !== "cancelada" && noPeriodo(c.dataVencimento))
    .reduce((s, c) => s + c.valor, 0);
  const inadimplencia = data.receber
    .filter((c) => c.status === "vencida" && noPeriodo(c.dataVencimento))
    .reduce((s, c) => s + (c.valor - c.valorRecebido), 0);
  const resultado = valorGanho - valorGasto;

  const sparkSaldo = useMemo(() => fluxo.map((b) => b.saldoAcumulado), [fluxo]);
  const sparkReceber = useMemo(() => {
    if (!faixa) return [] as number[];
    return fluxo.map((b) =>
      data.receber
        .filter(
          (c) =>
            c.status !== "cancelada" &&
            c.status !== "recebida" &&
            c.dataVencimento.slice(0, 7) <= b.mes &&
            c.dataVencimento >= faixa.inicio &&
            c.dataVencimento <= faixa.fim
        )
        .reduce((s, c) => s + (c.valor - c.valorRecebido), 0)
    );
  }, [fluxo, data.receber, faixa]);
  const sparkPagar = useMemo(() => {
    if (!faixa) return [] as number[];
    return fluxo.map((b) =>
      data.pagar
        .filter(
          (c) =>
            c.status !== "cancelada" &&
            c.status !== "paga" &&
            c.dataVencimento.slice(0, 7) <= b.mes &&
            c.dataVencimento >= faixa.inicio &&
            c.dataVencimento <= faixa.fim
        )
        .reduce((s, c) => s + (c.valor - c.valorPago), 0)
    );
  }, [fluxo, data.pagar, faixa]);

  const saldoPct = useMemo(() => {
    const atual = sparkSaldo[sparkSaldo.length - 1] ?? data.saldoAtual;
    const ant = fluxoAnt[fluxoAnt.length - 1]?.saldoAcumulado;
    if (ant == null || ant === 0) return null;
    return ((atual - ant) / Math.abs(ant)) * 100;
  }, [sparkSaldo, fluxoAnt, data.saldoAtual]);

  const chartData = useMemo(() => {
    const mesHoje = hojeIso().slice(0, 7);
    return fluxo.map((b) => ({
      label: b.label,
      mes: b.mes,
      realizado: b.mes <= mesHoje ? b.saldoAcumulado : null,
      previsto: b.mes >= mesHoje ? b.saldoAcumulado : null,
    }));
  }, [fluxo]);

  const proximosVencimentos = (() => {
    const todos = [
      ...data.pagar
        .filter(
          (c) =>
            (c.status === "aberta" || c.status === "parcial" || c.status === "vencida") &&
            noPeriodo(c.dataVencimento)
        )
        .map((c) => ({
          id: c.id,
          tipo: "Pagar" as const,
          pessoa: c.fornecedor,
          valor: c.valor - c.valorPago,
          vencimento: c.dataVencimento,
        })),
      ...data.receber
        .filter(
          (c) =>
            (c.status === "aberta" || c.status === "parcial" || c.status === "vencida") &&
            noPeriodo(c.dataVencimento)
        )
        .map((c) => ({
          id: c.id,
          tipo: "Receber" as const,
          pessoa: c.cliente,
          valor: c.valor - c.valorRecebido,
          vencimento: c.dataVencimento,
        })),
    ];
    return todos.sort((a, b) => a.vencimento.localeCompare(b.vencimento)).slice(0, 8);
  })();

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Visão financeira de ${empresaAtiva?.nomeFantasia ?? ""}.`}
      />

      <div className="mb-4 inline-flex flex-wrap gap-1 rounded-full bg-secondary p-1">
        {PERIODOS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriodoDash(p.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              periodoDash === p.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Fileira 1 — 4 balões com sparkline */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTop
          label="Saldo atual"
          value={data.saldoAtual}
          featured
          pct={saldoPct}
          spark={sparkSaldo}
          sparkStroke="#FFFFFF"
          sparkFill="rgba(255,255,255,0.25)"
        />
        <KpiTop
          label="Saldo projetado"
          value={data.saldoProjetado}
          tone={data.saldoProjetado >= 0 ? "success" : "danger"}
          spark={sparkSaldo}
          sparkStroke={CHART.realizado}
          sparkFill="rgba(94,156,120,0.2)"
        />
        <KpiTop
          label="Total a receber"
          value={data.totalAReceber}
          tone="success"
          spark={sparkReceber}
          sparkStroke={CHART.realizado}
          sparkFill="rgba(94,156,120,0.2)"
        />
        <KpiTop
          label="Total a pagar"
          value={data.totalAPagar}
          tone="danger"
          spark={sparkPagar}
          sparkStroke={TERRACOTA}
          sparkFill="rgba(201,165,154,0.25)"
        />
      </div>

      {/* Fileira 2 — 4 balões */}
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiSimple label="Valor ganho" value={valorGanho} tone="success" />
        <KpiSimple label="Valor gasto" value={valorGasto} tone="danger" />
        <KpiSimple label="Inadimplência" value={inadimplencia} tone={inadimplencia > 0 ? "warning" : "default"} />
        <KpiSimple label="Resultado" value={resultado} tone={resultado >= 0 ? "success" : "danger"} highlight />
      </div>

      {/* Base: Fluxo | Vencimentos | Contas */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="card p-5 lg:col-span-5">
          <h2 className="mb-1 font-display text-sm font-semibold tracking-tight">Fluxo de caixa (previsto)</h2>
          <p className="mb-3 text-xs text-muted-foreground">Realizado até hoje · previsto à frente</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART.grid} />
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) =>
                    Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v))
                  }
                />
                <Tooltip
                  formatter={(v: number) => formatBRL(v)}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="realizado"
                  name=" "
                  stroke="none"
                  fill="rgba(94,156,120,0.15)"
                  connectNulls={false}
                  legendType="none"
                />
                <Line
                  type="monotone"
                  dataKey="realizado"
                  name="Realizado"
                  stroke={CHART.saldo}
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="previsto"
                  name="Previsto"
                  stroke={CHART.previsto}
                  strokeWidth={2.5}
                  strokeDasharray="6 4"
                  dot={false}
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5 lg:col-span-4">
          <h2 className="mb-3 font-display text-sm font-semibold tracking-tight">Próximos vencimentos</h2>
          {proximosVencimentos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum vencimento em aberto.</p>
          ) : (
            <ul className="space-y-3">
              {proximosVencimentos.map((v) => (
                <li key={`${v.tipo}-${v.id}`} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium uppercase tracking-wide">{v.pessoa}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {v.tipo === "Receber" ? "Receber em" : "Vence em"} {formatDate(v.vencimento)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        v.tipo === "Receber" ? "text-success" : "text-foreground"
                      )}
                    >
                      {formatBRL(v.valor)}
                    </p>
                    <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Aberto
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5 lg:col-span-3">
          <h2 className="mb-3 font-display text-sm font-semibold tracking-tight">Contas e aplicações</h2>
          <div className="space-y-2">
            <ContaBalloon label="Saldo das contas" value={saldos.total} />
            {saldos.contas.map((c) => (
              <ContaBalloon key={c.id} label={c.nome} value={c.saldo} />
            ))}
            {saldos.contas.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma conta cadastrada.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function KpiTop({
  label,
  value,
  tone = "default",
  featured,
  pct,
  spark,
  sparkStroke,
  sparkFill,
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "danger" | "warning";
  featured?: boolean;
  pct?: number | null;
  spark: number[];
  sparkStroke: string;
  sparkFill?: string;
}) {
  if (featured) {
    return (
      <div className="rounded-lg bg-primary px-4 py-3.5 text-primary-foreground shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-white/75">{label}</p>
          {pct != null && Number.isFinite(pct) && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                pct >= 0 ? "bg-brand-highlight/30 text-brand-highlight" : "bg-white/15 text-white/90"
              )}
            >
              {pct >= 0 ? "+" : "−"}
              {Math.abs(pct).toFixed(1).replace(".", ",")}%
            </span>
          )}
        </div>
        <p className="mt-2 font-display text-xl font-semibold tabular-nums tracking-tight text-white">
          {formatBRL(value)}
        </p>
        <Sparkline values={spark} stroke={sparkStroke} fill={sparkFill} />
      </div>
    );
  }

  const colors: Record<string, string> = {
    default: "text-foreground",
    success: "text-success",
    danger: "text-[#A67B70]",
    warning: "text-amber-600",
  };
  return (
    <div className="kpi-balloon">
      <p className="kpi-label">{label}</p>
      <p className={`kpi-value mt-2 ${colors[tone]}`}>{formatBRL(value)}</p>
      <Sparkline values={spark} stroke={sparkStroke} fill={sparkFill} />
    </div>
  );
}

function KpiSimple({
  label,
  value,
  tone,
  highlight,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: "default" | "success" | "danger" | "warning";
  highlight?: boolean;
  icon?: LucideIcon;
}) {
  const colors: Record<string, string> = {
    default: "text-foreground",
    success: "text-success",
    danger: "text-[#A67B70]",
    warning: "text-amber-600",
  };
  return (
    <div className={highlight ? "kpi-balloon-featured" : "kpi-balloon"}>
      <div className="flex items-start justify-between gap-2">
        <p className="kpi-label min-w-0">{label}</p>
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
      </div>
      <p className={`kpi-value mt-2 ${highlight ? "text-primary" : colors[tone]}`}>{formatBRL(value)}</p>
    </div>
  );
}

function ContaBalloon({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2.5">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-display text-sm font-semibold tabular-nums",
          value < 0 ? "text-[#A67B70]" : "text-foreground"
        )}
      >
        {formatBRL(value)}
      </p>
    </div>
  );
}

export function DashboardPage() {
  return <RequireEmpresa>{(id) => <Inner empresaId={id} />}</RequireEmpresa>;
}
