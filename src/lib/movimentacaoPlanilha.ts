export type LadoMovimento = "pagar" | "receber";
export type SituacaoImportada = "quitado" | "cancelado" | "aberto";

/** Uma linha da movimentação IAFÉ, já separada em pagar ou receber. */
export interface MovimentoPlanilha {
  linha: number;
  situacaoTexto: string;
  situacao: SituacaoImportada;
  data: string;
  pessoa: string;
  contaCorrente: string;
  instituicao: string;
  grupo: string;
  categoria: string;
  valor: number;
  lado: LadoMovimento;
  observacao: string;
}

export interface TituloExistenteChave {
  lado: LadoMovimento;
  data: string;
  pessoa: string;
  valor: number;
  conta: string;
  categoria: string;
}

export interface PreviewMovimentacao {
  criar: MovimentoPlanilha[];
  duplicadas: { linha: number; pessoa: string; lado: LadoMovimento; valor: number; data: string }[];
  invalidas: { linha: number; motivo: string }[];
  ignoradas: { linha: number; motivo: string }[];
}

const COLUNAS = [
  "Situação",
  "Data",
  "Cliente ou Fornecedor",
  "Conta Corrente",
  "Grupo",
  "Categoria",
  "Valor (R$)",
  "Observações",
] as const;

function semAcento(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return "";
  return String(value).trim();
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoDeDate(value: Date): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

/** Excel serial (dias desde 1899-12-30) para yyyy-MM-dd, em UTC para não voltar um dia. */
function isoDeSerial(serial: number): string | null {
  if (serial < 20000 || serial > 80000) return null;
  const utc = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000);
  if (Number.isNaN(utc.getTime())) return null;
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
}

export function parseDataMovimento(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return isoDeDate(value);
  if (typeof value === "number" && Number.isFinite(value)) return isoDeSerial(value);
  if (typeof value !== "string") return null;
  const t = value.trim();
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${pad(Number(br[2]))}-${pad(Number(br[1]))}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  return null;
}

export function parseValorMovimento(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  let s = value.trim().replace(/R\$\s?/gi, "").replace(/\s/g, "");
  if (!s) return null;
  const neg = s.startsWith("-") || (s.startsWith("(") && s.endsWith(")"));
  s = s.replace(/[()]/g, "").replace(/^-/, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -Math.abs(n) : n;
}

/** Quitado, cancelado ou em aberto. O texto original continua na observação. */
export function classificarSituacao(texto: string): SituacaoImportada {
  const n = semAcento(texto);
  if (!n || n.includes("parcial") || n.includes("aberto") || n.includes("pendente")) return "aberto";
  if (n.includes("a pagar") || n.includes("a receber")) return "aberto";
  if (n.includes("cancel")) return "cancelado";
  if (/pag|receb|quit|liquid|baix|concili/.test(n)) return "quitado";
  return "aberto";
}

export function chaveMovimento(item: {
  lado: LadoMovimento;
  data: string;
  pessoa: string;
  valor: number;
  conta: string;
  categoria: string;
}): string {
  return [
    item.lado,
    item.data.slice(0, 10),
    semAcento(item.pessoa),
    item.valor.toFixed(2),
    semAcento(item.conta),
    semAcento(item.categoria),
  ].join("|");
}

interface ColunasMov {
  situacao: number;
  data: number;
  pessoa: number;
  conta: number;
  grupo: number;
  categoria: number;
  valor: number;
  observacao: number;
}

function mapearColunas(headers: string[]): ColunasMov | null {
  const n = headers.map(semAcento);
  const idx = (pred: (h: string) => boolean) => n.findIndex(pred);
  const cols: ColunasMov = {
    situacao: idx((h) => h === "situacao"),
    data: idx((h) => h === "data"),
    pessoa: idx((h) => h.includes("cliente") && h.includes("fornecedor")),
    conta: idx((h) => h.includes("conta corrente")),
    grupo: idx((h) => h === "grupo"),
    categoria: idx((h) => h === "categoria"),
    valor: idx((h) => h.includes("valor")),
    observacao: idx((h) => h.includes("observ")),
  };
  if (Object.values(cols).some((i) => i < 0)) return null;
  return cols;
}

function at(row: unknown[], i: number): unknown {
  return row[i];
}

/**
 * Lê a aba de movimentação no layout IAFÉ (as oito colunas do modelo).
 * Banco e nome da conta nas linhas anteriores ao cabeçalho servem de padrão
 * quando a coluna Conta Corrente vier vazia.
 */
export async function lerMovimentacao(data: ArrayBuffer): Promise<MovimentoPlanilha[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("A planilha está vazia.");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
    header: 1,
    raw: true,
    defval: "",
  });

  let headerAt = -1;
  let cols: ColunasMov | null = null;
  const limite = Math.min(rows.length, 30);
  for (let i = 0; i < limite; i++) {
    const headers = (rows[i] ?? []).map((c) => cellText(c));
    const mapped = mapearColunas(headers);
    if (mapped) {
      headerAt = i;
      cols = mapped;
      break;
    }
  }
  if (!cols || headerAt < 0) {
    throw new Error(
      `Não reconheci o cabeçalho. A planilha precisa das colunas: ${COLUNAS.join(", ")}.`
    );
  }

  const rotulos: string[] = [];
  for (let i = 0; i < headerAt; i++) {
    const texto = cellText((rows[i] ?? [])[0]);
    if (!texto) continue;
    if (semAcento(texto).includes("financ")) continue;
    rotulos.push(texto);
  }
  const instituicaoPadrao = rotulos[0] ?? "";
  const contaPadrao = rotulos[1] ?? rotulos[0] ?? "";

  const out: MovimentoPlanilha[] = [];
  for (let i = headerAt + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const situacaoTexto = cellText(at(row, cols.situacao));
    const pessoa = cellText(at(row, cols.pessoa));
    const dataRaw = at(row, cols.data);
    const valorRaw = at(row, cols.valor);
    const dataTexto = cellText(dataRaw);
    const valorTexto = cellText(valorRaw);
    const vazio =
      !situacaoTexto &&
      !pessoa &&
      !dataTexto &&
      !(dataRaw instanceof Date) &&
      valorRaw !== 0 &&
      !valorTexto;
    if (vazio) continue;
    if (semAcento(situacaoTexto) === "total") continue;

    const data = parseDataMovimento(dataRaw);
    const valorAssinado = parseValorMovimento(valorRaw);
    const contaCelula = cellText(at(row, cols.conta));
    const grupo = cellText(at(row, cols.grupo));
    const categoria = cellText(at(row, cols.categoria));
    const notas = cellText(at(row, cols.observacao));
    const observacao = [situacaoTexto ? `Situação: ${situacaoTexto}` : "", notas].filter(Boolean).join("\n");

    if (valorAssinado == null) {
      out.push(invalido(i + 1, pessoa, "Valor inválido."));
      continue;
    }
    if (Math.abs(valorAssinado) < 0.005) {
      out.push(ignorado(i + 1, pessoa, "Valor zero."));
      continue;
    }
    if (!data) {
      out.push(invalido(i + 1, pessoa, "Sem data."));
      continue;
    }
    if (!pessoa) {
      out.push(invalido(i + 1, pessoa, "Sem cliente ou fornecedor."));
      continue;
    }

    const lado: LadoMovimento = valorAssinado < 0 ? "pagar" : "receber";
    out.push({
      linha: i + 1,
      situacaoTexto,
      situacao: classificarSituacao(situacaoTexto),
      data,
      pessoa,
      contaCorrente: contaCelula || contaPadrao,
      instituicao: instituicaoPadrao,
      grupo,
      categoria,
      valor: Math.abs(Number(valorAssinado.toFixed(2))),
      lado,
      observacao,
    });
  }
  return out;
}

function invalido(linha: number, pessoa: string, motivo: string): MovimentoPlanilha {
  return {
    linha,
    situacaoTexto: "",
    situacao: "aberto",
    data: "",
    pessoa,
    contaCorrente: "",
    instituicao: "",
    grupo: "",
    categoria: "",
    valor: 0,
    lado: "pagar",
    observacao: `invalid:${motivo}`,
  };
}

function ignorado(linha: number, pessoa: string, motivo: string): MovimentoPlanilha {
  return {
    linha,
    situacaoTexto: "",
    situacao: "aberto",
    data: "",
    pessoa,
    contaCorrente: "",
    instituicao: "",
    grupo: "",
    categoria: "",
    valor: 0,
    lado: "pagar",
    observacao: `ignorado:${motivo}`,
  };
}

export function montarPreviewMovimentacao(
  linhas: MovimentoPlanilha[],
  existentes: TituloExistenteChave[]
): PreviewMovimentacao {
  const vistos = new Set(existentes.map((e) => chaveMovimento(e)));
  const preview: PreviewMovimentacao = { criar: [], duplicadas: [], invalidas: [], ignoradas: [] };

  for (const linha of linhas) {
    if (linha.observacao.startsWith("invalid:")) {
      preview.invalidas.push({ linha: linha.linha, motivo: linha.observacao.slice("invalid:".length) });
      continue;
    }
    if (linha.observacao.startsWith("ignorado:")) {
      preview.ignoradas.push({
        linha: linha.linha,
        motivo: linha.pessoa
          ? `${linha.pessoa}: ${linha.observacao.slice("ignorado:".length)}`
          : linha.observacao.slice("ignorado:".length),
      });
      continue;
    }
    const chave = chaveMovimento({
      lado: linha.lado,
      data: linha.data,
      pessoa: linha.pessoa,
      valor: linha.valor,
      conta: linha.contaCorrente,
      categoria: linha.categoria,
    });
    if (vistos.has(chave)) {
      preview.duplicadas.push({
        linha: linha.linha,
        pessoa: linha.pessoa,
        lado: linha.lado,
        valor: linha.valor,
        data: linha.data,
      });
      continue;
    }
    vistos.add(chave);
    preview.criar.push(linha);
  }
  return preview;
}
