// Cálculos financeiros derivados (dashboard, fluxo de caixa e relatórios). Assíncronos (C3).
import type { ContaPagar, ContaReceber } from "@/types/domain";
import { monthRange } from "@/lib/utils";
import {
  categoriaGrupoService,
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
/** Transferência entre contas da mesma empresa não é despesa nem receita. */
function entraNoResultado(c: { transferencia?: boolean }): boolean {
  return c.transferencia !== true;
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
  const [pagarAll, receberAll] = await Promise.all([
    contaPagarService.list(empresaId),
    contaReceberService.list(empresaId),
  ]);
  const pagar = pagarAll.filter(entraNoResultado);
  const receber = receberAll.filter(entraNoResultado);
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
  const pagar = pagarAll.filter((c) => isAtiva(c.status) && entraNoResultado(c));
  const receber = receberAll.filter((c) => isAtiva(c.status) && entraNoResultado(c));

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
  const pagar = pagarAll.filter((c) => isAtiva(c.status) && entraNoResultado(c) && inRange(c.dataCompetencia));
  const receber = receberAll.filter((c) => isAtiva(c.status) && entraNoResultado(c) && inRange(c.dataCompetencia));

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
export interface DRECategoriaLinha {
  chave: string;
  rotulo: string;
  total: number;
  qtd: number;
}

export interface DREGrupoLinha {
  chave: string;
  rotulo: string;
  total: number;
  categorias: DRECategoriaLinha[];
}

export interface DREData {
  inicio: string;
  fim: string;
  receitas: DREGrupoLinha[];
  despesas: DREGrupoLinha[];
  totalReceitas: number;
  totalDespesas: number;
  resultado: number;
  margem: number; // resultado / receitas (%)
}

function buildDREHierarquia(
  itens: { valor: number; categoriaId: string | null }[],
  categorias: { id: string; nome: string; grupoId: string | null }[],
  grupos: { id: string; nome: string }[]
): DREGrupoLinha[] {
  const catMap = new Map(categorias.map((c) => [c.id, c]));
  const grupoNome = new Map(grupos.map((g) => [g.id, g.nome]));

  // grupoKey → categoriaKey → acumulado
  const bucket = new Map<
    string,
    { rotulo: string; cats: Map<string, DRECategoriaLinha> }
  >();

  function ensureGrupo(key: string, rotulo: string) {
    let g = bucket.get(key);
    if (!g) {
      g = { rotulo, cats: new Map() };
      bucket.set(key, g);
    }
    return g;
  }

  for (const it of itens) {
    const cat = it.categoriaId ? catMap.get(it.categoriaId) : undefined;
    const grupoKey = cat?.grupoId ?? "sem-grupo";
    const grupoRotulo = cat?.grupoId
      ? grupoNome.get(cat.grupoId) ?? "Grupo removido"
      : "Sem grupo";
    const catKey = it.categoriaId ?? "sem";
    const catRotulo = cat?.nome ?? (it.categoriaId ? "—" : "Sem categoria");

    const g = ensureGrupo(grupoKey, grupoRotulo);
    const cur = g.cats.get(catKey) ?? { chave: catKey, rotulo: catRotulo, total: 0, qtd: 0 };
    cur.total += it.valor;
    cur.qtd += 1;
    g.cats.set(catKey, cur);
  }

  return [...bucket.entries()]
    .map(([chave, g]) => {
      const categoriasLinha = [...g.cats.values()].sort((a, b) => b.total - a.total);
      return {
        chave,
        rotulo: g.rotulo,
        total: categoriasLinha.reduce((s, c) => s + c.total, 0),
        categorias: categoriasLinha,
      };
    })
    .sort((a, b) => {
      // "Sem grupo" por último
      if (a.chave === "sem-grupo") return 1;
      if (b.chave === "sem-grupo") return -1;
      return b.total - a.total;
    });
}

export async function getDRE(empresaId: string, inicio: string, fim: string): Promise<DREData> {
  const inRange = (iso: string) => iso >= inicio && iso <= fim;
  const [pagarAll, receberAll, categorias, grupos] = await Promise.all([
    contaPagarService.list(empresaId),
    contaReceberService.list(empresaId),
    categoriaService.list(empresaId),
    categoriaGrupoService.list(empresaId),
  ]);
  const pagar = pagarAll.filter((c) => isAtiva(c.status) && entraNoResultado(c) && inRange(c.dataCompetencia));
  const receber = receberAll.filter((c) => isAtiva(c.status) && entraNoResultado(c) && inRange(c.dataCompetencia));

  const receitas = buildDREHierarquia(
    receber.map((c) => ({ valor: c.valor, categoriaId: c.categoriaId })),
    categorias,
    grupos.filter((g) => g.tipo === "receita")
  );
  const despesas = buildDREHierarquia(
    pagar.map((c) => ({ valor: c.valor, categoriaId: c.categoriaId })),
    categorias,
    grupos.filter((g) => g.tipo === "despesa")
  );

  const totalReceitas = receitas.reduce((s, r) => s + r.total, 0);
  const totalDespesas = despesas.reduce((s, r) => s + r.total, 0);
  const resultado = totalReceitas - totalDespesas;
  const margem = totalReceitas > 0 ? (resultado / totalReceitas) * 100 : 0;

  return { inicio, fim, receitas, despesas, totalReceitas, totalDespesas, resultado, margem };
}
