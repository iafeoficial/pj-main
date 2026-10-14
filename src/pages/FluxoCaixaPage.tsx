import { useEffect, useMemo, useState } from "react";
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
import {
  getFluxoCaixaPeriodo,
  getPeriodoPadrao,
  getSaldosContas,
  listarLancamentosFluxo,
  type FluxoBucket,
  type LancamentoFluxo,
  type SaldoContaLinha,
} from "@/data/analytics";
import { clienteService, fornecedorService } from "@/data/cadastros";
import { combinaBusca, partesData, partesValor } from "@/lib/busca";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatBRL, formatDate, monthRange } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { BuscaCampo } from "@/components/ui/BuscaCampo";
import { Field } from "@/components/ui/Field";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { RequireEmpresa } from "@/components/RequireEmpresa";

function Inner({ empresaId }: { empresaId: string }) {
  const { version } = useEmpresa();
  const fallback = monthRange();
  const { data: periodo } = useAsyncData(
    () => getPeriodoPadrao(empresaId, "vencimento"),
    [empresaId, version],
    null as { inicio: string; fim: string } | null
  );
  const [inicio, setInicio] = useState(fallback.start);
  const [fim, setFim] = useState(fallback.end);
  const [manual, setManual] = useState(false);
  const [contaId, setContaId] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    setManual(false);
    setContaId("");
  }, [empresaId]);

  useEffect(() => {
    if (periodo && !manual) {
      setInicio(periodo.inicio);
      setFim(periodo.fim);
    }
  }, [periodo, manual]);

  const { data: fluxo } = useAsyncData(
    () => (inicio && fim ? getFluxoCaixaPeriodo(empresaId, inicio, fim, contaId || null) : Promise.resolve([])),
    [empresaId, inicio, fim, contaId, version],
    [] as FluxoBucket[]
  );
  const { data: lancamentos } = useAsyncData(
    () =>
      inicio && fim
        ? listarLancamentosFluxo(empresaId, inicio, fim, contaId || null)
        : Promise.resolve([] as LancamentoFluxo[]),
    [empresaId, inicio, fim, contaId, version],
    [] as LancamentoFluxo[]
  );
  const { data: clientes } = useAsyncData(
    () => clienteService.list(empresaId),
    [empresaId, version],
    []
  );
  const { data: fornecedores } = useAsyncData(
    () => fornecedorService.list(empresaId),
    [empresaId, version],
    []
  );
  const { data: saldos } = useAsyncData(
    () => getSaldosContas(empresaId),
    [empresaId, version],
    { contas: [] as SaldoContaLinha[], total: 0 }
  );

  const documentoDe = useMemo(() => {
    const porId = new Map<string, string>();
    const porNome = new Map<string, string>();
    for (const p of [...clientes, ...fornecedores]) {
      if (p.cnpjCpf) {
        porId.set(p.id, p.cnpjCpf);
        if (!porNome.has(p.nome)) porNome.set(p.nome, p.cnpjCpf);
      }
    }
    return { porId, porNome };
  }, [clientes, fornecedores]);

  const lancamentosBusca = useMemo(() => {
    const q = busca.trim();
    if (!q) return [] as LancamentoFluxo[];
    return lancamentos.filter((l) => {
      const doc = (l.parceiroId && documentoDe.porId.get(l.parceiroId)) || documentoDe.porNome.get(l.pessoa) || "";
      return combinaBusca(q, [l.pessoa, doc, ...partesValor(l.valor), ...partesData(l.data)]);
    });
  }, [busca, lancamentos, documentoDe]);

  const fluxoVisivel = useMemo(() => {
    const q = busca.trim();
    if (!q) return fluxo;
    const meses = new Set(lancamentosBusca.map((l) => l.mes));
    return fluxo.filter(
      (b) =>
        meses.has(b.mes) ||
        combinaBusca(q, [b.label, b.mes, ...partesValor(b.entradas), ...partesValor(b.saidas), ...partesValor(b.saldoMes), ...partesValor(b.saldoAcumulado)])
    );
  }, [busca, fluxo, lancamentosBusca]);

  const opcoes = [
    { value: "", label: "Todas as contas" },
    ...saldos.contas.map((c) => ({ value: c.id, label: c.nome })),
  ];

  return (
    <>
      <PageHeader
        title="Fluxo de Caixa"
        subtitle="Entradas e saídas por vencimento no período. O saldo da conta é o acumulado até agora."
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
        <Field label="Conta" className="min-w-[16rem]">
          <Select value={contaId} onChange={setContaId} options={opcoes} placeholder="Todas as contas" />
        </Field>
        <div className="min-w-[16rem] flex-1">
          <BuscaCampo value={busca} onChange={setBusca} />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setContaId("")}
          className={`card p-4 text-left ${contaId === "" ? "ring-2 ring-primary" : ""}`}
        >
          <p className="text-xs text-muted-foreground">Saldo total</p>
          <p className={`mt-1 text-lg font-semibold tabular-nums ${saldos.total >= 0 ? "text-emerald-700" : "text-red-600"}`}>
            {formatBRL(saldos.total)}
          </p>
        </button>
        {saldos.contas.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setContaId(c.id)}
            className={`card p-4 text-left ${contaId === c.id ? "ring-2 ring-primary" : ""}`}
          >
            <p className="text-xs text-muted-foreground">{c.nome}</p>
            <p className={`mt-1 text-lg font-semibold tabular-nums ${c.saldo >= 0 ? "text-emerald-700" : "text-red-600"}`}>
              {formatBRL(c.saldo)}
            </p>
          </button>
        ))}
      </div>

      <div className="card mb-6 p-4">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={fluxoVisivel} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
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
            {fluxoVisivel.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  {busca.trim() ? "Nenhum resultado para esta busca." : "Sem movimento no período."}
                </td>
              </tr>
            ) : (
              fluxoVisivel.map((b) => (
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {busca.trim() && (
        <div className="card mt-6 overflow-x-auto">
          <div className="border-b border-border px-4 py-2.5">
            <h2 className="text-sm font-semibold">Lançamentos encontrados</h2>
          </div>
          {lancamentosBusca.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum resultado para esta busca.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Nome</th>
                  <th className="px-4 py-2.5 font-medium">CPF/CNPJ</th>
                  <th className="px-4 py-2.5 font-medium">Data</th>
                  <th className="px-4 py-2.5 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lancamentosBusca.map((l) => {
                  const doc =
                    (l.parceiroId && documentoDe.porId.get(l.parceiroId)) ||
                    documentoDe.porNome.get(l.pessoa) ||
                    "—";
                  return (
                    <tr key={`${l.tipo}-${l.id}`} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{l.pessoa}</td>
                      <td className="px-4 py-3">{doc}</td>
                      <td className="px-4 py-3">{formatDate(l.data)}</td>
                      <td
                        className={`px-4 py-3 text-right tabular-nums ${
                          l.tipo === "entrada" ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {formatBRL(l.valor)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}

export function FluxoCaixaPage() {
  return <RequireEmpresa>{(id) => <Inner empresaId={id} />}</RequireEmpresa>;
}
