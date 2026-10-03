// Reativa linhas de extrato quando o título vinculado (CP/CR) é apagado.
// Arquivo separado para evitar import circular entre conciliacao.ts e services.ts.
import { transacaoTable } from "./repos";

export async function reativarTransacoesPorTitulo(
  empresaId: string,
  alvo: { contaPagarId?: string; contaReceberId?: string }
): Promise<number> {
  if (!alvo.contaPagarId && !alvo.contaReceberId) return 0;
  const todas = await transacaoTable.list(empresaId);
  const ids = todas
    .filter(
      (t) =>
        (alvo.contaPagarId != null && t.contaPagarId === alvo.contaPagarId) ||
        (alvo.contaReceberId != null && t.contaReceberId === alvo.contaReceberId)
    )
    .map((t) => t.id);

  for (const id of ids) {
    await transacaoTable.update(empresaId, id, {
      statusConciliacao: "pendente",
      contaPagarId: null,
      contaReceberId: null,
    });
  }
  return ids.length;
}
