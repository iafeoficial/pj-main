import {
  CartesianGrid,
  Line,
  ComposedChart,
  Bar,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getFluxoCaixa, type FluxoBucket } from "@/data/analytics";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatBRL } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { RequireEmpresa } from "@/components/RequireEmpresa";

function Inner({ empresaId }: { empresaId: string }) {
  const { version } = useEmpresa();
  const { data: fluxo } = useAsyncData(
    () => getFluxoCaixa(empresaId, 3, 6),
    [empresaId, version],
    [] as FluxoBucket[]
  );

  return (
    <>
      <PageHeader
        title="Fluxo de Caixa"
        subtitle="Projeção de entradas e saídas por vencimento, com saldo acumulado."
      />

      <div className="card mb-6 p-4">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={fluxo} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
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
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="entradas" name="Entradas" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="saidas" name="Saídas" fill="hsl(0 72% 60%)" radius={[4, 4, 0, 0]} />
              <Line
                type="monotone"
                dataKey="saldoAcumulado"
                name="Saldo acumulado"
                stroke="hsl(173 80% 28%)"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Mês</th>
              <th className="px-4 py-2.5 text-right font-medium">Entradas</th>
              <th className="px-4 py-2.5 text-right font-medium">Saídas</th>
              <th className="px-4 py-2.5 text-right font-medium">Saldo do mês</th>
              <th className="px-4 py-2.5 text-right font-medium">Saldo acumulado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {fluxo.map((b) => (
              <tr key={b.mes} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium capitalize">{b.label}</td>
                <td className="px-4 py-3 text-right tabular-nums text-emerald-600">
                  {formatBRL(b.entradas)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-red-600">
                  {formatBRL(b.saidas)}
                </td>
                <td
                  className={`px-4 py-3 text-right tabular-nums ${
                    b.saldoMes >= 0 ? "text-foreground" : "text-red-600"
                  }`}
                >
                  {formatBRL(b.saldoMes)}
                </td>
                <td
                  className={`px-4 py-3 text-right font-medium tabular-nums ${
                    b.saldoAcumulado >= 0 ? "text-emerald-700" : "text-red-600"
                  }`}
                >
                  {formatBRL(b.saldoAcumulado)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function FluxoCaixaPage() {
  return <RequireEmpresa>{(id) => <Inner empresaId={id} />}</RequireEmpresa>;
}
