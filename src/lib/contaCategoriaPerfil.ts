import type { Categoria, CategoriaTipo } from "@/types/domain";

export type PerfilLancamento =
  | "fornecedor"
  | "folha"
  | "imposto"
  | "tarifa"
  | "cliente"
  | "generico";

function normalizeNome(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function containsAny(nome: string, terms: string[]): boolean {
  return terms.some((t) => nome.includes(t));
}

/** Infere o perfil de lançamento pelo nome da categoria (sem migration). */
export function getPerfilLancamento(
  categoria: Categoria | null,
  categoriaTipo: CategoriaTipo
): PerfilLancamento {
  if (!categoria) return "generico";

  const nome = normalizeNome(categoria.nome);

  if (categoriaTipo === "receita") {
    if (containsAny(nome, ["servico", "produto", "venda"])) return "cliente";
    return "generico";
  }

  if (containsAny(nome, ["folha", "salario"])) return "folha";
  if (containsAny(nome, ["imposto", "tributo", "das", "fgts"])) return "imposto";
  if (containsAny(nome, ["tarifa", "bancaria", "banco"])) return "tarifa";
  if (nome.includes("fornecedor")) return "fornecedor";
  return "generico";
}

/** Label do campo pessoa conforme perfil e tipo de conta. */
export function getPessoaLabel(perfil: PerfilLancamento, categoriaTipo: CategoriaTipo): string {
  switch (perfil) {
    case "fornecedor":
      return "Fornecedor";
    case "folha":
      return "Referência";
    case "imposto":
      return "Órgão / Guia";
    case "cliente":
      return "Cliente";
    case "generico":
      return categoriaTipo === "receita" ? "Pagador" : "Favorecido";
    default:
      return categoriaTipo === "receita" ? "Pagador" : "Favorecido";
  }
}

export function pessoaRequired(perfil: PerfilLancamento): boolean {
  return perfil === "folha" || perfil === "imposto" || perfil === "fornecedor" || perfil === "cliente";
}

export function showVincularCadastro(perfil: PerfilLancamento): boolean {
  // Genérico (Favorecido/Pagador) também usa o dropdown unificado cliente+fornecedor.
  return perfil === "fornecedor" || perfil === "cliente" || perfil === "generico";
}

export function hidePessoaField(perfil: PerfilLancamento): boolean {
  return perfil === "tarifa";
}

/** Valor padrão gravado em `pessoa` quando o campo fica oculto (tarifa). */
export function getDefaultPessoa(
  perfil: PerfilLancamento,
  form?: { observacao?: string }
): string {
  if (perfil !== "tarifa") return "";
  const obs = form?.observacao?.trim();
  return obs || "Tarifa bancária";
}

export function getPessoaPlaceholder(perfil: PerfilLancamento): string {
  switch (perfil) {
    case "folha":
      return "Folha 03/2026";
    case "imposto":
      return "Receita Federal — DAS";
    case "fornecedor":
      return "Nome do fornecedor";
    case "cliente":
      return "Nome do cliente";
    case "generico":
      return "Nome (opcional)";
    default:
      return "";
  }
}

/** Valida o campo pessoa conforme o perfil; retorna erros parciais. */
export function validateByPerfil(
  perfil: PerfilLancamento,
  form: { pessoa: string },
  categoriaTipo: CategoriaTipo
): Record<string, string> {
  const err: Record<string, string> = {};
  if (hidePessoaField(perfil)) return err;
  if (pessoaRequired(perfil) && !form.pessoa.trim()) {
    const label = getPessoaLabel(perfil, categoriaTipo).toLowerCase();
    const artigo = label === "referência" ? "a" : "o";
    err.pessoa = `Informe ${artigo} ${label}.`;
  }
  return err;
}
