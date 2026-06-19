// Parser determinístico da linha digitável de boleto bancário (47 dígitos, FEBRABAN).
// Extrai valor e vencimento. Boletos de arrecadação (48 dígitos, início "8") não suportados aqui.

export interface BoletoResultado {
  linhaDigitavel: string;
  banco: string;
  valor: number;
  vencimento: string | null; // yyyy-MM-dd
}

/** Extrai uma sequência de 47 dígitos de um texto (útil para OCR). */
export function extrairLinhaDigitavel(texto: string): string | null {
  const apenasDigitos = texto.replace(/\D/g, "");
  const m = apenasDigitos.match(/\d{47}/);
  return m ? m[0] : null;
}

function fatorParaData(fator: number): string | null {
  if (!fator || fator <= 0) return null;
  const base = Date.UTC(1997, 9, 7); // 07/10/1997
  let dias = fator;
  let venc = new Date(base + dias * 86400000);
  // Correção do ciclo de fatores (reset FEBRABAN em 2025): se cair muito no passado, soma 9000.
  const hoje = new Date();
  const limite = new Date(hoje.getFullYear() - 5, hoje.getMonth(), hoje.getDate());
  let guard = 0;
  while (venc < limite && guard < 3) {
    dias += 9000;
    venc = new Date(base + dias * 86400000);
    guard++;
  }
  return venc.toISOString().slice(0, 10);
}

export function parseBoleto(entrada: string): BoletoResultado {
  const d = entrada.replace(/\D/g, "");
  if (d.length !== 47) {
    if (d.startsWith("8")) {
      throw new Error("Boletos de concessionária/arrecadação ainda não são suportados.");
    }
    throw new Error("Linha digitável inválida: são esperados 47 dígitos.");
  }

  const banco = d.slice(0, 3);
  // Campo 5 (índices 33–46): fator de vencimento (4) + valor (10).
  const fator = Number(d.slice(33, 37));
  const valor = Number(d.slice(37, 47)) / 100;

  return {
    linhaDigitavel: d,
    banco,
    valor: Number.isFinite(valor) ? valor : 0,
    vencimento: fatorParaData(fator),
  };
}
