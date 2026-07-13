import { useMemo } from "react";
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
import { getDashboard, getFluxoCaixa, type DashboardData, type FluxoBucket } from "@/data/analytics";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatBRL, formatDate } from "@/lib/utils";

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

function Inner({ empresaId }: { empresaId: string }) {
  const { version, empresaAtiva } = useEmpresa();
  const { data } = useAsyncData(() => getDashboard(empresaId), [empresaId, version], EMPTY_DASH);
  const { data: fluxo } = useAsyncData(
    () => getFluxoCaixa(empresaId),
    [empresaId, version],
    [] as FluxoBucket[]
  );

  const proximosVencimentos = useMemo(() => {
    const todos = [
      ...data.pagar
        .filter((c) => c.status === "aberta" || c.status === "parcial" || c.status === "vencida")
        .map((c) => ({
          id: c.id,
          tipo: "Pagar" as const,
          pessoa: c.fornecedor,
          valor: c.valor - c.valorPago,
          vencimento: c.dataVencimento,
          status: c.status,
        })),
      ...data.receber
        .filter((c) => c.status === "aberta" || c.status === "parcial" || c.status === "vencida")
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
  }, [data]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Visão financeira de ${empresaAtiva?.nomeFantasia ?? ""}.`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Wallet} label="Saldo atual" value={data.saldoAtual} tone={data.saldoAtual >= 0 ? "default" : "danger"} />
        <Kpi icon={TrendingUp} label="Saldo projetado" value={data.saldoProjetado} tone={data.saldoProjetado >= 0 ? "success" : "danger"} />
        <Kpi icon={ArrowDownCircle} label="Total a receber" value={data.totalAReceber} tone="success" />
        <Kpi icon={ArrowUpCircle} label="Total a pagar" value={data.totalAPagar} tone="danger" />
        <Kpi icon={ArrowDownCircle} label="Receitas do mês" value={data.receitasMes} tone="success" />
        <Kpi icon={ArrowUpCircle} label="Despesas do mês" value={data.despesasMes} tone="danger" />
        <Kpi icon={AlertTriangle} label="Inadimplência" value={data.inadimplencia} tone={data.inadimplencia > 0 ? "warning" : "default"} />
        <Kpi
          icon={CalendarClock}
          label="Resultado do mês"
          value={data.receitasMes - data.despesasMes}
          tone={data.receitasMes - data.despesasMes >= 0 ? "success" : "danger"}
        />
      </div>

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
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
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
