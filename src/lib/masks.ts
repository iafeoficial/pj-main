import { formatCNPJ } from "@/lib/utils";

/** Remove tudo que não for dígito. */
export function stripDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Máscara de CPF: 000.000.000-00 */
export function formatCPF(value: string): string {
  const d = stripDigits(value).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

/** CPF (até 11 dígitos) ou CNPJ (12–14 dígitos). */
export function formatCpfCnpj(value: string): string {
  const d = stripDigits(value);
  if (d.length <= 11) return formatCPF(value);
  return formatCNPJ(value);
}

/** Máscara de CEP: 00000-000 */
export function formatCEP(value: string): string {
  const d = stripDigits(value).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/** Placeholder padrão para celular BR: (DD) 9 XXXX-XXXX. */
export const TELEFONE_PLACEHOLDER = "(00) 9 0000-0000";

/**
 * Celular BR: (DD) 9 XXXX-XXXX — 11 dígitos (DDD + 9 fixo + 8).
 * O 9 após o DDD é inserido automaticamente e não pode ser alterado.
 */
export function formatTelefone(value: string): string {
  const raw = stripDigits(value).slice(0, 11);
  if (raw.length === 0) return "";
  if (raw.length <= 2) return raw.length === 2 ? `(${raw})` : `(${raw}`;

  const ddd = raw.slice(0, 2);
  const tail = raw.slice(2);
  const afterNine = tail.startsWith("9") ? tail.slice(1, 9) : tail.slice(0, 8);

  if (afterNine.length === 0) return `(${ddd}) 9`;
  if (afterNine.length <= 4) return `(${ddd}) 9 ${afterNine}`;
  return `(${ddd}) 9 ${afterNine.slice(0, 4)}-${afterNine.slice(4)}`;
}
