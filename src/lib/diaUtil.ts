/** Feriados nacionais e ajuste de vencimento para dia útil. */
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";


export type AjusteDiaNaoUtil = "manter" | "antecipar" | "atrasar";

export const AJUSTE_DIA_NAO_UTIL_OPTS: { value: AjusteDiaNaoUtil; label: string }[] = [
  { value: "atrasar", label: "Atrasar para o próximo dia útil" },
  { value: "antecipar", label: "Antecipar para o dia útil anterior" },
  { value: "manter", label: "Manter a data" },
];

export interface ExtraFeriado {
  data: string;
  nome: string;
  repeteAnual: boolean;
}

export interface FeriadoNacional {
  data: string;
  nome: string;
}

function parseIso(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00`);
}

/** Dia da semana curto em pt-BR (seg, ter, …). */
export function diaSemanaCurto(iso: string): string {
  const d = parseIso(iso);
  if (Number.isNaN(d.getTime())) return "";
  return format(d, "EEE", { locale: ptBR }).replace(".", "");
}

function formatIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + n);
  return x;
}

/** Páscoa (algoritmo anônimo gregoriano). */
function pascoa(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function feriadosNacionais(year: number): FeriadoNacional[] {
  const easter = pascoa(year);
  return [
    { data: `${year}-01-01`, nome: "Confraternização Universal" },
    { data: formatIso(addDays(easter, -48)), nome: "Carnaval (segunda)" },
    { data: formatIso(addDays(easter, -47)), nome: "Carnaval" },
    { data: formatIso(addDays(easter, -2)), nome: "Sexta-feira Santa" },
    { data: `${year}-04-21`, nome: "Tiradentes" },
    { data: `${year}-05-01`, nome: "Dia do Trabalho" },
    { data: formatIso(addDays(easter, 60)), nome: "Corpus Christi" },
    { data: `${year}-09-07`, nome: "Independência do Brasil" },
    { data: `${year}-10-12`, nome: "Nossa Senhora Aparecida" },
    { data: `${year}-11-02`, nome: "Finados" },
    { data: `${year}-11-15`, nome: "Proclamação da República" },
    { data: `${year}-11-20`, nome: "Dia da Consciência Negra" },
    { data: `${year}-12-25`, nome: "Natal" },
  ];
}

function isFeriado(iso: string, extras: ExtraFeriado[]): boolean {
  const year = Number(iso.slice(0, 4));
  if (feriadosNacionais(year).some((f) => f.data === iso)) return true;
  const md = iso.slice(5, 10);
  return extras.some((e) => (e.repeteAnual ? e.data.slice(5, 10) === md : e.data === iso));
}

export function isDiaNaoUtil(iso: string, extras: ExtraFeriado[] = []): boolean {
  const d = parseIso(iso);
  if (Number.isNaN(d.getTime())) return false;
  const w = d.getDay();
  return w === 0 || w === 6 || isFeriado(iso, extras);
}

function proximoUtil(iso: string, extras: ExtraFeriado[], dir: 1 | -1): string {
  let d = parseIso(iso);
  for (let i = 0; i < 21; i++) {
    d = addDays(d, dir);
    const next = formatIso(d);
    if (!isDiaNaoUtil(next, extras)) return next;
  }
  return iso;
}

/** Soma meses preservando o dia; se o mês não tem esse dia, usa o último (fev/30/31). */
export function addMonthsClamped(iso: string, months: number): { iso: string; clamped: boolean } {
  const d = parseIso(iso);
  if (Number.isNaN(d.getTime())) return { iso, clamped: false };
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  const clamped = d.getDate() < day;
  if (clamped) d.setDate(0);
  return { iso: formatIso(d), clamped };
}

function isUltimoDiaDoMes(iso: string): boolean {
  const d = parseIso(iso);
  if (Number.isNaN(d.getTime())) return false;
  return addDays(d, 1).getMonth() !== d.getMonth();
}

export function ajustarDiaUtil(
  iso: string,
  ajuste: AjusteDiaNaoUtil,
  extras: ExtraFeriado[] = [],
  opts?: { ficarNoMes?: boolean }
): string {
  if (ajuste === "manter" || !isDiaNaoUtil(iso, extras)) return iso;
  const mes = iso.slice(0, 7);
  const dir: 1 | -1 = ajuste === "antecipar" ? -1 : 1;
  const out = proximoUtil(iso, extras, dir);
  const ficarNoMes = opts?.ficarNoMes ?? isUltimoDiaDoMes(iso);
  if (ficarNoMes && out.slice(0, 7) !== mes) {
    const other = proximoUtil(iso, extras, dir === 1 ? -1 : 1);
    if (other.slice(0, 7) === mes) return other;
    let d = parseIso(iso);
    const month = d.getMonth();
    while (d.getMonth() === month && isDiaNaoUtil(formatIso(d), extras)) {
      d = addDays(d, -1);
    }
    return formatIso(d);
  }
  return out;
}

/** Vencimento da parcela i (0 = primeira), com dia útil e sem sair do mês no estouro 30/31. */
export function vencimentoParcela(
  baseIso: string,
  months: number,
  ajuste: AjusteDiaNaoUtil,
  extras: ExtraFeriado[] = []
): string {
  const { iso, clamped } = addMonthsClamped(baseIso, months);
  return ajustarDiaUtil(iso, ajuste, extras, { ficarNoMes: clamped });
}

export function vencimentoOcorrencia(
  baseIso: string,
  indice: number,
  tipo: "semanal" | "quinzenal" | "mensal" | "semestral" | "anual" | "personalizada",
  dias: number | null,
  ajuste: AjusteDiaNaoUtil,
  extras: ExtraFeriado[] = []
): string {
  if (tipo === "mensal") return vencimentoParcela(baseIso, indice, ajuste, extras);
  if (tipo === "semestral") return vencimentoParcela(baseIso, indice * 6, ajuste, extras);
  if (tipo === "anual") return vencimentoParcela(baseIso, indice * 12, ajuste, extras);
  let iso = baseIso;
  const step =
    tipo === "semanal" ? 7 : tipo === "quinzenal" ? 15 : Math.max(1, Math.min(365, Math.floor(dias ?? 1)));
  for (let k = 0; k < indice; k++) {
    const d = parseIso(iso);
    d.setDate(d.getDate() + step);
    iso = formatIso(d);
  }
  return ajustarDiaUtil(iso, ajuste, extras);
}
