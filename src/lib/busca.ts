import { formatBRL, formatDate } from "@/lib/utils";

function semAcento(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function soDigitos(value: string): string {
  return value.replace(/\D/g, "");
}

/** Número digitado em pt-BR (`1.234,56`) ou com ponto decimal (`1234.56`). */
function lerNumero(termo: string): number | null {
  const limpo = termo.replace(/r\$\s*/gi, "").trim();
  if (!limpo) return null;
  if (limpo.includes(",")) {
    const n = Number(limpo.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) {
    const n = Number(limpo.replace(/\./g, ""));
    return Number.isFinite(n) ? n : null;
  }
  if (/^\d+(\.\d+)?$/.test(limpo)) {
    const n = Number(limpo);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function numeroCombina(termo: string, valor: number): boolean {
  const q = semAcento(termo.trim());
  if (!q) return false;
  if (semAcento(formatBRL(valor)).includes(q)) return true;
  const n = lerNumero(termo);
  if (n != null && Math.abs(n - valor) < 0.005) return true;
  const bruto = termo.replace(/[^\d,.-]/g, "");
  if (bruto.length < 2) return false;
  const fixo = valor.toFixed(2);
  const br = fixo.replace(".", ",");
  const comMilhar = formatBRL(valor).replace(/[^\d,.-]/g, "");
  return fixo.includes(bruto.replace(",", ".")) || br.includes(bruto) || comMilhar.includes(bruto);
}

/**
 * Acha o termo em qualquer parte: nome, documento (com ou sem pontuação),
 * valor em reais e data (`dd/mm/aaaa`, `mm/aaaa` ou `aaaa`).
 */
export function combinaBusca(
  termo: string,
  partes: Array<string | number | null | undefined>
): boolean {
  const q = termo.trim();
  if (!q) return true;
  const qNorm = semAcento(q);
  const qDig = soDigitos(q);

  for (const parte of partes) {
    if (parte == null || parte === "") continue;
    if (typeof parte === "number") {
      if (numeroCombina(q, parte)) return true;
      continue;
    }
    const texto = String(parte);
    if (semAcento(texto).includes(qNorm)) return true;
    if (qDig.length >= 2 && soDigitos(texto).includes(qDig)) return true;
  }
  return false;
}

/** Texto e valor de uma data ISO para a busca. */
export function partesData(iso: string | null | undefined): string[] {
  if (!iso) return [];
  return [iso, formatDate(iso)];
}

/** Texto e número de um valor em reais para a busca. */
export function partesValor(valor: number | null | undefined): Array<string | number> {
  if (valor == null || Number.isNaN(valor)) return [];
  return [valor, formatBRL(valor)];
}
