// Fase 4 — Exportação Contábil. Gera partidas dobradas (débito/crédito) a partir das
// baixas (pagamentos/recebimentos). Simplificação: uma partida por título baixado.
import { categoriaService, contaPagarService, contaReceberService } from "./services";

export interface LancamentoContabil {
  data: string; // yyyy-MM-dd
  contaDebito: string;
  contaCredito: string;
  valor: number;
  historico: string;
}

const CONTA_CAIXA = "Caixa/Bancos";

export async function getLancamentosContabeis(
  empresaId: string,
  inicio: string,
  fim: string
): Promise<LancamentoContabil[]> {
  const [pagar, receber, categorias] = await Promise.all([
    contaPagarService.list(empresaId),
    contaReceberService.list(empresaId),
    categoriaService.list(empresaId),
  ]);
  const catMap = new Map(categorias.map((c) => [c.id, c.nome]));
  const inRange = (iso: string | null) => !!iso && iso >= inicio && iso <= fim;

  const lancamentos: LancamentoContabil[] = [];

  // Pagamentos: D Despesa (categoria)  /  C Caixa/Bancos
  for (const c of pagar) {
    if (c.transferencia || c.status === "cancelada" || c.valorPago <= 0 || !inRange(c.dataPagamento)) continue;
    const conta = c.categoriaId ? catMap.get(c.categoriaId) ?? "Despesas" : "Despesas";
    lancamentos.push({
      data: c.dataPagamento as string,
      contaDebito: conta,
      contaCredito: CONTA_CAIXA,
      valor: c.valorPago,
      historico: `Pagamento a ${c.fornecedor}`,
    });
  }

  // Recebimentos: D Caixa/Bancos  /  C Receita (categoria)
  for (const c of receber) {
    if (c.transferencia || c.status === "cancelada" || c.valorRecebido <= 0 || !inRange(c.dataRecebimento)) continue;
    const conta = c.categoriaId ? catMap.get(c.categoriaId) ?? "Receitas" : "Receitas";
    lancamentos.push({
      data: c.dataRecebimento as string,
      contaDebito: CONTA_CAIXA,
      contaCredito: conta,
      valor: c.valorRecebido,
      historico: `Recebimento de ${c.cliente}`,
    });
  }

  return lancamentos.sort((a, b) => a.data.localeCompare(b.data));
}
