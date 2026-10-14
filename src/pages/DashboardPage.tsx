import { useMemo, useState } from "react";
import {
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  CalendarClock,
  AlertTriangle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
import { cn, formatBRL, formatDate } from "@/lib/utils";

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
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RequireEmpresa } from "@/components/RequireEmpresa";

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
  const { data: fluxo } = useAsyncData(
    () =>
      faixa
        ? getFluxoCaixaPeriodo(empresaId, faixa.inicio, faixa.fim)
        : Promise.resolve([] as FluxoBucket[]),
    [empresaId, version, faixa?.inicio, faixa?.fim],
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

  const proximosVencimentos = (() => {
    const todos = [
      ...data.pagar
        .filter((c) => (c.status === "aberta" || c.status === "parcial" || c.status === "vencida") && noPeriodo(c.dataVencimento))
        .map((c) => ({
          id: c.id,
          tipo: "Pagar" as const,
          pessoa: c.fornecedor,
          valor: c.valor - c.valorPago,
          vencimento: c.dataVencimento,
          status: c.status,
        })),
      ...data.receber
        .filter((c) => (c.status === "aberta" || c.status === "parcial" || c.status === "vencida") && noPeriodo(c.dataVencimento))
        .map((c) => ({
          id: c.id,
          tipo: "Receber" as const,
          pessoa: c.cliente,
          valor: c.valor - c.valorRecebido,
          vencimento: c.dataVencimento,
          status: c.status,
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

      <div className="mb-4 flex flex-wrap gap-1.5">
        {PERIODOS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriodoDash(p.id)}
            className={cn(
              "badge cursor-pointer",
              periodoDash === p.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Wallet} label="Saldo atual" value={data.saldoAtual} tone={data.saldoAtual >= 0 ? "default" : "danger"} />
        <Kpi icon={TrendingUp} label="Saldo projetado" value={data.saldoProjetado} tone={data.saldoProjetado >= 0 ? "success" : "danger"} />
        <Kpi icon={ArrowDownCircle} label="Total a receber" value={data.totalAReceber} tone="success" />
        <Kpi icon={ArrowUpCircle} label="Total a pagar" value={data.totalAPagar} tone="danger" />
        <Kpi icon={ArrowDownCircle} label="Valor ganho" value={valorGanho} tone="success" />
        <Kpi icon={ArrowUpCircle} label="Valor gasto" value={valorGasto} tone="danger" />
        <Kpi icon={AlertTriangle} label="Inadimplência" value={inadimplencia} tone={inadimplencia > 0 ? "warning" : "default"} />
        <Kpi
          icon={CalendarClock}
          label="Resultado"
          value={valorGanho - valorGasto}
          tone={valorGanho - valorGasto >= 0 ? "success" : "danger"}
        />
      </div>

      {saldos.contas.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Kpi icon={Wallet} label="Saldo das contas" value={saldos.total} tone={saldos.total >= 0 ? "default" : "danger"} />
          {saldos.contas.map((c) => (
            <Kpi
              key={c.id}
              icon={Wallet}
              label={c.nome}
              value={c.saldo}
              tone={c.saldo >= 0 ? "default" : "danger"}
            />
          ))}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="card p-4 lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold">Fluxo de caixa (previsto)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fluxo} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
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
                  labelClassName="text-xs"
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="entradas" name="Entradas" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saidas" name="Saídas" fill="hsl(0 72% 60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Próximos vencimentos</h2>
          {proximosVencimentos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum vencimento em aberto.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {proximosVencimentos.map((v) => (
                <li key={`${v.tipo}-${v.id}`} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{v.pessoa}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.tipo} · {formatDate(v.vencimento)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium tabular-nums ${
                        v.tipo === "Receber" ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {formatBRL(v.valor)}
                    </span>
                    <StatusBadge status={v.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: "default" | "success" | "danger" | "warning";
}) {
  const colors: Record<string, string> = {
    default: "text-foreground",
    success: "text-emerald-600",
    danger: "text-red-600",
    warning: "text-amber-600",
  };
  return (
    <div className="card px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className={`mt-2 text-lg font-semibold tabular-nums ${colors[tone]}`}>
        {formatBRL(value)}
      </p>
    </div>
  );
}

export function DashboardPage() {
  return <RequireEmpresa>{(id) => <Inner empresaId={id} />}</RequireEmpresa>;
}
