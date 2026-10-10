import type { TipoPessoa } from "@/types/domain";
import { formatCEP, formatCpfCnpj, stripDigits } from "@/lib/masks";
import { normalizeCNPJ } from "@/lib/utils";

export type DestinoParceiro = "cliente" | "fornecedor";

/** Payload alinhado ao cadastro de cliente/fornecedor (sem id nem empresa). */
export interface ParceiroPlanilhaPayload {
  tipoPessoa: TipoPessoa;
  nome: string;
  nomeFantasia: string;
  cnpjCpf: string;
  ativo: boolean;
  contatoNome: string;
  telefone: string;
  email: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  observacao: string;
}

export interface LinhaPlanilhaParceiro {
  linha: number;
  nome: string;
  destinos: DestinoParceiro[];
  payload: ParceiroPlanilhaPayload | null;
  erro?: string;
}

export interface ItemImportacaoParceiro {
  linha: number;
  destino: DestinoParceiro;
  nome: string;
  payload: ParceiroPlanilhaPayload;
}

export interface PreviewImportacaoParceiro {
  criar: ItemImportacaoParceiro[];
  semTag: { linha: number; nome: string }[];
  duplicadas: { linha: number; nome: string; destino: DestinoParceiro }[];
  invalidas: { linha: number; motivo: string }[];
}

export interface ExistentesParceiro {
  cnpjCpf: string;
  nome: string;
}

function semAcento(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** Chave de duplicata: documento (CPF 11 / CNPJ 14) ou, sem documento, o nome. */
export function chaveParceiro(cnpjCpf: string, nome: string): string {
  const alnum = normalizeCNPJ(cnpjCpf);
  const digits = stripDigits(cnpjCpf);
  if (digits.length === 11 || alnum.length === 14) return `doc:${alnum}`;
  return `nome:${semAcento(nome)}`;
}

function cellText(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function destinosDasTags(tags: string): DestinoParceiro[] {
  const n = semAcento(tags);
  const out: DestinoParceiro[] = [];
  if (n.includes("fornecedor")) out.push("fornecedor");
  if (n.includes("cliente")) out.push("cliente");
  return out;
}

function tipoPessoaDeDocumento(doc: string): TipoPessoa {
  const alnum = normalizeCNPJ(doc);
  const digits = stripDigits(doc);
  if (digits.length === 11 && alnum.length === 11) return "pf";
  return "pj";
}

function cidadeSemUf(cidade: string): string {
  return cidade.replace(/\s*\([A-Za-z]{2}\)\s*$/, "").trim();
}

function ufDe(estado: string, cidade: string): string {
  const letters = estado.toUpperCase().replace(/[^A-Z]/g, "");
  if (letters.length >= 2) return letters.slice(0, 2);
  const m = cidade.match(/\(([A-Za-z]{2})\)\s*$/);
  return m ? m[1].toUpperCase() : "";
}

interface Colunas {
  situacao: number;
  tags: number;
  documento: number;
  nome: number;
  fantasia: number;
  telefone: number;
  contato: number;
  email: number;
  cidade: number;
  estado: number;
  endereco: number;
  bairro: number;
  cep: number;
  atividade: number;
}

function idx(headers: string[], pred: (h: string) => boolean): number {
  return headers.findIndex((h) => pred(semAcento(h)));
}

function mapearColunas(headers: string[]): Colunas | null {
  const documento = idx(headers, (h) => h.includes("cnpj"));
  const nome = idx(headers, (h) => h.includes("razao social"));
  const tags = idx(headers, (h) => h === "tags");
  if (documento < 0 || nome < 0 || tags < 0) return null;

  const emails = headers
    .map((h, i) => ({ h: semAcento(h), i }))
    .filter((x) => x.h.includes("e-mail") || x.h.includes("email"));
  const email =
    emails.find((x) => !x.h.includes("nfe") && !x.h.includes("boleto"))?.i ?? emails[0]?.i ?? -1;

  return {
    situacao: idx(headers, (h) => h.includes("situacao")),
    tags,
    documento,
    nome,
    fantasia: idx(headers, (h) => h.includes("fantasia")),
    telefone: idx(headers, (h) => h === "telefone" || h.startsWith("telefone ")),
    contato: idx(headers, (h) => h === "contato"),
    email,
    cidade: idx(headers, (h) => h === "cidade"),
    estado: idx(headers, (h) => h === "estado"),
    endereco: idx(headers, (h) => h.includes("endereco")),
    bairro: idx(headers, (h) => h === "bairro"),
    cep: idx(headers, (h) => h === "cep"),
    atividade: idx(headers, (h) => h.includes("atividade")),
  };
}

function at(row: unknown[], i: number): string {
  if (i < 0) return "";
  return cellText(row[i]);
}

function linhaParaPayload(row: unknown[], cols: Colunas): ParceiroPlanilhaPayload {
  const doc = at(row, cols.documento);
  const cidadeRaw = at(row, cols.cidade);
  const atividade = at(row, cols.atividade);
  const cep = at(row, cols.cep);
  return {
    tipoPessoa: tipoPessoaDeDocumento(doc),
    nome: at(row, cols.nome),
    nomeFantasia: at(row, cols.fantasia),
    cnpjCpf: doc ? formatCpfCnpj(doc) : "",
    ativo: semAcento(at(row, cols.situacao)) !== "inativo",
    contatoNome: at(row, cols.contato),
    telefone: at(row, cols.telefone),
    email: at(row, cols.email),
    cep: cep ? formatCEP(cep) : "",
    logradouro: at(row, cols.endereco),
    numero: "",
    complemento: "",
    bairro: at(row, cols.bairro),
    cidade: cidadeSemUf(cidadeRaw),
    uf: ufDe(at(row, cols.estado), cidadeRaw),
    observacao: atividade,
  };
}

/**
 * Lê a primeira aba de um .xlsx no formato do export IAFÉ
 * (cabeçalho com CNPJ/CPF, Razão Social e Tags).
 */
export async function lerPlanilhaParceiros(data: ArrayBuffer): Promise<LinhaPlanilhaParceiro[]> {
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
      "Não reconheci o cabeçalho. Use o export com as colunas Tags, CNPJ / CPF e Razão Social / Nome Completo."
    );
  }

  const out: LinhaPlanilhaParceiro[] = [];
  for (let i = headerAt + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const nome = at(row, cols.nome);
    const tags = at(row, cols.tags);
    const doc = at(row, cols.documento);
    if (!nome && !tags && !doc) continue;
    if (!nome) {
      out.push({ linha: i + 1, nome: "", destinos: [], payload: null, erro: "Sem nome." });
      continue;
    }
    const destinos = destinosDasTags(tags);
    out.push({
      linha: i + 1,
      nome,
      destinos,
      payload: linhaParaPayload(row, cols),
    });
  }
  return out;
}

/** Separa o que será criado, o que não tem tag e o que já existe na empresa. */
export function montarPreviewImportacao(
  linhas: LinhaPlanilhaParceiro[],
  existentes: { clientes: ExistentesParceiro[]; fornecedores: ExistentesParceiro[] }
): PreviewImportacaoParceiro {
  const vistos: Record<DestinoParceiro, Set<string>> = {
    cliente: new Set(existentes.clientes.map((c) => chaveParceiro(c.cnpjCpf, c.nome))),
    fornecedor: new Set(existentes.fornecedores.map((f) => chaveParceiro(f.cnpjCpf, f.nome))),
  };

  const preview: PreviewImportacaoParceiro = {
    criar: [],
    semTag: [],
    duplicadas: [],
    invalidas: [],
  };

  for (const linha of linhas) {
    if (linha.erro || !linha.payload) {
      preview.invalidas.push({ linha: linha.linha, motivo: linha.erro ?? "Linha inválida." });
      continue;
    }
    if (linha.destinos.length === 0) {
      preview.semTag.push({ linha: linha.linha, nome: linha.nome });
      continue;
    }
    const chave = chaveParceiro(linha.payload.cnpjCpf, linha.payload.nome);
    for (const destino of linha.destinos) {
      if (vistos[destino].has(chave)) {
        preview.duplicadas.push({ linha: linha.linha, nome: linha.nome, destino });
        continue;
      }
      vistos[destino].add(chave);
      preview.criar.push({
        linha: linha.linha,
        destino,
        nome: linha.nome,
        payload: { ...linha.payload },
      });
    }
  }

  return preview;
}
