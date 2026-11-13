import type { CategoriaTipo } from "@/types/domain";

/** Layout do modelo de importação de categorias (IAFÉ). */

export const CATEGORIA_PLANILHA_HEADERS = [
  "Nome",
  "Grupo",
  "Tipo",
  "Situação",
  "Conta do DRE",
] as const;

const EXEMPLO: string[] = [
  "Aluguel",
  "Despesas Administrativas",
  "Despesa",
  "Ativa",
  "Despesas Administrativas",
];

export interface CategoriaPlanilhaPayload {
  nome: string;
  grupoNome: string | null;
  tipo: CategoriaTipo;
  ativo: boolean;
  contaDre: string | null;
}

export interface LinhaPlanilhaCategoria {
  linha: number;
  nome: string;
  payload: CategoriaPlanilhaPayload | null;
  erro?: string;
}

export interface ItemImportacaoCategoria {
  linha: number;
  nome: string;
  payload: CategoriaPlanilhaPayload;
}

export interface PreviewImportacaoCategoria {
  criar: ItemImportacaoCategoria[];
  duplicadas: { linha: number; nome: string }[];
  invalidas: { linha: number; motivo: string }[];
}

export interface ExistenteCategoria {
  nome: string;
  tipo: CategoriaTipo;
}

function semAcento(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function cellText(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function chaveCategoria(nome: string, tipo: CategoriaTipo): string {
  return `${tipo}:${semAcento(nome)}`;
}

function parseTipo(raw: string): CategoriaTipo | null {
  const n = semAcento(raw);
  if (n === "despesa" || n === "despesas") return "despesa";
  if (n === "receita" || n === "receitas") return "receita";
  return null;
}

function parseAtivo(raw: string): boolean {
  const n = semAcento(raw);
  if (!n) return true;
  return n !== "inativa" && n !== "inativo" && n !== "nao" && n !== "não";
}

function grupoNomeDe(raw: string): string | null {
  const t = raw.trim();
  if (!t || t === "—" || t === "-" || semAcento(t) === "sem grupo") return null;
  return t;
}

interface Colunas {
  nome: number;
  grupo: number;
  tipo: number;
  situacao: number;
  contaDre: number;
}

function idx(headers: string[], pred: (h: string) => boolean): number {
  return headers.findIndex((h) => pred(semAcento(h)));
}

function mapearColunas(headers: string[]): Colunas | null {
  const nome = idx(headers, (h) => h === "nome");
  const tipo = idx(headers, (h) => h === "tipo");
  if (nome < 0 || tipo < 0) return null;
  return {
    nome,
    grupo: idx(headers, (h) => h === "grupo"),
    tipo,
    situacao: idx(headers, (h) => h.includes("situacao")),
    contaDre: idx(headers, (h) => h.includes("conta") && h.includes("dre")),
  };
}

function at(row: unknown[], i: number): string {
  if (i < 0) return "";
  return cellText(row[i]);
}

/** Gera e dispara o download de `modelo-categorias.xlsx`. */
export async function baixarModeloCategorias(): Promise<void> {
  const XLSX = await import("xlsx");
  const aoa = [CATEGORIA_PLANILHA_HEADERS as unknown as string[], EXEMPLO];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 28 },
    { wch: 30 },
    { wch: 10 },
    { wch: 10 },
    { wch: 30 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Categorias");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo-categorias.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Lê a primeira aba no layout do modelo
 * (Nome, Grupo, Tipo, Situação, Conta do DRE).
 */
export async function lerPlanilhaCategorias(data: ArrayBuffer): Promise<LinhaPlanilhaCategoria[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(data, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("A planilha está vazia.");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
    header: 1,
    raw: false,
    defval: "",
  });

  let headerAt = -1;
  let cols: Colunas | null = null;
  const limite = Math.min(rows.length, 20);
  for (let i = 0; i < limite; i++) {
    const headers = (rows[i] ?? []).map(cellText);
    const mapped = mapearColunas(headers);
    if (mapped) {
      headerAt = i;
      cols = mapped;
      break;
    }
  }
  if (!cols || headerAt < 0) {
    throw new Error(
      "Não reconheci o cabeçalho. Use o modelo com as colunas Nome, Grupo, Tipo, Situação e Conta do DRE."
    );
  }

  const out: LinhaPlanilhaCategoria[] = [];
  for (let i = headerAt + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const nome = at(row, cols.nome);
    const tipoRaw = at(row, cols.tipo);
    const grupoRaw = at(row, cols.grupo);
    const situacao = at(row, cols.situacao);
    const contaDreRaw = at(row, cols.contaDre);
    if (!nome && !tipoRaw && !grupoRaw && !situacao && !contaDreRaw) continue;
    if (!nome) {
      out.push({ linha: i + 1, nome: "", payload: null, erro: "Sem nome." });
      continue;
    }
    const tipo = parseTipo(tipoRaw);
    if (!tipo) {
      out.push({
        linha: i + 1,
        nome,
        payload: null,
        erro: 'Tipo inválido (use "Despesa" ou "Receita").',
      });
      continue;
    }
    const contaDre = contaDreRaw.trim() || null;
    out.push({
      linha: i + 1,
      nome,
      payload: {
        nome,
        grupoNome: grupoNomeDe(grupoRaw),
        tipo,
        ativo: parseAtivo(situacao),
        contaDre,
      },
    });
  }
  return out;
}

/** Separa o que será criado e o que já existe (mesmo nome + tipo). */
export function montarPreviewCategorias(
  linhas: LinhaPlanilhaCategoria[],
  existentes: ExistenteCategoria[]
): PreviewImportacaoCategoria {
  const vistos = new Set(existentes.map((c) => chaveCategoria(c.nome, c.tipo)));
  const preview: PreviewImportacaoCategoria = {
    criar: [],
    duplicadas: [],
    invalidas: [],
  };

  for (const linha of linhas) {
    if (linha.erro || !linha.payload) {
      preview.invalidas.push({ linha: linha.linha, motivo: linha.erro ?? "Linha inválida." });
      continue;
    }
    const chave = chaveCategoria(linha.payload.nome, linha.payload.tipo);
    if (vistos.has(chave)) {
      preview.duplicadas.push({ linha: linha.linha, nome: linha.nome });
      continue;
    }
    vistos.add(chave);
    preview.criar.push({
      linha: linha.linha,
      nome: linha.nome,
      payload: { ...linha.payload },
    });
  }

  return preview;
}
