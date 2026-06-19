// Cálculos financeiros derivados (dashboard, fluxo de caixa e relatórios). Assíncronos (C3).
import type { ContaPagar, ContaReceber } from "@/types/domain";
import { monthRange } from "@/lib/utils";
import {
  categoriaService,
  centroCustoService,
  contaPagarService,
  contaReceberService,
} from "./services";

function isLiquidada(status: string): boolean {
  return status === "paga" || status === "recebida";
}
function isAtiva(status: string): boolean {
  return status !== "cancelada";
}

export interface DashboardData {
  saldoAtual: number;
  totalAReceber: number;
  totalAPagar: number;
  saldoProjetado: number;
  receitasMes: number;
  despesasMes: number;
  inadimplencia: number;
  pagar: ContaPagar[];
  receber: ContaReceber[];
}

export async function getDashboard(empresaId: string): Promise<DashboardData> {
  const [pagar, receber] = await Promise.all([
    contaPagarService.list(empresaId),
    contaReceberService.list(empresaId),
  ]);
  const { start, end } = monthRange();

  const recebido = receber.reduce((s, c) => s + c.valorRecebido, 0);
  const pago = pagar.reduce((s, c) => s + c.valorPago, 0);
  const saldoAtual = recebido - pago;

  const totalAReceber = receber
    .filter((c) => isAtiva(c.status) && !isLiquidada(c.status))
    .reduce((s, c) => s + (c.valor - c.valorRecebido), 0);

  const totalAPagar = pagar
    .filter((c) => isAtiva(c.status) && !isLiquidada(c.status))
    .reduce((s, c) => s + (c.valor - c.valorPago), 0);

  const saldoProjetado = saldoAtual + totalAReceber - totalAPagar;

  const receitasMes = receber
    .filter((c) => isAtiva(c.status) && c.dataCompetencia >= start && c.dataCompetencia <= end)
    .reduce((s, c) => s + c.valor, 0);

  const despesasMes = pagar
    .filter((c) => isAtiva(c.status) && c.dataCompetencia >= start && c.dataCompetencia <= end)
    .reduce((s, c) => s + c.valor, 0);

  const inadimplencia = receber
    .filter((c) => c.status === "vencida")
    .reduce((s, c) => s + (c.valor - c.valorRecebido), 0);

  return { saldoAtual, totalAReceber, totalAPagar, saldoProjetado, receitasMes, despesasMes, inadimplencia, pagar, receber };
}

export interface FluxoBucket {
  mes: string;
  label: string;
  entradas: number;
  saidas: number;
  saldoMes: number;
  saldoAcumulado: number;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export async function getFluxoCaixa(empresaId: string, mesesAntes = 2, mesesDepois = 4): Promise<FluxoBucket[]> {
  const [pagarAll, receberAll] = await Promise.all([
    contaPagarService.list(empresaId),
    contaReceberService.list(empresaId),
  ]);
  const pagar = pagarAll.filter((c) => isAtiva(c.status));
  const receber = receberAll.filter((c) => isAtiva(c.status));

  const ref = new Date();
  const buckets: FluxoBucket[] = [];
  for (let i = -mesesAntes; i <= mesesDepois; i++) {
    const d = new Date(ref.getFullYear(), ref.getMonth() + i, 1);
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({
      mes,
      label: `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
      entradas: 0,
      saidas: 0,
      saldoMes: 0,
      saldoAcumulado: 0,
    });
  }

  const idx = new Map(buckets.map((b, i) => [b.mes, i]));
  const mesOf = (iso: string) => iso.slice(0, 7);

  for (const c of receber) {
    const i = idx.get(mesOf(c.dataVencimento));
    if (i !== undefined) buckets[i].entradas += c.valor;
  }
  for (const c of pagar) {
    const i = idx.get(mesOf(c.dataVencimento));
    if (i !== undefined) buckets[i].saidas += c.valor;
  }

  let acc = 0;
  for (const b of buckets) {
    b.saldoMes = b.entradas - b.saidas;
    acc += b.saldoMes;
    b.saldoAcumulado = acc;
  }
  return buckets;
}

export interface GroupRow {
  chave: string;
  rotulo: string;
  total: number;
  qtd: number;
}

function groupBy(items: { valor: number; key: string; label: string }[]): GroupRow[] {
  const map = new Map<string, GroupRow>();
  for (const it of items) {
    const cur = map.get(it.key) ?? { chave: it.key, rotulo: it.label, total: 0, qtd: 0 };
    cur.total += it.valor;
    cur.qtd += 1;
    map.set(it.key, cur);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export interface RelatoriosData {
  porCategoria: { receitas: GroupRow[]; despesas: GroupRow[] };
  porCentroCusto: GroupRow[];
  porCliente: GroupRow[];
  porFornecedor: GroupRow[];
}

export async function getRelatorios(empresaId: string, inicio: string, fim: string): Promise<RelatoriosData> {
  const inRange = (iso: string) => iso >= inicio && iso <= fim;
  const [pagarAll, receberAll, categorias, centros] = await Promise.all([
    contaPagarService.list(empresaId),
    contaReceberService.list(empresaId),
    categoriaService.list(empresaId),
    centroCustoService.list(empresaId),
  ]);
  const pagar = pagarAll.filter((c) => isAtiva(c.status) && inRange(c.dataCompetencia));
  const receber = receberAll.filter((c) => isAtiva(c.status) && inRange(c.dataCompetencia));

  const catMap = new Map(categorias.map((c) => [c.id, c.nome]));
  const ccMap = new Map(centros.map((c) => [c.id, c.nome]));

  const receitas = groupBy(
    receber.map((c) => ({
      valor: c.valor,
      key: c.categoriaId ?? "sem",
      label: c.categoriaId ? catMap.get(c.categoriaId) ?? "—" : "Sem categoria",
    }))
  );
  const despesas = groupBy(
    pagar.map((c) => ({
      valor: c.valor,
      key: c.categoriaId ?? "sem",
      label: c.categoriaId ? catMap.get(c.categoriaId) ?? "—" : "Sem categoria",
    }))
  );
  const porCentroCusto = groupBy(
    [...pagar, ...receber].map((c) => ({
      valor: c.valor,
      key: c.centroCustoId ?? "sem",
      label: c.centroCustoId ? ccMap.get(c.centroCustoId) ?? "—" : "Sem centro",
    }))
  );
  const porCliente = groupBy(receber.map((c) => ({ valor: c.valor, key: c.cliente, label: c.cliente })));
  const porFornecedor = groupBy(pagar.map((c) => ({ valor: c.valor, key: c.fornecedor, label: c.fornecedor })));

  return { porCategoria: { receitas, despesas }, porCentroCusto, porCliente, porFornecedor };
}

// ---------------------------------------------------------------------------
// DRE — Demonstração do Resultado do Exercício (regime de competência)
// ---------------------------------------------------------------------------
export interface DREData {
  inicio: string;
  fim: string;
  receitas: GroupRow[];
  despesas: GroupRow[];
  totalReceitas: number;
  totalDespesas: number;
  resultado: number;
  margem: number; // resultado / receitas (%)
}

export async function getDRE(empresaId: string, inicio: string, fim: string): Promise<DREData> {
  const inRange = (iso: string) => iso >= inicio && iso <= fim;
  const [pagarAll, receberAll, categorias] = await Promise.all([
    contaPagarService.list(empresaId),
    contaReceberService.list(empresaId),
    categoriaService.list(empresaId),
  ]);
  const pagar = pagarAll.filter((c) => isAtiva(c.status) && inRange(c.dataCompetencia));
  const receber = receberAll.filter((c) => isAtiva(c.status) && inRange(c.dataCompetencia));
  const catMap = new Map(categorias.map((c) => [c.id, c.nome]));

  const receitas = groupBy(
    receber.map((c) => ({
      valor: c.valor,
      key: c.categoriaId ?? "sem",
      label: c.categoriaId ? catMap.get(c.categoriaId) ?? "—" : "Sem categoria",
    }))
  );
  const despesas = groupBy(
    pagar.map((c) => ({
      valor: c.valor,
      key: c.categoriaId ?? "sem",
      label: c.categoriaId ? catMap.get(c.categoriaId) ?? "—" : "Sem categoria",
    }))
  );

  const totalReceitas = receitas.reduce((s, r) => s + r.total, 0);
  const totalDespesas = despesas.reduce((s, r) => s + r.total, 0);
  const resultado = totalReceitas - totalDespesas;
  const margem = totalReceitas > 0 ? (resultado / totalReceitas) * 100 : 0;

  return { inicio, fim, receitas, despesas, totalReceitas, totalDespesas, resultado, margem };
}
