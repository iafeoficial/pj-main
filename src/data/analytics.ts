// Cálculos financeiros derivados (dashboard, fluxo de caixa e relatórios). Assíncronos (C3).
import type { ContaPagar, ContaReceber } from "@/types/domain";
import { labelContaFinanceira } from "@/lib/contaFinanceira";
import { monthRange } from "@/lib/utils";
import { transferenciaService } from "./transferencias";
import {
  categoriaGrupoService,
  categoriaService,
  centroCustoService,
  contaFinanceiraService,
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

export interface PeriodoPadrao {
  inicio: string;
  fim: string;
}

/** Menor e maior data dos títulos que entram no resultado. Sem lançamento, o mês atual. */
export async function getPeriodoPadrao(
  empresaId: string,
  campo: "competencia" | "vencimento"
): Promise<PeriodoPadrao> {
  const [pagarAll, receberAll] = await Promise.all([
    contaPagarService.list(empresaId),
    contaReceberService.list(empresaId),
  ]);
  const datas: string[] = [];
  for (const c of [...pagarAll, ...receberAll]) {
    if (!isAtiva(c.status) || !entraNoResultado(c)) continue;
    const d = campo === "competencia" ? c.dataCompetencia : c.dataVencimento;
    if (d) datas.push(d);
  }
  if (datas.length === 0) {
    const mes = monthRange();
    return { inicio: mes.start, fim: mes.end };
  }
  datas.sort();
  return { inicio: datas[0], fim: datas[datas.length - 1] };
}

function mesesDoIntervalo(inicio: string, fim: string): { mes: string; label: string }[] {
  if (!inicio || !fim || inicio > fim) return [];
  const [y1, m1] = inicio.slice(0, 7).split("-").map(Number);
  const [y2, m2] = fim.slice(0, 7).split("-").map(Number);
  const out: { mes: string; label: string }[] = [];
  let y = y1;
  let m = m1;
  while ((y < y2 || (y === y2 && m <= m2)) && out.length < 240) {
    out.push({
      mes: `${y}-${String(m).padStart(2, "0")}`,
      label: `${MESES[m - 1]}/${String(y).slice(2)}`,
    });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function fecharSaldos(buckets: FluxoBucket[]): FluxoBucket[] {
  let acc = 0;
  for (const b of buckets) {
    b.saldoMes = b.entradas - b.saidas;
    acc += b.saldoMes;
    b.saldoAcumulado = acc;
  }
  return buckets;
}

/** Fluxo mensal entre duas datas. Sem conta, ignora transferência. Com conta, mostra o movimento dela. */
export async function getFluxoCaixaPeriodo(
  empresaId: string,
  inicio: string,
  fim: string,
  contaId?: string | null
): Promise<FluxoBucket[]> {
  const buckets: FluxoBucket[] = mesesDoIntervalo(inicio, fim).map((m) => ({
    ...m,
    entradas: 0,
    saidas: 0,
    saldoMes: 0,
    saldoAcumulado: 0,
  }));
  if (buckets.length === 0) return buckets;

  const [pagarAll, receberAll, transferencias] = await Promise.all([
    contaPagarService.list(empresaId),
    contaReceberService.list(empresaId),
    contaId ? transferenciaService.list(empresaId) : Promise.resolve([]),
  ]);
  const idx = new Map(buckets.map((b, i) => [b.mes, i]));
  const mesOf = (iso: string) => iso.slice(0, 7);
  const noMes = (iso: string) => iso >= inicio && iso <= fim;

  const pagar = pagarAll.filter((c) => isAtiva(c.status) && (!contaId || c.contaFinanceiraId === contaId));
  const receber = receberAll.filter((c) => isAtiva(c.status) && (!contaId || c.contaFinanceiraId === contaId));

  for (const c of receber) {
    if (!contaId && !entraNoResultado(c)) continue;
    if (!noMes(c.dataVencimento)) continue;
    const i = idx.get(mesOf(c.dataVencimento));
    if (i !== undefined) buckets[i].entradas += c.valor;
  }
  for (const c of pagar) {
    if (!contaId && !entraNoResultado(c)) continue;
    if (!noMes(c.dataVencimento)) continue;
    const i = idx.get(mesOf(c.dataVencimento));
    if (i !== undefined) buckets[i].saidas += c.valor;
  }
  if (contaId) {
    for (const t of transferencias) {
      if (!noMes(t.data)) continue;
      const i = idx.get(mesOf(t.data));
      if (i === undefined) continue;
      if (t.contaDestinoId === contaId) buckets[i].entradas += t.valor;
      if (t.contaOrigemId === contaId) buckets[i].saidas += t.valor;
    }
  }
  return fecharSaldos(buckets);
}

export interface LancamentoFluxo {
  id: string;
  mes: string;
  pessoa: string;
  data: string;
  valor: number;
  tipo: "entrada" | "saida";
  parceiroId: string | null;
}

/** Lançamentos que compõem o fluxo do período, na mesma regra do gráfico. */
export async function listarLancamentosFluxo(
  empresaId: string,
  inicio: string,
  fim: string,
  contaId?: string | null
): Promise<LancamentoFluxo[]> {
  const [pagarAll, receberAll, transferencias] = await Promise.all([
    contaPagarService.list(empresaId),
    contaReceberService.list(empresaId),
    contaId ? transferenciaService.list(empresaId) : Promise.resolve([]),
  ]);
  const noMes = (iso: string) => iso >= inicio && iso <= fim;
  const linhas: LancamentoFluxo[] = [];

  for (const c of receberAll) {
    if (!isAtiva(c.status)) continue;
    if (contaId ? c.contaFinanceiraId !== contaId : !entraNoResultado(c)) continue;
    if (!noMes(c.dataVencimento)) continue;
    linhas.push({
      id: c.id,
      mes: c.dataVencimento.slice(0, 7),
      pessoa: c.cliente,
      data: c.dataVencimento,
      valor: c.valor,
      tipo: "entrada",
      parceiroId: c.clienteId,
    });
  }
  for (const c of pagarAll) {
    if (!isAtiva(c.status)) continue;
    if (contaId ? c.contaFinanceiraId !== contaId : !entraNoResultado(c)) continue;
    if (!noMes(c.dataVencimento)) continue;
    linhas.push({
      id: c.id,
      mes: c.dataVencimento.slice(0, 7),
      pessoa: c.fornecedor,
      data: c.dataVencimento,
      valor: c.valor,
      tipo: "saida",
      parceiroId: c.fornecedorId,
    });
  }
  if (contaId) {
    for (const t of transferencias) {
      if (!noMes(t.data)) continue;
      if (t.contaDestinoId !== contaId && t.contaOrigemId !== contaId) continue;
      const entrada = t.contaDestinoId === contaId;
      linhas.push({
        id: t.id,
        mes: t.data.slice(0, 7),
        pessoa: "Transferência entre contas",
        data: t.data,
        valor: t.valor,
        tipo: entrada ? "entrada" : "saida",
        parceiroId: null,
      });
    }
  }
  return linhas.sort((a, b) => a.data.localeCompare(b.data) || a.pessoa.localeCompare(b.pessoa, "pt-BR"));
}

export interface SaldoContaLinha {
  id: string;
  nome: string;
  saldo: number;
}

/** Saldo acumulado de cada conta: abertura + o que já entrou − o que já saiu. */
export async function getSaldosContas(
  empresaId: string
): Promise<{ contas: SaldoContaLinha[]; total: number }> {
  const [contas, pagarAll, receberAll, transferencias] = await Promise.all([
    contaFinanceiraService.list(empresaId),
    contaPagarService.list(empresaId),
    contaReceberService.list(empresaId),
    transferenciaService.list(empresaId),
  ]);
  const map = new Map<string, number>();
  for (const c of contas) map.set(c.id, Number(c.saldoInicial) || 0);
  const add = (id: string | null, valor: number) => {
    if (!id || !map.has(id)) return;
    map.set(id, (map.get(id) ?? 0) + valor);
  };
  for (const c of receberAll) {
    if (!isAtiva(c.status)) continue;
    add(c.contaFinanceiraId, c.valorRecebido);
  }
  for (const c of pagarAll) {
    if (!isAtiva(c.status)) continue;
    add(c.contaFinanceiraId, -c.valorPago);
  }
  for (const t of transferencias) {
    add(t.contaDestinoId, t.valor);
    add(t.contaOrigemId, -t.valor);
  }
  const linhas = contas
    .map((c) => ({ id: c.id, nome: labelContaFinanceira(c), saldo: map.get(c.id) ?? 0 }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return { contas: linhas, total: linhas.reduce((s, l) => s + l.saldo, 0) };
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
