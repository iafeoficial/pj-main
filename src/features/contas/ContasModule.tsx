import { useMemo, useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Pencil, Plus, Trash2, CheckCircle2, Ban, Upload, ArrowLeftRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  Categoria,
  CategoriaGrupo,
  CategoriaTipo,
  CentroCusto,
  Cliente,
  ContaFinanceira,
  Fornecedor,
  ImpostosRetidos,
  PagamentoConta,
  RecorrenciaTipo,
  TipoPessoa,
} from "@/types/domain";
import { categoriaService, centroCustoService, contaFinanceiraService, categoriaGrupoService } from "@/data/services";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useFormDraft } from "@/hooks/useFormDraft";
import { formatBRL, formatDate, isValidCNPJ, isValidCPF, normalizeCNPJ, today } from "@/lib/utils";
import { combinaBusca, partesData, partesValor } from "@/lib/busca";
import { formatCpfCnpj } from "@/lib/masks";
import { emptyParceiroForm, parceiroToPayload } from "@/features/cadastros/ParceiroForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { BuscaCampo, BuscaVazia } from "@/components/ui/BuscaCampo";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { EntityLink } from "@/components/EntityLink";
import { parseContaOrigem, resolveIdByPrefix } from "@/lib/entityLinks";
import { proximoVencimentoFatura } from "@/lib/fatura";
import { labelContaFinanceira } from "@/lib/contaFinanceira";
import { totalImpostosRetidos } from "@/lib/contaPagarExtras";
import { compraService, vendaService } from "@/data/operacao";
import { confirmarMovimentacao, previewMovimentacao } from "@/data/importacaoFinanceira";
import type { PreviewMovimentacao } from "@/lib/movimentacaoPlanilha";
import { clienteService, fornecedorService } from "@/data/cadastros";
import {
  getPerfilLancamento,
  getPessoaLabel,
  getPessoaPlaceholder,
  getDefaultPessoa,
  hidePessoaField,
  pessoaRequired,
  showVincularCadastro,
  validateByPerfil,
} from "@/lib/contaCategoriaPerfil";
import {
  emptyImpostos,
  HistoricoPagamentos,
  ImpostosFields,
  ParcelasRepeticaoFields,
} from "@/features/contas/ContasPagarExtras";

/** Forma comum de uma conta a pagar/receber para a UI. */
export interface ContaLike {
  id: string;
  empresaId: string;
  pessoa: string; // fornecedor ou cliente
  categoriaId: string | null;
  centroCustoId: string | null;
  contaFinanceiraId?: string | null;
  valor: number;
  valorBaixado: number; // valorPago ou valorRecebido
  /** Valor devido (bruto − desconto + juros − impostos). Só Contas a Pagar. */
  valorDevido?: number;
  desconto?: number;
  juros?: number;
  numeroNf?: string;
  impostos?: ImpostosRetidos | null;
  parcelaNumero?: number | null;
  parcelaTotal?: number | null;
  recorrencia?: RecorrenciaTipo | null;
  recorrenciaDias?: number | null;
  dataCompetencia: string;
  dataVencimento: string;
  dataBaixa: string | null;
  status: string;
  observacao: string;
  /** Fora dos totais: movimentação entre contas da mesma empresa. */
  transferencia?: boolean;
  /** Id do cliente ou do fornecedor, quando o lançamento está ligado ao cadastro. */
  parceiroId?: string | null;
}

export interface ContasConfig {
  titulo: string;
  subtitulo: string;
  icon: LucideIcon;
  pessoaLabel: string; // "Beneficiário" | "Cliente"
  /**
   * Quando definido, o modal carrega **clientes e fornecedores** no mesmo dropdown
   * (a pessoa pode atuar nos dois papéis). O valor só indica o cadastro preferencial
   * ao criar um novo parceiro a partir do lançamento.
   */
  pessoaCadastro?: "fornecedor" | "cliente";
  categoriaTipo: CategoriaTipo; // despesa | receita
  /** Exibe o select de conta/cartão (Contas a Pagar). */
  usaContaFinanceira?: boolean;
  /** Campos extras Fase 2 (só Contas a Pagar). */
  extrasPagar?: boolean;
  baixaLabel: string; // "Registrar pagamento" | "Registrar recebimento"
  statusBaixado: string; // "paga" | "recebida"
  // Operações (mapeiam para os services específicos) — assíncronas (Supabase)
  list: (empresaId: string) => Promise<ContaLike[]>;
  create: (empresaId: string, input: ContaFormData) => Promise<unknown>;
  update: (empresaId: string, id: string, input: ContaFormData) => Promise<unknown>;
  baixar: (empresaId: string, id: string, valor: number, data: string) => Promise<unknown>;
  listPagamentos?: (empresaId: string, id: string) => Promise<PagamentoConta[]>;
  cancelar: (empresaId: string, id: string) => Promise<unknown>;
  remove: (empresaId: string, id: string) => Promise<unknown>;
  setTransferencia: (empresaId: string, id: string, transferencia: boolean) => Promise<unknown>;
}

export interface ContaFormData {
  pessoa: string;
  parceiroId: string | null;
  categoriaId: string | null;
  centroCustoId: string | null;
  contaFinanceiraId: string | null;
  valor: number;
  dataCompetencia: string;
  dataVencimento: string;
  status: "rascunho" | "aberta";
  observacao: string;
  // Fase 2 — Contas a Pagar
  desconto: number;
  juros: number;
  numeroNf: string;
  impostos: ImpostosRetidos | null;
  parcelas: number;
  recorrencia: RecorrenciaTipo | null;
  /** Dias entre títulos quando recorrência = personalizada. */
  recorrenciaDias: number;
  recorrenciaOcorrencias: number;
}

type FormTab = "dados" | "impostos" | "parcelas" | "historico";

const EMPTY_FORM = (): ContaFormData => ({
  pessoa: "",
  parceiroId: null,
  categoriaId: null,
  centroCustoId: null,
  contaFinanceiraId: null,
  valor: 0,
  dataCompetencia: today(),
  dataVencimento: today(),
  status: "aberta",
  observacao: "",
  desconto: 0,
  juros: 0,
  numeroNf: "",
  impostos: null,
  parcelas: 1,
  recorrencia: null,
  recorrenciaDias: 30,
  recorrenciaOcorrencias: 1,
});

function ListaMovimento({
  titulo,
  itens,
  vazio,
}: {
  titulo: string;
  itens: string[];
  vazio?: string;
}) {
  if (itens.length === 0 && !vazio) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo} ({itens.length})
      </h3>
      {itens.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <ul className="mt-1 max-h-36 space-y-0.5 overflow-y-auto text-sm">
          {itens.map((item, i) => (
            <li key={`${item}-${i}`}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ContasModule({
  empresaId,
  config,
  readOnly = false,
}: {
  empresaId: string;
  config: ContasConfig;
  readOnly?: boolean;
}) {
  const { version, bumpData } = useEmpresa();
  const { notify } = useToast();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("id");
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const fileMovRef = useRef<HTMLInputElement>(null);
  const [movOpen, setMovOpen] = useState(false);
  const [movPreview, setMovPreview] = useState<PreviewMovimentacao | null>(null);
  const [movImporting, setMovImporting] = useState(false);

  // `version` é a chave de invalidação de cache após mutações de dados.
  const { data: contas } = useAsyncData(
    () => config.list(empresaId),
    [empresaId, version, config],
    [] as ContaLike[]
  );
  const { data: categorias } = useAsyncData(
    () => categoriaService.listAtivas(empresaId, config.categoriaTipo),
    [empresaId, version, config.categoriaTipo],
    [] as Categoria[]
  );
  const { data: gruposCat } = useAsyncData(
    () => categoriaGrupoService.listAtivos(empresaId, config.categoriaTipo),
    [empresaId, version, config.categoriaTipo],
    [] as CategoriaGrupo[]
  );
  const { data: centros } = useAsyncData(
    () => centroCustoService.listAtivos(empresaId),
    [empresaId, version],
    [] as CentroCusto[]
  );
  const { data: contasFinanceiras } = useAsyncData(
    () =>
      config.usaContaFinanceira
        ? contaFinanceiraService.listAtivas(empresaId)
        : Promise.resolve([] as ContaFinanceira[]),
    [empresaId, version, config.usaContaFinanceira],
    [] as ContaFinanceira[]
  );
  const { data: todasCategorias } = useAsyncData(
    () => categoriaService.list(empresaId),
    [empresaId, version],
    [] as Categoria[]
  );
  const { data: compras } = useAsyncData(() => compraService.list(empresaId), [empresaId, version], []);
  const { data: vendas } = useAsyncData(() => vendaService.list(empresaId), [empresaId, version], []);
  const { data: clientes } = useAsyncData(
    () =>
      config.pessoaCadastro
        ? clienteService.list(empresaId)
        : Promise.resolve([] as Cliente[]),
    [empresaId, version, config.pessoaCadastro],
    [] as Cliente[]
  );
  const { data: fornecedores } = useAsyncData(
    () =>
      config.pessoaCadastro
        ? fornecedorService.list(empresaId)
        : Promise.resolve([] as Fornecedor[]),
    [empresaId, version, config.pessoaCadastro],
    [] as Fornecedor[]
  );
  const clientesAtivos = useMemo(() => clientes.filter((c) => c.ativo), [clientes]);
  const fornecedoresAtivos = useMemo(() => fornecedores.filter((f) => f.ativo), [fornecedores]);

  type ParceiroOpt = {
    nome: string;
    cnpjCpf: string;
    tipoPessoa: TipoPessoa;
    kinds: ("cliente" | "fornecedor")[];
    clienteId: string | null;
    fornecedorId: string | null;
  };

  const parceirosCadastro = useMemo(() => {
    const map = new Map<string, ParceiroOpt>();
    for (const c of clientesAtivos) {
      map.set(c.nome, {
        nome: c.nome,
        cnpjCpf: c.cnpjCpf ?? "",
        tipoPessoa: c.tipoPessoa ?? "pj",
        kinds: ["cliente"],
        clienteId: c.id,
        fornecedorId: null,
      });
    }
    for (const f of fornecedoresAtivos) {
      const existing = map.get(f.nome);
      if (existing) {
        if (!existing.kinds.includes("fornecedor")) existing.kinds.push("fornecedor");
        if (!existing.cnpjCpf && f.cnpjCpf) existing.cnpjCpf = f.cnpjCpf;
        existing.fornecedorId = f.id;
      } else {
        map.set(f.nome, {
          nome: f.nome,
          cnpjCpf: f.cnpjCpf ?? "",
          tipoPessoa: f.tipoPessoa ?? "pj",
          kinds: ["fornecedor"],
          clienteId: null,
          fornecedorId: f.id,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [clientesAtivos, fornecedoresAtivos]);

  const parceiroOptions = useMemo(
    () =>
      parceirosCadastro.map((p) => {
        const kind =
          p.kinds.includes("cliente") && p.kinds.includes("fornecedor")
            ? "Cliente · Fornecedor"
            : p.kinds[0] === "cliente"
              ? "Cliente"
              : "Fornecedor";
        const doc = p.cnpjCpf ? ` — ${p.cnpjCpf}` : "";
        return { value: p.nome, label: `${p.nome} (${kind})${doc}` };
      }),
    [parceirosCadastro]
  );
  const catMap = useMemo(
    () => new Map(todasCategorias.map((c) => [c.id, c.nome])),
    [todasCategorias]
  );
  const grupoCatMap = useMemo(
    () => new Map(gruposCat.map((g) => [g.id, g.nome])),
    [gruposCat]
  );
  const contaFinMap = useMemo(
    () => new Map(contasFinanceiras.map((c) => [c.id, c])),
    [contasFinanceiras]
  );

  const categoriaOptions = useMemo(
    () =>
      categorias.map((c) => ({
        value: c.id,
        label:
          c.grupoId && grupoCatMap.get(c.grupoId)
            ? `${grupoCatMap.get(c.grupoId)} › ${c.nome}`
            : c.nome,
      })),
    [categorias, grupoCatMap]
  );

  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [busca, setBusca] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [formTab, setFormTab] = useState<FormTab>("dados");
  const [form, setForm] = useState<ContaFormData>(EMPTY_FORM());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [vincularCadastro, setVincularCadastro] = useState(false);
  const [pessoaTipoPessoa, setPessoaTipoPessoa] = useState<TipoPessoa>("pj");
  const [pessoaCnpjCpf, setPessoaCnpjCpf] = useState("");
  const [historico, setHistorico] = useState<PagamentoConta[]>([]);

  const [baixaConta, setBaixaConta] = useState<ContaLike | null>(null);
  const [baixaValor, setBaixaValor] = useState(0);
  const [baixaData, setBaixaData] = useState(today());
  const [baixaHistorico, setBaixaHistorico] = useState<PagamentoConta[]>([]);

  const [toDelete, setToDelete] = useState<ContaLike[]>([]);
  const [toCancel, setToCancel] = useState<ContaLike | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  type ContaDraftExtra = {
    wizardStep: 1 | 2;
    vincularCadastro: boolean;
    formTab: FormTab;
    pessoaTipoPessoa: TipoPessoa;
    pessoaCnpjCpf: string;
  };

  const { clearDraft } = useFormDraft<ContaFormData, ContaDraftExtra>(
    `contas-${config.categoriaTipo}`,
    {
      open: modalOpen,
      form,
      editingId,
      extra: { wizardStep, vincularCadastro, formTab, pessoaTipoPessoa, pessoaCnpjCpf },
    },
    (draft) => {
      setForm({ ...EMPTY_FORM(), ...draft.form });
      setEditingId(draft.editingId);
      setWizardStep(draft.extra?.wizardStep ?? 1);
      setVincularCadastro(draft.extra?.vincularCadastro ?? false);
      setPessoaTipoPessoa(draft.extra?.pessoaTipoPessoa ?? "pj");
      setPessoaCnpjCpf(draft.extra?.pessoaCnpjCpf ?? "");
      setFormTab(draft.extra?.formTab ?? "dados");
      setModalOpen(true);
      notify("Rascunho restaurado.", "info");
    }
  );

  const filtradas = useMemo(() => {
    const porStatus = filtroStatus === "todos" ? contas : contas.filter((c) => c.status === filtroStatus);
    const q = busca.trim();
    if (!q) return porStatus;
    return porStatus.filter((c) => {
      const preferFornecedor = config.pessoaCadastro === "fornecedor";
      const listaPref = preferFornecedor ? fornecedores : clientes;
      const listaOutra = preferFornecedor ? clientes : fornecedores;
      const cadastro = c.parceiroId
        ? listaPref.find((p) => p.id === c.parceiroId) ?? listaOutra.find((p) => p.id === c.parceiroId)
        : listaPref.find((p) => p.nome === c.pessoa.trim()) ?? listaOutra.find((p) => p.nome === c.pessoa.trim());
      const contaFin = c.contaFinanceiraId ? contaFinMap.get(c.contaFinanceiraId) : undefined;
      return combinaBusca(q, [
        c.pessoa,
        cadastro?.nome,
        cadastro?.nomeFantasia,
        cadastro?.cnpjCpf,
        cadastro?.telefone,
        ...partesValor(c.valor),
        ...partesValor(c.valorDevido),
        ...partesValor(c.valorBaixado),
        ...partesData(c.dataVencimento),
        ...partesData(c.dataCompetencia),
        ...partesData(c.dataBaixa),
        c.categoriaId ? catMap.get(c.categoriaId) : "",
        contaFin ? labelContaFinanceira(contaFin) : "",
        c.observacao,
        c.status,
        c.numeroNf,
      ]);
    });
  }, [contas, filtroStatus, busca, catMap, contaFinMap, clientes, fornecedores, config.pessoaCadastro]);

  const allFilteredSelected =
    filtradas.length > 0 && filtradas.every((c) => selectedIds.has(c.id));
  const someFilteredSelected = filtradas.some((c) => selectedIds.has(c.id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (filtradas.every((c) => next.has(c.id))) {
        for (const c of filtradas) next.delete(c.id);
      } else {
        for (const c of filtradas) next.add(c.id);
      }
      return next;
    });
  }

  function openDelete(items: ContaLike[]) {
    if (items.length === 0) return;
    setToDelete(items);
  }

  useEffect(() => {
    if (!highlightId) return;
    const el = rowRefs.current.get(highlightId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId, filtradas]);

  async function toggleTransferencia(c: ContaLike) {
    try {
      await config.setTransferencia(empresaId, c.id, !c.transferencia);
      bumpData();
      notify(
        c.transferencia
          ? "Lançamento voltou a contar nos totais."
          : "Marcado como transferência. Não entra nos totais."
      );
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  const totais = useMemo(() => {
    const ativas = contas.filter((c) => c.status !== "cancelada" && !c.transferencia);
    const total = ativas.reduce((s, c) => s + (c.valorDevido ?? c.valor), 0);
    const baixado = ativas.reduce((s, c) => s + c.valorBaixado, 0);
    const emAberto = ativas
      .filter((c) => c.status !== config.statusBaixado)
      .reduce((s, c) => s + ((c.valorDevido ?? c.valor) - c.valorBaixado), 0);
    return { total, baixado, emAberto };
  }, [contas, config.statusBaixado]);

  const totaisPorConta = useMemo(() => {
    if (!config.usaContaFinanceira) return [];
    const soma = new Map<string, number>();
    let semConta = 0;
    for (const c of contas) {
      if (c.status === "cancelada" || c.transferencia) continue;
      const valor = c.valorDevido ?? c.valor;
      if (!c.contaFinanceiraId) semConta += valor;
      else soma.set(c.contaFinanceiraId, (soma.get(c.contaFinanceiraId) ?? 0) + valor);
    }
    const linhas = contasFinanceiras.map((cf) => ({
      id: cf.id,
      nome: labelContaFinanceira(cf),
      total: soma.get(cf.id) ?? 0,
    }));
    if (semConta > 0) linhas.push({ id: "sem-conta", nome: "Sem conta", total: semConta });
    return linhas;
  }, [contas, contasFinanceiras, config.usaContaFinanceira]);

  function resolveVincularCadastro(nome: string): boolean {
    if (!nome || !config.pessoaCadastro) return false;
    return parceirosCadastro.some((p) => p.nome === nome);
  }

  const vincularCadastroLabel = config.pessoaCadastro
    ? "Selecionar cliente ou fornecedor cadastrado"
    : "";

  function applyParceiroSelecionado(nome: string) {
    const p = parceirosCadastro.find((x) => x.nome === nome);
    const parceiroId = p
      ? config.pessoaCadastro === "fornecedor"
        ? p.fornecedorId
        : p.clienteId
      : null;
    setForm((prev) => ({ ...prev, pessoa: nome, parceiroId }));
    if (p) {
      setPessoaTipoPessoa(p.tipoPessoa);
      setPessoaCnpjCpf(p.cnpjCpf ? formatCpfCnpj(p.cnpjCpf) : "");
    } else {
      setPessoaCnpjCpf("");
    }
  }

  function cadastroDaConta(conta: ContaLike): Cliente | Fornecedor | undefined {
    const preferFornecedor = config.pessoaCadastro === "fornecedor";
    const listaPref = preferFornecedor ? fornecedores : clientes;
    const listaOutra = preferFornecedor ? clientes : fornecedores;
    if (conta.parceiroId) {
      const porId =
        listaPref.find((p) => p.id === conta.parceiroId) ??
        listaOutra.find((p) => p.id === conta.parceiroId);
      if (porId) return porId;
    }
    const nome = conta.pessoa.trim();
    if (!nome) return undefined;
    return listaPref.find((p) => p.nome === nome) ?? listaOutra.find((p) => p.nome === nome);
  }

  function validatePessoaDocumento(): string | undefined {
    const doc = pessoaCnpjCpf.trim();
    if (!doc) return undefined;
    if (pessoaTipoPessoa === "pj") {
      if (normalizeCNPJ(doc).length < 14) return "CNPJ incompleto.";
      if (!isValidCNPJ(doc)) return "CNPJ inválido.";
    } else {
      if (doc.replace(/\D/g, "").length < 11) return "CPF incompleto.";
      if (!isValidCPF(doc)) return "CPF inválido.";
    }
    return undefined;
  }

  const categoriaAtual = useMemo(
    () => categorias.find((c) => c.id === form.categoriaId) ?? null,
    [categorias, form.categoriaId]
  );

  const contaFinanceiraSelecionada = form.contaFinanceiraId
    ? contaFinMap.get(form.contaFinanceiraId)
    : undefined;

  const perfil = getPerfilLancamento(categoriaAtual, config.categoriaTipo);
  const pessoaFieldLabel = getPessoaLabel(perfil, config.categoriaTipo);
  // No passo 1 a categoria ainda é desconhecida: usa o rótulo genérico (Favorecido/Pagador).
  const pessoaStepLabel = getPessoaLabel("generico", config.categoriaTipo);

  const devidoPreview = useMemo(() => {
    if (!config.extrasPagar) return form.valor;
    const retidos = totalImpostosRetidos(form.impostos);
    return Math.max(0, Number((form.valor - form.desconto + form.juros - retidos).toFixed(2)));
  }, [config.extrasPagar, form.valor, form.desconto, form.juros, form.impostos]);

  function closeModal() {
    clearDraft();
    setModalOpen(false);
    setWizardStep(1);
    setFormTab("dados");
    setHistorico([]);
  }

  function openCreate() {
    clearDraft();
    setEditingId(null);
    setForm(EMPTY_FORM());
    setErrors({});
    setVincularCadastro(false);
    setPessoaTipoPessoa("pj");
    setPessoaCnpjCpf("");
    setWizardStep(1);
    setFormTab("dados");
    setHistorico([]);
    setModalOpen(true);
  }

  async function openEdit(c: ContaLike) {
    clearDraft();
    setEditingId(c.id);
    setForm({
      pessoa: c.pessoa,
      parceiroId: c.parceiroId ?? null,
      categoriaId: c.categoriaId,
      centroCustoId: c.centroCustoId,
      contaFinanceiraId: c.contaFinanceiraId ?? null,
      valor: c.valor,
      dataCompetencia: c.dataCompetencia,
      dataVencimento: c.dataVencimento,
      status: c.status === "rascunho" ? "rascunho" : "aberta",
      observacao: c.observacao,
      desconto: c.desconto ?? 0,
      juros: c.juros ?? 0,
      numeroNf: c.numeroNf ?? "",
      impostos: c.impostos ?? null,
      parcelas: 1,
      recorrencia: c.recorrencia ?? null,
      recorrenciaDias: c.recorrenciaDias ?? 30,
      recorrenciaOcorrencias: 1,
    });
    setErrors({});
    const linked = resolveVincularCadastro(c.pessoa);
    setVincularCadastro(linked);
    const p = parceirosCadastro.find((x) => x.nome === c.pessoa);
    setPessoaTipoPessoa(p?.tipoPessoa ?? "pj");
    setPessoaCnpjCpf(p?.cnpjCpf ? formatCpfCnpj(p.cnpjCpf) : "");
    setWizardStep(2);
    setFormTab("dados");
    setModalOpen(true);
    if (config.extrasPagar && config.listPagamentos) {
      try {
        setHistorico(await config.listPagamentos(empresaId, c.id));
      } catch {
        setHistorico([]);
      }
    }
  }

  function continueToStep2() {
    const docErr = validatePessoaDocumento();
    if (docErr) {
      setErrors({ cnpjCpf: docErr });
      return;
    }
    setErrors({});
    setWizardStep(2);
    setFormTab("dados");
  }

  function backToStep1() {
    setWizardStep(1);
    setErrors({});
  }

  function handleCategoriaChange(categoriaId: string) {
    const newCat = categorias.find((c) => c.id === categoriaId) ?? null;
    const newPerfil = getPerfilLancamento(newCat, config.categoriaTipo);
    const next: ContaFormData = { ...form, categoriaId: categoriaId || null };
    if (hidePessoaField(newPerfil)) next.pessoa = "";
    setForm(next);
    if (!showVincularCadastro(newPerfil)) setVincularCadastro(false);
  }

  /**
   * Ao escolher um cartão com dia de fatura, sugere o vencimento no próximo ciclo
   * (a compra do mês entra na fatura do mês seguinte). A data continua editável.
   */
  function handleContaFinanceiraChange(contaFinanceiraId: string) {
    const conta = contaFinanceiraId ? contaFinMap.get(contaFinanceiraId) : undefined;
    const next: ContaFormData = { ...form, contaFinanceiraId: contaFinanceiraId || null };
    if (conta?.tipo === "cartao_credito" && conta.diaVencimentoFatura) {
      next.dataVencimento = proximoVencimentoFatura(
        form.dataCompetencia || today(),
        conta.diaVencimentoFatura
      );
    }
    setForm(next);
  }

  function validate(): boolean {
    const err: Record<string, string> = {
      ...validateByPerfil(perfil, form, config.categoriaTipo),
    };
    // Na edição a categoria pode ser removida (lançamentos legados); na criação é obrigatória.
    if (!editingId && !form.categoriaId) err.categoriaId = "Escolha a categoria.";
    if (!form.valor || form.valor <= 0) err.valor = "Informe um valor maior que zero.";
    if (!form.dataVencimento) err.dataVencimento = "Informe o vencimento.";
    if (
      !editingId &&
      form.recorrencia === "personalizada" &&
      (!form.recorrenciaDias || form.recorrenciaDias < 1)
    ) {
      err.recorrenciaDias = "Informe o intervalo em dias (ex.: 12 ou 20).";
    }
    const docErr = validatePessoaDocumento();
    if (docErr) err.cnpjCpf = docErr;
    setErrors(err);
    if (err.recorrenciaDias) setFormTab("parcelas");
    return Object.keys(err).length === 0;
  }

  /**
   * Garante cadastro do favorecido/pagador:
   * - Contas a Pagar → fornecedor; Contas a Receber → cliente.
   * - Cria mesmo sem CPF/CNPJ (só com o nome).
   * - Se o cadastro já existe sem documento e o usuário preenche depois, atualiza.
   */
  async function ensureParceiroCadastro(nome: string): Promise<string | null> {
    if (!config.pessoaCadastro || !nome.trim()) return null;
    const nomeTrim = nome.trim();
    const doc = pessoaCnpjCpf.trim();
    const preferFornecedor = config.pessoaCadastro === "fornecedor";

    const existingForn = fornecedoresAtivos.find((f) => f.nome === nomeTrim);
    const existingCli = clientesAtivos.find((c) => c.nome === nomeTrim);
    const existing = preferFornecedor
      ? (existingForn ?? existingCli)
      : (existingCli ?? existingForn);
    const existingKind: "fornecedor" | "cliente" | null = existingForn && existing?.id === existingForn.id
      ? "fornecedor"
      : existingCli && existing?.id === existingCli.id
        ? "cliente"
        : null;

    if (existing && existingKind) {
      if (doc && !(existing.cnpjCpf ?? "").trim()) {
        const patch = { cnpjCpf: doc, tipoPessoa: pessoaTipoPessoa };
        if (existingKind === "fornecedor") {
          await fornecedorService.update(empresaId, existing.id, patch);
        } else {
          await clienteService.update(empresaId, existing.id, patch);
        }
      }
      if (preferFornecedor && existingForn) return existingForn.id;
      if (!preferFornecedor && existingCli) return existingCli.id;
      return null;
    }

    const data = parceiroToPayload({
      ...emptyParceiroForm(),
      tipoPessoa: pessoaTipoPessoa,
      nome: nomeTrim,
      cnpjCpf: doc,
    });
    if (preferFornecedor) {
      const criado = await fornecedorService.create(empresaId, data);
      return criado.id;
    }
    const criado = await clienteService.create(empresaId, data);
    return criado.id;
  }

  async function save() {
    if (!validate()) return;
    const payload: ContaFormData = { ...form };
    if (hidePessoaField(perfil)) {
      payload.pessoa = getDefaultPessoa(perfil, form);
    }
    try {
      if (payload.pessoa) {
        const id = await ensureParceiroCadastro(payload.pessoa);
        if (id) payload.parceiroId = id;
      }
      if (editingId) {
        await config.update(empresaId, editingId, payload);
        notify("Lançamento atualizado.");
      } else {
        await config.create(empresaId, payload);
        notify("Lançamento criado.");
      }
      clearDraft();
      bumpData();
      closeModal();
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  function openBaixa(c: ContaLike) {
    const devido = c.valorDevido ?? c.valor;
    setBaixaConta(c);
    setBaixaValor(Number((devido - c.valorBaixado).toFixed(2)));
    setBaixaData(today());
    setBaixaHistorico([]);
    if (config.extrasPagar && config.listPagamentos) {
      void config.listPagamentos(empresaId, c.id).then(setBaixaHistorico).catch(() => setBaixaHistorico([]));
    }
  }

  async function confirmBaixa() {
    if (!baixaConta) return;
    try {
      await config.baixar(empresaId, baixaConta.id, baixaValor, baixaData);
      bumpData();
      notify(`${config.baixaLabel} registrado.`);
      setBaixaConta(null);
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  async function confirmCancel() {
    if (!toCancel) return;
    try {
      await config.cancelar(empresaId, toCancel.id);
      bumpData();
      notify("Lançamento cancelado.");
    } catch (e) {
      notify((e as Error).message, "error");
    }
    setToCancel(null);
  }

  async function confirmDelete() {
    if (toDelete.length === 0) return;
    const ids = toDelete.map((c) => c.id);
    let ok = 0;
    const erros: string[] = [];
    for (const id of ids) {
      try {
        await config.remove(empresaId, id);
        ok++;
      } catch (e) {
        erros.push((e as Error).message);
      }
    }
    bumpData();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
    setToDelete([]);
    if (ok > 0) {
      notify(ok === 1 ? "Lançamento excluído." : `${ok} lançamentos excluídos.`);
    }
    if (erros.length > 0) {
      notify(erros[0], "error");
    }
  }

  async function onPlanilhaMovimento(file: File) {
    try {
      const preview = await previewMovimentacao(empresaId, await file.arrayBuffer());
      setMovPreview(preview);
      setMovOpen(true);
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  function fecharMovimentacao() {
    if (movImporting) return;
    setMovOpen(false);
    setMovPreview(null);
  }

  async function confirmarPlanilhaMovimento() {
    if (!movPreview || movPreview.criar.length === 0 || movImporting) return;
    setMovImporting(true);
    try {
      const gravados = await confirmarMovimentacao(empresaId, movPreview.criar);
      bumpData();
      notify(gravados === 1 ? "1 lançamento importado." : `${gravados} lançamentos importados.`);
      setMovOpen(false);
      setMovPreview(null);
    } catch (e) {
      bumpData();
      notify((e as Error).message, "error");
    } finally {
      setMovImporting(false);
    }
  }

  const STATUS_OPTS = ["todos", "aberta", "parcial", config.statusBaixado, "vencida", "rascunho", "cancelada"];

  return (
    <>
      <PageHeader
        title={config.titulo}
        subtitle={config.subtitulo}
        actions={
          !readOnly ? (
            <>
              <input
                ref={fileMovRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void onPlanilhaMovimento(file);
                }}
              />
              <button className="btn-outline" onClick={() => fileMovRef.current?.click()}>
                <Upload className="h-4 w-4" /> Importar planilha
              </button>
              <button className="btn-primary" onClick={openCreate}>
                <Plus className="h-4 w-4" /> Novo lançamento
              </button>
            </>
          ) : undefined
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Total" value={formatBRL(totais.total)} />
        <SummaryCard label={`Já ${config.statusBaixado === "paga" ? "pago" : "recebido"}`} value={formatBRL(totais.baixado)} tone="success" />
        <SummaryCard label="Em aberto" value={formatBRL(totais.emAberto)} tone="warning" />
      </div>

      {totaisPorConta.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {totaisPorConta.map((c) => (
            <SummaryCard key={c.id} label={c.nome} value={formatBRL(c.total)} compact />
          ))}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <BuscaCampo value={busca} onChange={setBusca} />
        {STATUS_OPTS.map((s) => (
          <button
            key={s}
            onClick={() => setFiltroStatus(s)}
            className={`badge cursor-pointer capitalize ${
              filtroStatus === s
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {s === "todos" ? "Todos" : s}
          </button>
        ))}
        {!readOnly && selectedIds.size > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {selectedIds.size} selecionado{selectedIds.size > 1 ? "s" : ""}
            </span>
            <button
              type="button"
              className="btn-outline btn-sm text-destructive"
              onClick={() => openDelete(contas.filter((c) => selectedIds.has(c.id)))}
            >
              <Trash2 className="h-3.5 w-3.5" /> Excluir selecionados
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Limpar
            </button>
          </div>
        )}
      </div>

      {filtradas.length === 0 ? (
        busca.trim() ? (
          <BuscaVazia />
        ) : (
        <EmptyState
          icon={config.icon}
          title="Nenhum lançamento"
          description="Crie um lançamento, importe a planilha ou ajuste o filtro de status."
          action={
            !readOnly ? (
              <div className="flex flex-wrap justify-center gap-2">
                <button className="btn-outline" onClick={() => fileMovRef.current?.click()}>
                  <Upload className="h-4 w-4" /> Importar planilha
                </button>
                <button className="btn-primary" onClick={openCreate}>
                  <Plus className="h-4 w-4" /> Novo lançamento
                </button>
              </div>
            ) : undefined
          }
        />
        )
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                {!readOnly && (
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      className="rounded border-border"
                      aria-label="Selecionar todos"
                      checked={allFilteredSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected;
                      }}
                      onChange={toggleSelectAllFiltered}
                    />
                  </th>
                )}
                <th className="px-4 py-2.5 font-medium">{config.pessoaLabel}</th>
                <th className="px-4 py-2.5 font-medium">Categoria</th>
                {config.usaContaFinanceira && (
                  <th className="px-4 py-2.5 font-medium">Conta / Cartão</th>
                )}
                <th className="px-4 py-2.5 font-medium">Vencimento</th>
                <th className="px-4 py-2.5 text-right font-medium">Valor</th>
                <th className="px-4 py-2.5 text-right font-medium">Saldo</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtradas.map((c) => {
                const devido = c.valorDevido ?? c.valor;
                const saldo = devido - c.valorBaixado;
                const baixavel = c.status !== config.statusBaixado && c.status !== "cancelada";
                const selected = selectedIds.has(c.id);
                return (
                  <tr
                    key={c.id}
                    ref={(el) => {
                      if (el) rowRefs.current.set(c.id, el);
                    }}
                    className={`hover:bg-muted/30 ${
                      selected ? "bg-primary/5" : ""
                    } ${c.id === highlightId ? "bg-primary/10 ring-2 ring-primary/30" : ""}`}
                  >
                    {!readOnly && (
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          className="rounded border-border"
                          aria-label={`Selecionar ${c.pessoa}`}
                          checked={selected}
                          onChange={() => toggleSelect(c.id)}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      {(() => {
                        const cadastro = cadastroDaConta(c);
                        const detalhe = [cadastro?.cnpjCpf, cadastro?.telefone].filter(Boolean).join(" · ");
                        return (
                          <>
                            <div className="font-medium">{cadastro?.nome || c.pessoa}</div>
                            {detalhe && (
                              <div className="text-xs text-muted-foreground">{detalhe}</div>
                            )}
                          </>
                        );
                      })()}
                      {c.parcelaNumero && c.parcelaTotal ? (
                        <div className="text-xs text-muted-foreground">
                          Parcela {c.parcelaNumero}/{c.parcelaTotal}
                        </div>
                      ) : null}
                      {c.transferencia && (
                        <div className="text-xs font-medium text-amber-700 dark:text-amber-400">
                          Transferência entre contas — fora dos totais
                        </div>
                      )}
                      {c.observacao && (
                        <div className="text-xs text-muted-foreground">{c.observacao}</div>
                      )}
                      {(() => {
                        const ref = c.observacao ? parseContaOrigem(c.observacao) : null;
                        if (!ref) return null;
                        const ids = ref.type === "compra" ? compras.map((x) => x.id) : vendas.map((x) => x.id);
                        const fullId = resolveIdByPrefix(ids, ref.prefix);
                        if (!fullId) return null;
                        return (
                          <div className="mt-1">
                            <EntityLink
                              type={ref.type}
                              id={fullId}
                              label={`Origem: ${ref.type === "compra" ? "Compra" : "Venda"}`}
                            />
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.categoriaId ? catMap.get(c.categoriaId) ?? "—" : "—"}
                    </td>
                    {config.usaContaFinanceira && (
                      <td className="px-4 py-3 text-muted-foreground">
                      {c.contaFinanceiraId
                        ? (() => {
                            const cf = contaFinMap.get(c.contaFinanceiraId);
                            return cf ? labelContaFinanceira(cf) : "—";
                          })()
                        : "—"}
                    </td>
                    )}
                    <td className="px-4 py-3">{formatDate(c.dataVencimento)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatBRL(devido)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatBRL(saldo)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {!readOnly && baixavel && (
                          <button
                            className="btn-outline btn-sm"
                            title={config.baixaLabel}
                            onClick={() => openBaixa(c)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Baixar
                          </button>
                        )}
                        {!readOnly && (
                          <>
                            <button
                              className={`btn-ghost btn-sm ${c.transferencia ? "text-amber-700" : ""}`}
                              title={c.transferencia ? "Desmarcar transferência" : "É transferência"}
                              onClick={() => void toggleTransferencia(c)}
                            >
                              <ArrowLeftRight className="h-4 w-4" />
                            </button>
                            <button className="btn-ghost btn-sm" onClick={() => openEdit(c)}>
                              <Pencil className="h-4 w-4" />
                            </button>
                            {c.status !== "cancelada" && (
                              <button
                                className="btn-ghost btn-sm text-warning"
                                title="Cancelar"
                                onClick={() => setToCancel(c)}
                              >
                                <Ban className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              className="btn-ghost btn-sm text-destructive"
                              onClick={() => openDelete([c])}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de criação/edição */}
      <Modal
        open={modalOpen}
        title={
          editingId
            ? "Editar lançamento"
            : wizardStep === 1
              ? `Novo lançamento — ${pessoaStepLabel.toLowerCase()}`
              : "Novo lançamento — dados"
        }
        onClose={closeModal}
        width={config.extrasPagar ? "max-w-2xl" : "max-w-xl"}
        footer={
          !editingId && wizardStep === 1 ? (
            <>
              <button className="btn-outline" onClick={closeModal}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={continueToStep2}>
                Continuar
              </button>
            </>
          ) : (
            <>
              <button className="btn-outline" onClick={closeModal}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={save}>
                Salvar
              </button>
            </>
          )
        }
      >
        {!editingId && wizardStep === 1 ? (
          <div className="space-y-4">
            <Field
              label={pessoaStepLabel}
              hint="Comece pela pessoa do lançamento; a categoria e os valores vêm na próxima etapa."
            >
              {config.pessoaCadastro ? (
                <div className="space-y-2">
                  {vincularCadastro ? (
                    <SearchableSelect
                      value={form.pessoa}
                      onChange={applyParceiroSelecionado}
                      placeholder="Buscar cliente ou fornecedor…"
                      searchPlaceholder="Digite nome ou documento…"
                      options={[
                        { value: "", label: "— selecione cliente ou fornecedor —" },
                        ...parceiroOptions,
                      ]}
                    />
                  ) : (
                    <input
                      className="input"
                      value={form.pessoa}
                      onChange={(e) => setForm({ ...form, pessoa: e.target.value, parceiroId: null })}
                      placeholder={getPessoaPlaceholder("generico")}
                      autoFocus
                    />
                  )}
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      className="rounded border-border"
                      checked={vincularCadastro}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setVincularCadastro(checked);
                        if (checked && !parceirosCadastro.some((p) => p.nome === form.pessoa)) {
                          setForm({ ...form, pessoa: "", parceiroId: null });
                          setPessoaCnpjCpf("");
                        }
                      }}
                    />
                    {vincularCadastroLabel}
                  </label>
                </div>
              ) : (
                <input
                  className="input"
                  value={form.pessoa}
                  onChange={(e) => setForm({ ...form, pessoa: e.target.value, parceiroId: null })}
                  placeholder={getPessoaPlaceholder("generico")}
                  autoFocus
                />
              )}
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Tipo">
                <Select
                  value={pessoaTipoPessoa}
                  onChange={(v) => {
                    setPessoaTipoPessoa(v as TipoPessoa);
                    setPessoaCnpjCpf("");
                  }}
                  options={[
                    { value: "pj", label: "Pessoa jurídica (CNPJ)" },
                    { value: "pf", label: "Pessoa física (CPF)" },
                  ]}
                />
              </Field>
              <Field
                label={pessoaTipoPessoa === "pj" ? "CNPJ" : "CPF"}
                error={errors.cnpjCpf}
                hint={
                  pessoaTipoPessoa === "pj"
                    ? "Opcional. Aceita CNPJ numérico ou alfanumérico (com letras)."
                    : "Opcional."
                }
              >
                <input
                  className="input uppercase"
                  inputMode={pessoaTipoPessoa === "pj" ? "text" : "numeric"}
                  autoCapitalize="characters"
                  maxLength={18}
                  value={pessoaCnpjCpf}
                  onChange={(e) => setPessoaCnpjCpf(formatCpfCnpj(e.target.value))}
                  placeholder={
                    pessoaTipoPessoa === "pj" ? "00.000.000/0000-00" : "000.000.000-00"
                  }
                />
              </Field>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {config.extrasPagar && (
              <div className="flex flex-wrap gap-1 border-b border-border pb-2">
                {(
                  [
                    { id: "dados" as const, label: "Dados" },
                    { id: "impostos" as const, label: "Impostos" },
                    { id: "parcelas" as const, label: "Parcelas / repetição" },
                    ...(editingId
                      ? [{ id: "historico" as const, label: "Histórico" }]
                      : []),
                  ] satisfies { id: FormTab; label: string }[]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFormTab(tab.id)}
                    className={`rounded-md px-3 py-1.5 text-sm ${
                      formTab === tab.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            {(!config.extrasPagar || formTab === "dados") && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Categoria"
                  required={!editingId}
                  error={errors.categoriaId}
                  className="sm:col-span-2"
                >
                  <Select
                    value={form.categoriaId ?? ""}
                    onChange={handleCategoriaChange}
                    options={[
                      { value: "", label: editingId ? "— sem categoria —" : "— selecione —" },
                      ...categoriaOptions,
                    ]}
                  />
                </Field>
                {!editingId && (
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      className="text-sm text-primary hover:underline"
                      onClick={backToStep1}
                    >
                      ← Voltar para {pessoaStepLabel.toLowerCase()}
                    </button>
                  </div>
                )}
                {!hidePessoaField(perfil) && (
                  <>
                    <Field
                      label={pessoaFieldLabel}
                      required={pessoaRequired(perfil)}
                      error={errors.pessoa}
                      className="sm:col-span-2"
                    >
                      {showVincularCadastro(perfil) && config.pessoaCadastro ? (
                        <div className="space-y-2">
                          {vincularCadastro ? (
                            <SearchableSelect
                              value={form.pessoa}
                              onChange={applyParceiroSelecionado}
                              placeholder="Buscar cliente ou fornecedor…"
                              searchPlaceholder="Digite nome ou documento…"
                              options={[
                                { value: "", label: "— selecione cliente ou fornecedor —" },
                                ...parceiroOptions,
                              ]}
                            />
                          ) : (
                            <input
                              className="input"
                              value={form.pessoa}
                              onChange={(e) => setForm({ ...form, pessoa: e.target.value, parceiroId: null })}
                              placeholder={getPessoaPlaceholder(perfil)}
                            />
                          )}
                          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                            <input
                              type="checkbox"
                              className="rounded border-border"
                              checked={vincularCadastro}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setVincularCadastro(checked);
                                if (checked && !parceirosCadastro.some((p) => p.nome === form.pessoa)) {
                                  setForm({ ...form, pessoa: "", parceiroId: null });
                                  setPessoaCnpjCpf("");
                                }
                              }}
                            />
                            {vincularCadastroLabel}
                          </label>
                        </div>
                      ) : (
                        <input
                          className="input"
                          value={form.pessoa}
                          onChange={(e) => setForm({ ...form, pessoa: e.target.value, parceiroId: null })}
                          placeholder={getPessoaPlaceholder(perfil)}
                        />
                      )}
                    </Field>
                    {config.pessoaCadastro && showVincularCadastro(perfil) && (
                      <>
                        <Field label="Tipo">
                          <Select
                            value={pessoaTipoPessoa}
                            onChange={(v) => {
                              setPessoaTipoPessoa(v as TipoPessoa);
                              setPessoaCnpjCpf("");
                            }}
                            options={[
                              { value: "pj", label: "Pessoa jurídica (CNPJ)" },
                              { value: "pf", label: "Pessoa física (CPF)" },
                            ]}
                          />
                        </Field>
                        <Field
                          label={pessoaTipoPessoa === "pj" ? "CNPJ" : "CPF"}
                          error={errors.cnpjCpf}
                          hint={
                            pessoaTipoPessoa === "pj"
                              ? "Opcional. Aceita CNPJ numérico ou alfanumérico."
                              : "Opcional."
                          }
                        >
                          <input
                            className="input uppercase"
                            inputMode={pessoaTipoPessoa === "pj" ? "text" : "numeric"}
                            autoCapitalize="characters"
                            maxLength={18}
                            value={pessoaCnpjCpf}
                            onChange={(e) => setPessoaCnpjCpf(formatCpfCnpj(e.target.value))}
                            placeholder={
                              pessoaTipoPessoa === "pj"
                                ? "00.000.000/0000-00"
                                : "000.000.000-00"
                            }
                          />
                        </Field>
                      </>
                    )}
                  </>
                )}
                <Field label="Valor (R$)" required error={errors.valor}>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.valor || ""}
                    onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Status">
                  <Select
                    value={form.status}
                    onChange={(status) =>
                      setForm({ ...form, status: status as ContaFormData["status"] })
                    }
                    options={[
                      { value: "aberta", label: "Aberta" },
                      { value: "rascunho", label: "Rascunho" },
                    ]}
                  />
                </Field>
                {config.extrasPagar && (
                  <>
                    <Field label="Desconto (R$)">
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.desconto || ""}
                        onChange={(e) => setForm({ ...form, desconto: Number(e.target.value) || 0 })}
                      />
                    </Field>
                    <Field label="Juros (R$)">
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.juros || ""}
                        onChange={(e) => setForm({ ...form, juros: Number(e.target.value) || 0 })}
                      />
                    </Field>
                    <Field label="Nº da NF" className="sm:col-span-2">
                      <input
                        className="input"
                        value={form.numeroNf}
                        onChange={(e) => setForm({ ...form, numeroNf: e.target.value })}
                        placeholder="Número da nota fiscal"
                      />
                    </Field>
                    {(form.desconto > 0 || form.juros > 0 || totalImpostosRetidos(form.impostos) > 0) && (
                      <p className="sm:col-span-2 text-sm text-muted-foreground">
                        Valor devido:{" "}
                        <span className="font-medium text-foreground">{formatBRL(devidoPreview)}</span>
                      </p>
                    )}
                  </>
                )}
                <Field label="Competência">
                  <DatePicker
                    value={form.dataCompetencia}
                    onChange={(dataCompetencia) => setForm({ ...form, dataCompetencia })}
                  />
                </Field>
                <Field label="Vencimento" required error={errors.dataVencimento}>
                  <DatePicker
                    value={form.dataVencimento}
                    onChange={(dataVencimento) => setForm({ ...form, dataVencimento })}
                  />
                </Field>
                {config.usaContaFinanceira && (
                  <Field
                    label="Conta / Cartão"
                    hint={
                      contaFinanceiraSelecionada?.tipo === "cartao_credito" &&
                      contaFinanceiraSelecionada.diaVencimentoFatura
                        ? `Fatura vence dia ${contaFinanceiraSelecionada.diaVencimentoFatura}${
                            contaFinanceiraSelecionada.titular?.trim()
                              ? ` · titular ${contaFinanceiraSelecionada.titular.trim()}`
                              : ""
                          } — vencimento sugerido no próximo ciclo.`
                        : undefined
                    }
                  >
                    <Select
                      value={form.contaFinanceiraId ?? ""}
                      onChange={handleContaFinanceiraChange}
                      options={[
                        { value: "", label: "— sem conta —" },
                        ...contasFinanceiras.map((c) => ({
                          value: c.id,
                          label: labelContaFinanceira(c),
                        })),
                      ]}
                    />
                  </Field>
                )}
                <Field label="Centro de custo">
                  <Select
                    value={form.centroCustoId ?? ""}
                    onChange={(centroCustoId) =>
                      setForm({ ...form, centroCustoId: centroCustoId || null })
                    }
                    options={[
                      { value: "", label: "— sem centro —" },
                      ...centros.map((c) => ({ value: c.id, label: c.nome })),
                    ]}
                  />
                </Field>
                <Field label="Observação" className="sm:col-span-2">
                  <input
                    className="input"
                    value={form.observacao}
                    onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                  />
                </Field>
              </div>
            )}

            {config.extrasPagar && formTab === "impostos" && (
              <ImpostosFields
                value={form.impostos ?? emptyImpostos()}
                onChange={(impostos) => setForm({ ...form, impostos })}
              />
            )}

            {config.extrasPagar && formTab === "parcelas" && (
              <ParcelasRepeticaoFields
                parcelas={form.parcelas}
                recorrencia={form.recorrencia}
                recorrenciaDias={form.recorrenciaDias}
                recorrenciaOcorrencias={form.recorrenciaOcorrencias}
                editing={!!editingId}
                onChange={(partial) => setForm({ ...form, ...partial })}
              />
            )}

            {config.extrasPagar && formTab === "historico" && editingId && (
              <HistoricoPagamentos items={historico} />
            )}
          </div>
        )}
      </Modal>

      {/* Modal de baixa */}
      <Modal
        open={!!baixaConta}
        title={config.baixaLabel}
        onClose={() => setBaixaConta(null)}
        footer={
          <>
            <button className="btn-outline" onClick={() => setBaixaConta(null)}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={confirmBaixa}>
              Confirmar
            </button>
          </>
        }
      >
        {baixaConta && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Saldo em aberto:{" "}
              <span className="font-medium text-foreground">
                {formatBRL((baixaConta.valorDevido ?? baixaConta.valor) - baixaConta.valorBaixado)}
              </span>
              {config.extrasPagar && (
                <span className="mt-1 block text-xs">
                  Pagamento avulso: informe um valor menor que o saldo para baixa parcial.
                </span>
              )}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Valor (R$)" required>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={baixaValor || ""}
                  onChange={(e) => setBaixaValor(Number(e.target.value))}
                />
              </Field>
              <Field label="Data">
                <DatePicker value={baixaData} onChange={setBaixaData} />
              </Field>
            </div>
            {config.extrasPagar && baixaHistorico.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                  Histórico de pagamentos
                </p>
                <HistoricoPagamentos items={baixaHistorico} />
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={movOpen && !!movPreview}
        title="Importar movimentação"
        width="max-w-2xl"
        onClose={fecharMovimentacao}
        footer={
          <>
            <button className="btn-outline" onClick={fecharMovimentacao} disabled={movImporting}>
              Cancelar
            </button>
            <button
              className="btn-primary"
              onClick={() => void confirmarPlanilhaMovimento()}
              disabled={movImporting || !movPreview || movPreview.criar.length === 0}
            >
              {movImporting ? "Importando…" : "Confirmar importação"}
            </button>
          </>
        }
      >
        {movPreview && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Valor negativo vira conta a pagar e valor positivo vira conta a receber. Conta, grupo,
              categoria e o nome do cliente ou fornecedor são criados se ainda não existirem. Nada é
              gravado antes desta confirmação.
            </p>
            <ListaMovimento
              titulo="Contas a pagar"
              itens={movPreview.criar
                .filter((i) => i.lado === "pagar")
                .map((i) => `${i.pessoa} · ${formatBRL(i.valor)} · ${formatDate(i.data)}`)}
              vazio="Nenhuma."
            />
            <ListaMovimento
              titulo="Contas a receber"
              itens={movPreview.criar
                .filter((i) => i.lado === "receber")
                .map((i) => `${i.pessoa} · ${formatBRL(i.valor)} · ${formatDate(i.data)}`)}
              vazio="Nenhuma."
            />
            <ListaMovimento
              titulo="Já lançados — não serão duplicados"
              itens={movPreview.duplicadas.map(
                (i) =>
                  `${i.lado === "pagar" ? "Pagar" : "Receber"}: ${i.pessoa} · ${formatBRL(i.valor)} · ${formatDate(i.data)}`
              )}
            />
            <ListaMovimento
              titulo="Ignoradas"
              itens={movPreview.ignoradas.map((i) => `Linha ${i.linha}: ${i.motivo}`)}
            />
            <ListaMovimento
              titulo="Linhas inválidas"
              itens={movPreview.invalidas.map((i) => `Linha ${i.linha}: ${i.motivo}`)}
            />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toCancel}
        title="Cancelar lançamento"
        message="Lançamentos cancelados deixam de contar no fluxo de caixa. Confirmar?"
        confirmLabel="Cancelar lançamento"
        onConfirm={confirmCancel}
        onCancel={() => setToCancel(null)}
      />

      <ConfirmDialog
        open={toDelete.length > 0}
        title={
          toDelete.length > 1
            ? `Excluir ${toDelete.length} lançamentos`
            : "Excluir lançamento"
        }
        message={
          <div className="space-y-3">
            <p>
              Esta ação é <span className="font-medium text-destructive">irreversível</span>.
              {toDelete.length > 1
                ? " Os lançamentos abaixo serão removidos permanentemente:"
                : " O lançamento abaixo será removido permanentemente:"}
            </p>
            <ul className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border border-border bg-muted/40 px-3 py-2">
              {toDelete.map((c) => {
                const devido = c.valorDevido ?? c.valor;
                const parcela =
                  c.parcelaNumero && c.parcelaTotal
                    ? ` · Parcela ${c.parcelaNumero}/${c.parcelaTotal}`
                    : "";
                return (
                  <li key={c.id} className="flex justify-between gap-3 text-foreground">
                    <span className="min-w-0 truncate">
                      {c.pessoa}
                      {parcela}
                      <span className="text-muted-foreground">
                        {" "}
                        · {formatDate(c.dataVencimento)}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">{formatBRL(devido)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        }
        confirmLabel={toDelete.length > 1 ? `Excluir ${toDelete.length}` : "Excluir"}
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setToDelete([])}
      />
    </>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  compact,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning";
  compact?: boolean;
}) {
  const color =
    tone === "success"
      ? "text-emerald-600"
      : tone === "warning"
      ? "text-amber-600"
      : "text-foreground";
  return (
    <div className="card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-semibold tabular-nums ${compact ? "text-base" : "text-lg"} ${color}`}>{value}</p>
    </div>
  );
}
