import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  ComposedChart,
  Bar,
  ReferenceLine,
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
import { usePersistedState } from "@/hooks/usePersistedState";
import { CHART } from "@/lib/chartTheme";
import { cn, formatBRL, formatDate, monthRange, STATUS_LABEL } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { BuscaCampo } from "@/components/ui/BuscaCampo";
import { Field } from "@/components/ui/Field";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { RequireEmpresa } from "@/components/RequireEmpresa";
import { ContasPagarPainel } from "@/pages/ContasPagarPage";
import { ContasReceberPainel } from "@/pages/ContasReceberPage";

type FluxoFiltros = {
  inicio: string;
  fim: string;
  contaId: string;
  busca: string;
  /** true = usuário escolheu o período; não sobrescrever com o padrão da empresa */
  manual: boolean;
};

function filtrosFluxoPadrao(): FluxoFiltros {
  const m = monthRange();
  return { inicio: m.start, fim: m.end, contaId: "", busca: "", manual: false };
}

function normalizarFiltrosFluxo(raw: FluxoFiltros): FluxoFiltros {
  const iso = (s: unknown) => (typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "");
  const padrao = filtrosFluxoPadrao();
  return {
    inicio: iso(raw.inicio) || padrao.inicio,
    fim: iso(raw.fim) || padrao.fim,
    contaId: typeof raw.contaId === "string" ? raw.contaId : "",
    busca: typeof raw.busca === "string" ? raw.busca : "",
    manual: !!raw.manual,
  };
}

const TERRACOTA = "#C9A59A";

type AbaFluxo = "fluxo" | "pagar" | "receber";

const ABAS: { id: AbaFluxo; label: string }[] = [
  { id: "fluxo", label: "Fluxo de caixa" },
  { id: "pagar", label: "Contas a pagar" },
  { id: "receber", label: "Contas a receber" },
];

function statusExtrato(status: string, data: string): { label: string; className: string } {
  const hoje = new Date().toISOString().slice(0, 10);
  if (status === "paga" || status === "recebida") {
    return { label: STATUS_LABEL[status] ?? status, className: "bg-[#E8F4EE] text-success" };
  }
  if (status === "vencida" || (status === "aberta" && data < hoje)) {
    return { label: "Vencida", className: "bg-red-100 text-red-700" };
  }
  if (status === "parcial") {
    return { label: "Parcial", className: "bg-amber-100 text-amber-800" };
  }
  return { label: "A vencer", className: "bg-[#F3E6E0] text-[#8A5E52]" };
}

function Sparkline({ values, stroke, fill }: { values: number[]; stroke: string; fill?: string }) {
  if (values.length < 2) return <div className="mt-3 h-8" />;
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
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden
      className="mt-3 block"
    >
      {fill ? <polygon points={area} fill={fill} opacity={0.35} /> : null}
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={line}
      />
    </svg>
  );
}

function Inner({ empresaId }: { empresaId: string }) {
  const { version } = useEmpresa();
  const { data: periodo } = useAsyncData(
    () => getPeriodoPadrao(empresaId, "vencimento"),
    [empresaId, version],
    null as { inicio: string; fim: string } | null
  );
  const [filtrosRaw, setFiltros] = usePersistedState<FluxoFiltros>(
    `financas_pj:filtros:fluxo:${empresaId}`,
    filtrosFluxoPadrao()
  );
  const filtros = normalizarFiltrosFluxo(filtrosRaw);
  const { inicio, fim, contaId, busca, manual } = filtros;
  const [extratoAberto, setExtratoAberto] = useState(false);

  useEffect(() => {
    if (!periodo || manual) return;
    if (periodo.inicio === inicio && periodo.fim === fim) return;
    setFiltros((f) => {
      const cur = normalizarFiltrosFluxo(f);
      if (cur.manual) return cur;
      return { ...cur, inicio: periodo.inicio, fim: periodo.fim, manual: false };
    });
  }, [periodo, manual, inicio, fim, setFiltros]);

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

  const lancamentosVisiveis = useMemo(() => {
    const q = busca.trim();
    const base = !q
      ? lancamentos
      : lancamentos.filter((l) => {
          const doc =
            (l.parceiroId && documentoDe.porId.get(l.parceiroId)) || documentoDe.porNome.get(l.pessoa) || "";
          return combinaBusca(q, [
            l.pessoa,
            doc,
            l.contaNome,
            l.status,
            ...partesValor(l.valor),
            ...partesData(l.data),
          ]);
        });
    return [...base].sort((a, b) => a.data.localeCompare(b.data) || a.pessoa.localeCompare(b.pessoa, "pt-BR"));
  }, [busca, lancamentos, documentoDe]);

  const fluxoVisivel = useMemo(() => {
    const q = busca.trim();
    if (!q) return fluxo;
    const meses = new Set(lancamentosVisiveis.map((l) => l.mes));
    return fluxo.filter(
      (b) =>
        meses.has(b.mes) ||
        combinaBusca(q, [
          b.label,
          b.mes,
          ...partesValor(b.entradas),
          ...partesValor(b.saidas),
          ...partesValor(b.saldoMes),
          ...partesValor(b.saldoAcumulado),
        ])
    );
  }, [busca, fluxo, lancamentosVisiveis]);

  /** Entradas positivas / saídas negativas para o gráfico do mockup. */
  const chartData = useMemo(
    () =>
      fluxoVisivel.map((b) => ({
        ...b,
        saidasNeg: -Math.abs(b.saidas),
      })),
    [fluxoVisivel]
  );

  const sparkSaldo = useMemo(() => fluxoVisivel.map((b) => b.saldoAcumulado), [fluxoVisivel]);

  const extratoLinhas = extratoAberto ? lancamentosVisiveis : lancamentosVisiveis.slice(0, 10);

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

      {/* Filtros — última escolha do usuário (por empresa) fica no localStorage */}
      <div className="card mb-6 flex flex-wrap items-end gap-4 p-4">
        <Field label="Início">
          <DatePicker
            value={inicio}
            onChange={(v) => setFiltros((f) => ({ ...normalizarFiltrosFluxo(f), inicio: v, manual: true }))}
          />
        </Field>
        <Field label="Fim">
          <DatePicker
            value={fim}
            onChange={(v) => setFiltros((f) => ({ ...normalizarFiltrosFluxo(f), fim: v, manual: true }))}
          />
        </Field>
        <Field label="Conta" className="min-w-[16rem]">
          <Select
            value={contaId}
            onChange={(v) => setFiltros((f) => ({ ...normalizarFiltrosFluxo(f), contaId: v }))}
            options={opcoes}
            placeholder="Todas as contas"
          />
        </Field>
        <div className="min-w-[16rem] flex-1">
          <BuscaCampo
            value={busca}
            onChange={(v) => setFiltros((f) => ({ ...normalizarFiltrosFluxo(f), busca: v }))}
          />
        </div>
      </div>

      {/* 4 balões: Saldo total (verde profundo) + contas */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setFiltros((f) => ({ ...normalizarFiltrosFluxo(f), contaId: "" }))}
          className={cn(
            "rounded-lg bg-primary px-4 py-3.5 text-left text-primary-foreground shadow-sm transition-shadow",
            contaId === "" && "ring-2 ring-brand-highlight ring-offset-2"
          )}
        >
          <p className="text-xs font-medium text-white/75">Saldo total</p>
          <p className="mt-1 font-display text-xl font-semibold tabular-nums tracking-tight text-white">
            {formatBRL(saldos.total)}
          </p>
          <Sparkline values={sparkSaldo} stroke="#FFFFFF" fill="rgba(255,255,255,0.25)" />
        </button>
        {saldos.contas.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setFiltros((f) => ({ ...normalizarFiltrosFluxo(f), contaId: c.id }))}
            className={cn(
              "kpi-balloon text-left transition-shadow hover:border-brand-symbol/40",
              contaId === c.id && "ring-2 ring-primary"
            )}
          >
            <p className="kpi-label">{c.nome}</p>
            <p className={`kpi-value mt-2 ${c.saldo >= 0 ? "text-foreground" : "text-[#A67B70]"}`}>
              {formatBRL(c.saldo)}
            </p>
          </button>
        ))}
      </div>

      <div className="card mb-6 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold tracking-tight">Projeção de fluxo de caixa</h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART.entradas }} /> Entradas
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: TERRACOTA }} /> Saídas
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded" style={{ background: CHART.saldo }} /> Saldo acumulado
            </span>
          </div>
        </div>
        <div className="relative h-80 w-full min-h-[20rem]">
          {chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {busca.trim()
                ? "Nenhum resultado para esta busca na projeção."
                : "Sem movimento no período para projetar."}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={320}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART.grid} />
                <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) =>
                    Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v))
                  }
                />
                <ReferenceLine y={0} stroke={CHART.grid} />
                <Tooltip
                  formatter={(v: number, name: string) => [
                    formatBRL(name === "Saídas" ? Math.abs(v) : v),
                    name,
                  ]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="entradas" name="Entradas" fill={CHART.entradas} radius={[4, 4, 0, 0]} legendType="none" />
                <Bar dataKey="saidasNeg" name="Saídas" fill={TERRACOTA} radius={[0, 0, 4, 4]} legendType="none" />
                <Line
                  type="monotone"
                  dataKey="saldoAcumulado"
                  name="Saldo acumulado"
                  stroke={CHART.saldo}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: CHART.saldo }}
                  legendType="none"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Extrato — estilo da imagem (antes do resumo mensal) */}
      <div className="card mb-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="font-display text-sm font-semibold tracking-tight">Extrato diário / lançamentos</h2>
          {lancamentosVisiveis.length > 10 && (
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => setExtratoAberto((v) => !v)}
            >
              {extratoAberto ? "Ver menos" : "Ver extrato completo"}
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">Descrição</th>
                <th className="px-4 py-2.5 font-semibold">CPF/CNPJ</th>
                <th className="px-4 py-2.5 font-semibold">Data</th>
                <th className="px-4 py-2.5 font-semibold">Conta</th>
                <th className="px-4 py-2.5 text-right font-semibold">Valor</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {extratoLinhas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    {busca.trim() ? "Nenhum resultado para esta busca." : "Sem lançamentos no período."}
                  </td>
                </tr>
              ) : (
                extratoLinhas.map((l) => {
                  const doc =
                    (l.parceiroId && documentoDe.porId.get(l.parceiroId)) ||
                    documentoDe.porNome.get(l.pessoa) ||
                    "—";
                  const st = statusExtrato(l.status, l.data);
                  return (
                    <tr key={`${l.tipo}-${l.id}`} className="border-b border-border/60 hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{l.pessoa}</td>
                      <td className="px-4 py-3 text-muted-foreground">{doc}</td>
                      <td className="px-4 py-3">{formatDate(l.data)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{l.contaNome}</td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right tabular-nums font-medium",
                          l.tipo === "entrada" ? "text-success" : "text-[#A67B70]"
                        )}
                      >
                        {l.tipo === "saida" ? "−" : ""}
                        {formatBRL(l.valor)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", st.className)}>
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resumo mensal — abaixo do Extrato */}
      <div className="card overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-display text-sm font-semibold tracking-tight">Resumo por mês</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">Mês</th>
                <th className="px-4 py-2.5 text-right font-semibold">Entradas</th>
                <th className="px-4 py-2.5 text-right font-semibold">Saídas</th>
                <th className="px-4 py-2.5 text-right font-semibold">Saldo do mês</th>
                <th className="px-4 py-2.5 text-right font-semibold">Saldo acumulado</th>
              </tr>
            </thead>
            <tbody>
              {fluxoVisivel.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    {busca.trim() ? "Nenhum resultado para esta busca." : "Sem movimento no período."}
                  </td>
                </tr>
              ) : (
                fluxoVisivel.map((b) => (
                  <tr key={b.mes} className="border-b border-border/60 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium capitalize">{b.label}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-success">{formatBRL(b.entradas)}</td>
                    <td className="px-4 py-3 text-right tabular-nums" style={{ color: TERRACOTA }}>
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
                        b.saldoAcumulado >= 0 ? "text-success" : "text-red-600"
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
      </div>
    </>
  );
}

function FluxoComAbas({ empresaId }: { empresaId: string }) {
  const [aba, setAba] = useState<AbaFluxo>("fluxo");

  return (
    <>
      <div className="mb-5 inline-flex flex-wrap gap-1 rounded-full bg-secondary p-1">
        {ABAS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              aba === item.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setAba(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className={aba === "fluxo" ? undefined : "hidden"}>
        <Inner empresaId={empresaId} />
      </div>
      {aba === "pagar" && <ContasPagarPainel empresaId={empresaId} />}
      {aba === "receber" && <ContasReceberPainel empresaId={empresaId} />}
    </>
  );
}

export function FluxoCaixaPage() {
  return <RequireEmpresa>{(id) => <FluxoComAbas empresaId={id} />}</RequireEmpresa>;
}
