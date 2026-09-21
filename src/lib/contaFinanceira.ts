import type { ContaFinanceira } from "@/types/domain";

/**
 * Rótulo para selects e listagens (ex.: "Visa (Fatura) — Titular Ana").
 * Contas correntes: "Conta Movimento (conta)" (+ titular se houver).
 */
export function labelContaFinanceira(c: Pick<ContaFinanceira, "tipo" | "nome" | "bandeira" | "titular">): string {
  const titular = c.titular?.trim() ?? "";
  if (c.tipo === "cartao_credito") {
    const marca = (c.bandeira?.trim() || c.nome).trim() || "Cartão";
    const base =
      c.bandeira?.trim() && c.nome.trim() && c.nome.trim() !== c.bandeira.trim()
        ? `${c.nome.trim()} · ${marca} (Fatura)`
        : `${marca} (Fatura)`;
    return titular ? `${base} — Titular ${titular}` : base;
  }
  const base = `${c.nome} (conta)`;
  return titular ? `${base} — Titular ${titular}` : base;
}
