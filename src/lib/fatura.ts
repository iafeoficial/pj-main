/** Regras de vencimento de fatura de cartão de crédito. */

/**
 * Vencimento da fatura em que a compra cai: o ciclo seguinte ao mês da compra.
 * Ex.: compra em 05/03 com fatura dia 10 → vence em 10/04.
 * `dia` é normalizado para 1–28, então nunca estoura o fim do mês.
 */
export function proximoVencimentoFatura(dataCompra: string, dia: number): string {
  const base = new Date(`${dataCompra.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(base.getTime())) return dataCompra;
  const diaFatura = Math.min(28, Math.max(1, Math.trunc(dia)));
  const venc = new Date(base.getFullYear(), base.getMonth() + 1, diaFatura);
  const mes = String(venc.getMonth() + 1).padStart(2, "0");
  const diaStr = String(venc.getDate()).padStart(2, "0");
  return `${venc.getFullYear()}-${mes}-${diaStr}`;
}
