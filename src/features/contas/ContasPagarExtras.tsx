import { useEffect } from "react";
import type { ImpostosRetidos, ImpostoRetido, RecorrenciaTipo } from "@/types/domain";
import type { AjusteDiaNaoUtil, ExtraFeriado } from "@/lib/diaUtil";
import { AJUSTE_DIA_NAO_UTIL_OPTS, diaSemanaCurto } from "@/lib/diaUtil";
import { IMPOSTOS_RETIDOS } from "@/types/domain";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { formatBRL, formatDate } from "@/lib/utils";
import {
  IMPOSTO_LABELS,
  RECORRENCIA_OPTS,
  montarSimulacao,
  totalImpostosRetidos,
  type LinhaSimulacao,
} from "@/lib/contaPagarExtras";

export function emptyImpostos(): ImpostosRetidos {
  const out: ImpostosRetidos = {};
  for (const k of IMPOSTOS_RETIDOS) {
    out[k] = { reter: false, valor: 0 };
  }
  return out;
}

export function ImpostosFields({
  value,
  onChange,
}: {
  value: ImpostosRetidos | null;
  onChange: (v: ImpostosRetidos) => void;
}) {
  const impostos = value ?? emptyImpostos();
  const total = totalImpostosRetidos(impostos);

  function patch(key: ImpostoRetido, partial: Partial<{ reter: boolean; valor: number }>) {
    onChange({
      ...impostos,
      [key]: { reter: impostos[key]?.reter ?? false, valor: impostos[key]?.valor ?? 0, ...partial },
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Marque &quot;Reter&quot; e informe o valor. Impostos retidos reduzem o valor devido na baixa.
      </p>
      <div className="space-y-2">
        {IMPOSTOS_RETIDOS.map((key) => {
          const linha = impostos[key] ?? { reter: false, valor: 0 };
          return (
            <div key={key} className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2">
              <label className="flex w-28 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="rounded border-border"
                  checked={linha.reter}
                  onChange={(e) => patch(key, { reter: e.target.checked })}
                />
                {IMPOSTO_LABELS[key]}
              </label>
              <input
                className="input h-9 w-32"
                type="number"
                min="0"
                step="0.01"
                disabled={!linha.reter}
                value={linha.reter ? linha.valor || "" : ""}
                placeholder="0,00"
                onChange={(e) => patch(key, { valor: Number(e.target.value) || 0 })}
              />
            </div>
          );
        })}
      </div>
      {total > 0 && (
        <p className="text-sm text-muted-foreground">
          Total a reter: <span className="font-medium text-foreground">{formatBRL(total)}</span>
        </p>
      )}
    </div>
  );
}

export function ParcelasRepeticaoFields({
  parcelas,
  recorrencia,
  recorrenciaDias,
  recorrenciaOcorrencias,
  ajusteDiaNaoUtil,
  editing,
  valor,
  dataVencimento,
  dataCompetencia,
  feriados = [],
  simulacao = [],
  dividirValor = true,
  onChange,
}: {
  parcelas: number;
  recorrencia: RecorrenciaTipo | null;
  recorrenciaDias: number;
  recorrenciaOcorrencias: number;
  ajusteDiaNaoUtil: AjusteDiaNaoUtil;
  editing: boolean;
  valor: number;
  dataVencimento: string;
  dataCompetencia: string;
  feriados?: ExtraFeriado[];
  simulacao?: LinhaSimulacao[];
  /** False na conciliação: o valor do extrato se repete em cada título. */
  dividirValor?: boolean;
  onChange: (partial: {
    parcelas?: number;
    recorrencia?: RecorrenciaTipo | null;
    recorrenciaDias?: number;
    recorrenciaOcorrencias?: number;
    ajusteDiaNaoUtil?: AjusteDiaNaoUtil;
    simulacao?: LinhaSimulacao[];
  }) => void;
}) {
  const extrasKey = feriados.map((e) => `${e.data}:${e.repeteAnual ? 1 : 0}`).join(",");

  useEffect(() => {
    if (editing) return;
    onChange({
      simulacao: montarSimulacao({
        valor,
        dataVencimento,
        dataCompetencia,
        parcelas,
        recorrencia,
        recorrenciaDias,
        recorrenciaOcorrencias,
        ajuste: ajusteDiaNaoUtil,
        extras: feriados,
        dividirValor,
      }),
    });
    // Recalcula só quando a regra muda — edits manuais nas linhas não entram aqui.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    editing,
    valor,
    dataVencimento,
    dataCompetencia,
    parcelas,
    recorrencia,
    recorrenciaDias,
    recorrenciaOcorrencias,
    ajusteDiaNaoUtil,
    extrasKey,
    dividirValor,
  ]);

  if (editing) {
    return (
      <p className="text-sm text-muted-foreground">
        Parcelamento e repetição só podem ser definidos na criação do lançamento.
      </p>
    );
  }

  const temParcelas = parcelas > 1;
  const temRecorrencia = !!recorrencia;
  const personalizada = recorrencia === "personalizada";
  const soma = simulacao.reduce((s, l) => s + (Number(l.valor) || 0), 0);
  const esperado = temParcelas
    ? dividirValor
      ? Number(valor) || 0
      : (Number(valor) || 0) * parcelas
    : temRecorrencia
      ? (Number(valor) || 0) * Math.max(1, recorrenciaOcorrencias)
      : Number(valor) || 0;
  const somaDifere = simulacao.length > 0 && Math.abs(soma - esperado) > 0.009;

  function patchLinha(i: number, partial: Partial<LinhaSimulacao>) {
    onChange({
      simulacao: simulacao.map((l, idx) => (idx === i ? { ...l, ...partial } : l)),
    });
  }

  return (
    <div className="space-y-4">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field
        label="Parcelas"
        hint={temRecorrencia ? "Desative a repetição para parcelar." : "Gera N títulos mensais."}
      >
        <input
          className="input"
          type="number"
          min="1"
          max="60"
          disabled={temRecorrencia}
          value={parcelas || 1}
          onChange={(e) => {
            const n = Math.max(1, Math.min(60, Math.floor(Number(e.target.value) || 1)));
            onChange({
              parcelas: n,
              ...(n > 1 ? { recorrencia: null, recorrenciaDias: 30 } : {}),
            });
          }}
        />
      </Field>
      <Field
        label="Repetição"
        hint={temParcelas ? "Desative o parcelamento para repetir." : "Gera títulos futuros."}
      >
        <Select
          value={recorrencia ?? ""}
          onChange={(v) => {
            const next = (v || null) as RecorrenciaTipo | null;
            onChange({
              recorrencia: next,
              ...(v ? { parcelas: 1 } : {}),
              ...(next === "personalizada" ? { recorrenciaDias: recorrenciaDias || 30 } : {}),
              ...(next && next !== "personalizada" ? { recorrenciaDias: 30 } : {}),
              ...(!next ? { recorrenciaDias: 30 } : {}),
            });
          }}
          options={[
            { value: "", label: "— sem repetição —" },
            ...RECORRENCIA_OPTS.map((o) => ({ value: o.value, label: o.label })),
          ]}
          disabled={temParcelas}
        />
      </Field>
      {personalizada && (
        <Field
          label="A cada (dias)"
          hint="Ex.: 12, 20, 45 — intervalo entre cada título."
          required
        >
          <div className="flex items-center gap-2">
            <input
              className="input"
              type="number"
              min="1"
              max="365"
              value={recorrenciaDias || 30}
              onChange={(e) =>
                onChange({
                  recorrenciaDias: Math.max(
                    1,
                    Math.min(365, Math.floor(Number(e.target.value) || 1))
                  ),
                })
              }
            />
            <span className="shrink-0 text-sm text-muted-foreground">dias</span>
          </div>
        </Field>
      )}
      {temRecorrencia && (
        <Field label="Ocorrências" hint="Inclui o lançamento atual.">
          <input
            className="input"
            type="number"
            min="1"
            max="36"
            value={recorrenciaOcorrencias || 1}
            onChange={(e) =>
              onChange({
                recorrenciaOcorrencias: Math.max(1, Math.min(36, Math.floor(Number(e.target.value) || 1))),
              })
            }
          />
        </Field>
      )}
      <Field
        label="Se cair em sábado, domingo ou feriado"
        hint="Fevereiro e meses sem dia 31 ficam no último dia do mês; o ajuste não sai desse mês."
        className="sm:col-span-2"
      >
        <Select
          value={ajusteDiaNaoUtil}
          onChange={(v) => onChange({ ajusteDiaNaoUtil: (v as AjusteDiaNaoUtil) || "atrasar" })}
          options={AJUSTE_DIA_NAO_UTIL_OPTS.map((o) => ({ value: o.value, label: o.label }))}
        />
      </Field>
    </div>

      {simulacao.length > 0 && (
        <div className="card max-h-72 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Parcela</th>
                <th className="px-3 py-2 font-medium">Valor</th>
                <th className="px-3 py-2 font-medium">Vencimento</th>
                <th className="px-3 py-2 font-medium">Dia</th>
                <th className="px-3 py-2 font-medium">Competência</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {simulacao.map((l, i) => (
                <tr key={`${l.dataCompetencia}-${i}`}>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                    {i + 1}/{simulacao.length}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="input h-8 w-28"
                      type="number"
                      min="0"
                      step="0.01"
                      value={l.valor || ""}
                      onChange={(e) => patchLinha(i, { valor: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <DatePicker
                      value={l.dataVencimento}
                      onChange={(v) => patchLinha(i, { dataVencimento: v })}
                      className="w-36"
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 capitalize text-muted-foreground">
                    {diaSemanaCurto(l.dataVencimento)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {formatDate(l.dataCompetencia)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-border px-3 py-2 text-xs">
            Soma: <span className="font-medium tabular-nums">{formatBRL(soma)}</span>
            {dividirValor && temParcelas && (
              <span className="text-muted-foreground"> · total do lançamento {formatBRL(esperado)}</span>
            )}
            {somaDifere && (
              <p className="mt-1 text-amber-700">
                A soma das linhas ({formatBRL(soma)}) não fecha com o esperado ({formatBRL(esperado)}).
                Você pode ajustar os valores ou salvar assim mesmo.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function HistoricoPagamentos({
  items,
}: {
  items: { id: string; data: string; valor: number; observacao: string }[];
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum pagamento registrado ainda.</p>;
  }
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Data</th>
            <th className="px-3 py-2 text-right font-medium">Valor</th>
            <th className="px-3 py-2 font-medium">Obs.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((p) => (
            <tr key={p.id}>
              <td className="px-3 py-2">{formatDate(p.data)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatBRL(p.valor)}</td>
              <td className="px-3 py-2 text-muted-foreground">{p.observacao || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
