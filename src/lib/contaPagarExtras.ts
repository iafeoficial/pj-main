import type { ContaPagar, ImpostosRetidos, RecorrenciaTipo } from "@/types/domain";
import {
  vencimentoOcorrencia,
  vencimentoParcela,
  type AjusteDiaNaoUtil,
  type ExtraFeriado,
} from "@/lib/diaUtil";

/** Soma dos impostos marcados para reter. */
export function totalImpostosRetidos(impostos: ImpostosRetidos | null | undefined): number {
  if (!impostos) return 0;
  return Object.values(impostos).reduce((s, linha) => {
    if (!linha?.reter) return s;
    return s + (Number(linha.valor) || 0);
  }, 0);
}

/**
 * Valor devido do título: bruto − desconto + juros − impostos retidos.
 * Usado no saldo e na quitação (pagamento avulso / parcial).
 */
export function valorDevido(c: Pick<ContaPagar, "valor" | "desconto" | "juros" | "impostos">): number {
  const bruto = Number(c.valor) || 0;
  const desconto = Number(c.desconto) || 0;
  const juros = Number(c.juros) || 0;
  const retidos = totalImpostosRetidos(c.impostos);
  return Math.max(0, Number((bruto - desconto + juros - retidos).toFixed(2)));
}

/**
 * Avança uma data ISO (yyyy-MM-dd) conforme o tipo de recorrência.
 * Para `personalizada`, usa `dias` (mín. 1).
 */
export function avancarRecorrencia(
  iso: string,
  tipo: RecorrenciaTipo,
  dias?: number | null
): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  switch (tipo) {
    case "semanal":
      d.setDate(d.getDate() + 7);
      break;
    case "quinzenal":
      d.setDate(d.getDate() + 15);
      break;
    case "mensal":
      d.setMonth(d.getMonth() + 1);
      break;
    case "semestral":
      d.setMonth(d.getMonth() + 6);
      break;
    case "anual":
      d.setFullYear(d.getFullYear() + 1);
      break;
    case "personalizada":
      d.setDate(d.getDate() + Math.max(1, Math.min(365, Math.floor(dias ?? 1))));
      break;
  }
  return d.toISOString().slice(0, 10);
}

/** Soma N meses a uma data ISO, preservando o dia quando possível. */
export function addMonthsIso(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // Evita estouro de mês (ex.: 31 → fev): volta para o último dia do mês alvo.
  if (d.getDate() < day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}

/** Divide um valor em N parcelas (centavos no último título). */
export function splitParcelas(total: number, n: number): number[] {
  if (n <= 1) return [Number(total.toFixed(2))];
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  const vals: number[] = [];
  let allocated = 0;
  for (let i = 0; i < n - 1; i++) {
    vals.push(base / 100);
    allocated += base;
  }
  vals.push((cents - allocated) / 100);
  return vals;
}

export interface LinhaSimulacao {
  valor: number;
  dataVencimento: string;
  dataCompetencia: string;
}

/** Gera as linhas da simulação (parcelas ou repetição). Vazio se for um título só. */
export function montarSimulacao(input: {
  valor: number;
  dataVencimento: string;
  dataCompetencia: string;
  parcelas: number;
  recorrencia: RecorrenciaTipo | null;
  recorrenciaDias?: number | null;
  recorrenciaOcorrencias: number;
  ajuste: AjusteDiaNaoUtil;
  extras?: ExtraFeriado[];
  /** Default true: divide o total. False: cada linha fica com o valor cheio (conciliação). */
  dividirValor?: boolean;
}): LinhaSimulacao[] {
  const parcelas = Math.max(1, Math.floor(input.parcelas || 1));
  const ajuste = input.ajuste;
  const extras = input.extras ?? [];
  const valor = Number(input.valor) || 0;

  if (parcelas > 1) {
    const valores =
      input.dividirValor === false
        ? Array.from({ length: parcelas }, () => Number(valor.toFixed(2)))
        : splitParcelas(valor, parcelas);
    return valores.map((v, i) => ({
      valor: v,
      dataVencimento: vencimentoParcela(input.dataVencimento, i, ajuste, extras),
      dataCompetencia: addMonthsIso(input.dataCompetencia, i),
    }));
  }

  const rec = input.recorrencia;
  const n = rec ? Math.max(1, Math.floor(input.recorrenciaOcorrencias || 1)) : 1;
  if (rec && n > 1) {
    const dias =
      rec === "personalizada"
        ? Math.max(1, Math.min(365, Math.floor(input.recorrenciaDias ?? 1)))
        : null;
    const v = Number(valor.toFixed(2));
    return Array.from({ length: n }, (_, i) => ({
      valor: v,
      dataVencimento: vencimentoOcorrencia(input.dataVencimento, i, rec, dias, ajuste, extras),
      dataCompetencia: vencimentoOcorrencia(input.dataCompetencia, i, rec, dias, "manter"),
    }));
  }
  return [];
}

export const RECORRENCIA_OPTS: { value: RecorrenciaTipo; label: string }[] = [
  { value: "semanal", label: "Semanal" },
  { value: "quinzenal", label: "Quinzenal" },
  { value: "mensal", label: "Mensal" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
  { value: "personalizada", label: "Período específico" },
];

export const IMPOSTO_LABELS: Record<string, string> = {
  pis: "PIS",
  cofins: "COFINS",
  csll: "CSLL",
  ir: "IR",
  iss: "ISS",
  inss: "INSS",
};
