import { useMemo, useRef, useState } from "react";
import { Landmark, Upload, CheckCircle2, Ban, RotateCcw, PlusCircle, Pencil, Trash2 } from "lucide-react";
import type {
  Categoria,
  CentroCusto,
  Cliente,
  ContaFinanceira,
  ExtratoBancario,
  Fornecedor,
  RecorrenciaTipo,
  RegraConciliacao,
  TipoPessoa,
  TransacaoBancaria,
} from "@/types/domain";
import {
  conciliacaoService,
  categoriaSugerida,
  regraService,
  sugerirConciliacao,
  type Sugestao,
} from "@/data/conciliacao";
import { categoriaService, centroCustoService, contaFinanceiraService } from "@/data/services";
import { clienteService, fornecedorService } from "@/data/cadastros";
import { parseOFX } from "@/lib/ofx";
import { labelContaFinanceira } from "@/lib/contaFinanceira";
import { formatCpfCnpj } from "@/lib/masks";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatBRL, formatDate } from "@/lib/utils";
import { canWrite } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { ParcelasRepeticaoFields } from "@/features/contas/ContasPagarExtras";
import { RequireEmpresa } from "@/components/RequireEmpresa";
import { useToast } from "@/components/ui/Toast";
import { EntityLink } from "@/components/EntityLink";

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  conciliada: "Conciliada",
  ignorada: "Ignorada",
};
const STATUS_STYLE: Record<string, string> = {
  pendente: "bg-amber-100 text-amber-700",
  conciliada: "bg-emerald-100 text-emerald-700",
  ignorada: "bg-zinc-200 text-zinc-600",
};

function Inner({ empresaId }: { empresaId: string }) {
  const { version, bumpData, papel } = useEmpresa();
  const readOnly = !canWrite(papel);
  const { notify } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: transacoes } = useAsyncData(
    () => conciliacaoService.listTransacoes(empresaId),
    [empresaId, version],
    [] as TransacaoBancaria[]
  );
  const { data: extratos } = useAsyncData(
    () => conciliacaoService.listExtratos(empresaId),
    [empresaId, version],
    [] as ExtratoBancario[]
  );
  const { data: regras } = useAsyncData(
    () => regraService.list(empresaId),
    [empresaId, version],
    [] as RegraConciliacao[]
  );
  const { data: categorias } = useAsyncData(
    () => categoriaService.list(empresaId),
    [empresaId, version],
    [] as Categoria[]
  );
  const { data: clientesAtivos } = useAsyncData(
    () => clienteService.listAtivos(empresaId),
    [empresaId, version],
    [] as Cliente[]
  );
  const { data: fornecedoresAtivos } = useAsyncData(
    () => fornecedorService.listAtivos(empresaId),
    [empresaId, version],
    [] as Fornecedor[]
  );
  const { data: centros } = useAsyncData(
    () => centroCustoService.listAtivos(empresaId),
    [empresaId, version],
    [] as CentroCusto[]
  );
  const { data: contasFinanceiras } = useAsyncData(
    () => contaFinanceiraService.listAtivas(empresaId),
    [empresaId, version],
    [] as ContaFinanceira[]
  );
  const catMap = useMemo(() => new Map(categorias.map((c) => [c.id, c.nome])), [categorias]);

  type ParceiroOpt = {
    nome: string;
    cnpjCpf: string;
    tipoPessoa: TipoPessoa;
    kinds: ("cliente" | "fornecedor")[];
  };

  const parceirosCadastro = useMemo(() => {
    const map = new Map<string, ParceiroOpt>();
    for (const c of clientesAtivos) {
      map.set(c.nome, {
        nome: c.nome,
        cnpjCpf: c.cnpjCpf ?? "",
        tipoPessoa: c.tipoPessoa ?? "pj",
        kinds: ["cliente"],
      });
    }
    for (const f of fornecedoresAtivos) {
      const existing = map.get(f.nome);
      if (existing) {
        if (!existing.kinds.includes("fornecedor")) existing.kinds.push("fornecedor");
        if (!existing.cnpjCpf && f.cnpjCpf) existing.cnpjCpf = f.cnpjCpf;
      } else {
        map.set(f.nome, {
          nome: f.nome,
          cnpjCpf: f.cnpjCpf ?? "",
          tipoPessoa: f.tipoPessoa ?? "pj",
          kinds: ["fornecedor"],
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

  const [filtro, setFiltro] = useState<string>("pendente");

  const [alvo, setAlvo] = useState<TransacaoBancaria | null>(null);
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [categoriaIdSugerida, setCategoriaIdSugerida] = useState<string | null>(null);

  const [lancarAlvo, setLancarAlvo] = useState<TransacaoBancaria | null>(null);
  const [lancarTab, setLancarTab] = useState<"dados" | "parcelas">("dados");
  const [lancarPessoa, setLancarPessoa] = useState("");
  const [lancarCategoriaId, setLancarCategoriaId] = useState("");
  const [lancarTipoPessoa, setLancarTipoPessoa] = useState<TipoPessoa>("pj");
  const [lancarCnpjCpf, setLancarCnpjCpf] = useState("");
  const [lancarCentroId, setLancarCentroId] = useState("");
  const [lancarContaFinId, setLancarContaFinId] = useState("");
  const [lancarObs, setLancarObs] = useState("");
  const [lancarParcelas, setLancarParcelas] = useState(1);
  const [lancarRecorrencia, setLancarRecorrencia] = useState<RecorrenciaTipo | null>(null);
  const [lancarRecorrenciaDias, setLancarRecorrenciaDias] = useState(30);
  const [lancarRecorrenciaOcorrencias, setLancarRecorrenciaOcorrencias] = useState(1);
  const [lancarErro, setLancarErro] = useState("");
  const [lancando, setLancando] = useState(false);

  const [loteOpen, setLoteOpen] = useState(false);
  const [loteCategoriaId, setLoteCategoriaId] = useState("");
  const [loteErro, setLoteErro] = useState("");

  const extratoResumo = useMemo(() => {
    const counts = new Map<string, number>();
    const conciliadasMap = new Map<string, number>();
    for (const t of transacoes) {
      if (!t.extratoId) continue;
      counts.set(t.extratoId, (counts.get(t.extratoId) ?? 0) + 1);
      if (t.statusConciliacao === "conciliada") {
        conciliadasMap.set(t.extratoId, (conciliadasMap.get(t.extratoId) ?? 0) + 1);
      }
    }
    return extratos.map((e) => ({
      ...e,
      qtdTransacoes: counts.get(e.id) ?? 0,
      qtdConciliadas: conciliadasMap.get(e.id) ?? 0,
    }));
  }, [extratos, transacoes]);

  const [editExtrato, setEditExtrato] = useState<ExtratoBancario | null>(null);
  const [editBanco, setEditBanco] = useState("");
  const [editConta, setEditConta] = useState("");
  const [editInicio, setEditInicio] = useState("");
  const [editFim, setEditFim] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [toDeleteExtrato, setToDeleteExtrato] = useState<{
    id: string;
    banco: string;
    conta: string;
    qtdTransacoes: number;
    qtdConciliadas: number;
  } | null>(null);
  const [deletingExtrato, setDeletingExtrato] = useState(false);

  const filtradas = useMemo(
    () => (filtro === "todas" ? transacoes : transacoes.filter((t) => t.statusConciliacao === filtro)),
    [transacoes, filtro]
  );

  const pendentes = useMemo(
    () => transacoes.filter((t) => t.statusConciliacao === "pendente"),
    [transacoes]
  );

  const categoriasLancar = useMemo(() => {
    if (!lancarAlvo) return [] as Categoria[];
    const tipo = lancarAlvo.tipo === "debito" ? "despesa" : "receita";
    return categorias.filter((c) => c.ativo && c.tipo === tipo);
  }, [categorias, lancarAlvo]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const ofx = parseOFX(text);
      if (ofx.transacoes.length === 0) {
        notify("Nenhuma transação encontrada no arquivo OFX.", "error");
        return;
      }
      const resumo = await conciliacaoService.importarOFX(empresaId, ofx);
      bumpData();
      notify(
        `Importadas ${resumo.importadas} transações${
          resumo.duplicadas ? ` (${resumo.duplicadas} duplicadas ignoradas)` : ""
        }.`
      );
    } catch (err) {
      notify((err as Error).message || "Falha ao ler o arquivo OFX.", "error");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function openEditExtrato(e: ExtratoBancario) {
    setEditExtrato(e);
    setEditBanco(e.banco || "");
    setEditConta(e.conta || "");
    setEditInicio(e.dataInicio || "");
    setEditFim(e.dataFim || "");
  }

  async function salvarEditExtrato() {
    if (!editExtrato) return;
    setEditSaving(true);
    try {
      await conciliacaoService.updateExtrato(empresaId, editExtrato.id, {
        banco: editBanco.trim(),
        conta: editConta.trim(),
        dataInicio: editInicio || null,
        dataFim: editFim || null,
      });
      bumpData();
      notify("Extrato atualizado.");
      setEditExtrato(null);
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      setEditSaving(false);
    }
  }

  async function confirmDeleteExtrato() {
    if (!toDeleteExtrato) return;
    setDeletingExtrato(true);
    try {
      const res = await conciliacaoService.removeExtrato(empresaId, toDeleteExtrato.id);
      bumpData();
      notify(
        res.conciliadas > 0
          ? `Extrato excluído (${res.total} transações, ${res.conciliadas} conciliadas).`
          : `Extrato excluído (${res.total} transações).`
      );
      setToDeleteExtrato(null);
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      setDeletingExtrato(false);
    }
  }

  async function abrirConciliacao(t: TransacaoBancaria) {
    setAlvo(t);
    setSugestoes([]);
    const catId = categoriaSugerida(regras, t.tipo, t.descricao);
    setCategoriaIdSugerida(catId);
    try {
      setSugestoes(await sugerirConciliacao(empresaId, t));
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  function applyParceiroLancar(nome: string) {
    setLancarPessoa(nome);
    const p = parceirosCadastro.find((x) => x.nome === nome);
    if (p) {
      setLancarTipoPessoa(p.tipoPessoa);
      setLancarCnpjCpf(p.cnpjCpf ? formatCpfCnpj(p.cnpjCpf) : "");
    }
  }

  function abrirLancar(t: TransacaoBancaria) {
    const catId = categoriaSugerida(regras, t.tipo, t.descricao) ?? "";
    setLancarAlvo(t);
    setLancarTab("dados");
    setLancarPessoa(t.descricao || "");
    setLancarCategoriaId(catId);
    setLancarTipoPessoa("pj");
    setLancarCnpjCpf("");
    setLancarCentroId("");
    setLancarContaFinId("");
    setLancarObs("");
    setLancarParcelas(1);
    setLancarRecorrencia(null);
    setLancarRecorrenciaDias(30);
    setLancarRecorrenciaOcorrencias(1);
    setLancarErro("");
    const match = parceirosCadastro.find(
      (p) =>
        t.descricao &&
        (t.descricao.toLowerCase().includes(p.nome.toLowerCase().slice(0, 8)) ||
          p.nome.toLowerCase().includes(t.descricao.toLowerCase().slice(0, 8)))
    );
    if (match) applyParceiroLancar(match.nome);
  }

  async function confirmarLancar() {
    if (!lancarAlvo) return;
    if (!lancarPessoa.trim()) {
      setLancarErro("Informe ou selecione o favorecido/pagador.");
      setLancarTab("dados");
      return;
    }
    if (!lancarCategoriaId) {
      setLancarErro("Escolha a categoria.");
      setLancarTab("dados");
      return;
    }
    if (
      lancarRecorrencia === "personalizada" &&
      (!lancarRecorrenciaDias || lancarRecorrenciaDias < 1)
    ) {
      setLancarErro("Informe o intervalo em dias (ex.: 12 ou 20).");
      setLancarTab("parcelas");
      return;
    }
    setLancando(true);
    try {
      const docHint = lancarCnpjCpf.trim()
        ? `${lancarTipoPessoa === "pj" ? "CNPJ" : "CPF"}: ${lancarCnpjCpf.trim()}`
        : "";
      const obsParts = [lancarObs.trim(), docHint].filter(Boolean);
      const res = await conciliacaoService.lancarDeTransacao(empresaId, lancarAlvo.id, {
        pessoa: lancarPessoa.trim(),
        categoriaId: lancarCategoriaId,
        centroCustoId: lancarCentroId || null,
        contaFinanceiraId: lancarAlvo.tipo === "debito" ? lancarContaFinId || null : null,
        observacao: obsParts.join(" · ") || undefined,
        parcelas: lancarParcelas,
        recorrencia: lancarRecorrencia,
        recorrenciaDias: lancarRecorrenciaDias,
        recorrenciaOcorrencias: lancarRecorrenciaOcorrencias,
      });
      bumpData();
      const extras = res.extras ?? 0;
      const destino = res.tipo === "pagar" ? "Contas a Pagar" : "Contas a Receber";
      notify(
        extras > 0
          ? `1ª parcela baixada; +${extras} título(s) em aberto em ${destino}.`
          : res.tipo === "pagar"
            ? "Conta a pagar criada e baixada a partir do extrato."
            : "Conta a receber criada e baixada a partir do extrato."
      );
      setLancarAlvo(null);
    } catch (e) {
      setLancarErro((e as Error).message);
      notify((e as Error).message, "error");
    } finally {
      setLancando(false);
    }
  }

  async function confirmarLote() {
    if (pendentes.length === 0) {
      setLoteOpen(false);
      return;
    }
    setLoteErro("");
    setLancando(true);
    try {
      const res = await conciliacaoService.lancarPendentes(
        empresaId,
        pendentes.map((t) => t.id),
        (t) => {
          const sugerida = categoriaSugerida(regras, t.tipo, t.descricao);
          const categoriaId = sugerida || loteCategoriaId;
          if (!categoriaId) return null;
          // Categoria do lote só vale se o tipo bater (despesa/receita).
          if (!sugerida && loteCategoriaId) {
            const cat = categorias.find((c) => c.id === loteCategoriaId);
            const esperado = t.tipo === "debito" ? "despesa" : "receita";
            if (!cat || cat.tipo !== esperado) return null;
          }
          return {
            pessoa: t.descricao || "Extrato bancário",
            categoriaId,
          };
        }
      );
      bumpData();
      const msg = [
        res.ok ? `${res.ok} lançada(s)` : null,
        res.puladas ? `${res.puladas} pulada(s) (sem categoria)` : null,
        res.erros.length ? `${res.erros.length} erro(s)` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      notify(msg || "Nenhuma transação lançada.", res.ok ? "success" : "info");
      if (res.erros.length) {
        notify(res.erros.slice(0, 3).join(" | "), "error");
      }
      setLoteOpen(false);
    } catch (e) {
      setLoteErro((e as Error).message);
      notify((e as Error).message, "error");
    } finally {
      setLancando(false);
    }
  }

  async function confirmar(s: Sugestao) {
    if (!alvo) return;
    try {
      await conciliacaoService.conciliar(
        empresaId,
        alvo.id,
        s.tipo === "receber" ? { contaReceberId: s.id } : { contaPagarId: s.id }
      );
      bumpData();
      notify("Transação conciliada e baixa registrada.");
      setAlvo(null);
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  async function ignorar(t: TransacaoBancaria) {
    try {
      await conciliacaoService.ignorar(empresaId, t.id);
      bumpData();
      notify("Transação ignorada.");
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  async function desfazer(t: TransacaoBancaria) {
    try {
      await conciliacaoService.desfazer(empresaId, t.id);
      bumpData();
      notify("Conciliação desfeita.");
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  const STATUS_OPTS = ["pendente", "conciliada", "ignorada", "todas"];

  return (
    <>
      <PageHeader
        title="Conciliação Bancária"
        subtitle="Importe o extrato (OFX), concilie com títulos existentes ou lance novos em Contas a Pagar/Receber."
        actions={
          !readOnly ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".ofx,.qfx,text/plain"
                className="hidden"
                onChange={onFile}
              />
              {pendentes.length > 0 && (
                <button
                  className="btn-outline"
                  onClick={() => {
                    setLoteCategoriaId("");
                    setLoteErro("");
                    setLoteOpen(true);
                  }}
                >
                  <PlusCircle className="h-4 w-4" /> Lançar pendentes ({pendentes.length})
                </button>
              )}
              <button className="btn-primary" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" /> Importar OFX
              </button>
            </>
          ) : undefined
        }
      />

      {extratoResumo.length > 0 && (
        <>
          <h2 className="mb-3 text-sm font-semibold">Extratos importados</h2>
          <div className="card mb-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Banco / conta</th>
                  <th className="px-4 py-2.5 font-medium">Período</th>
                  <th className="px-4 py-2.5 text-right font-medium">Transações</th>
                  <th className="px-4 py-2.5 font-medium">Importado em</th>
                  {!readOnly && (
                    <th className="px-4 py-2.5 text-right font-medium">Ações</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {extratoResumo.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{e.banco || "—"}</div>
                      <div className="text-xs text-muted-foreground">{e.conta || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {e.dataInicio && e.dataFim
                        ? `${formatDate(e.dataInicio)} — ${formatDate(e.dataFim)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {e.qtdTransacoes}
                      {e.qtdConciliadas > 0 && (
                        <div className="text-[11px] text-muted-foreground">
                          {e.qtdConciliadas} conciliada{e.qtdConciliadas > 1 ? "s" : ""}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">{formatDate(e.createdAt.slice(0, 10))}</td>
                    {!readOnly && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            className="btn-ghost btn-sm"
                            title="Editar extrato"
                            onClick={() => openEditExtrato(e)}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="btn-ghost btn-sm text-destructive"
                            title="Excluir extrato"
                            onClick={() =>
                              setToDeleteExtrato({
                                id: e.id,
                                banco: e.banco || "—",
                                conta: e.conta || "—",
                                qtdTransacoes: e.qtdTransacoes,
                                qtdConciliadas: e.qtdConciliadas,
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="mb-3 flex flex-wrap gap-1.5">
        {STATUS_OPTS.map((s) => (
          <button
            key={s}
            onClick={() => setFiltro(s)}
            className={`badge cursor-pointer capitalize ${
              filtro === s
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {s === "todas" ? "Todas" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {filtradas.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="Nenhuma transação"
          description="Importe um arquivo OFX do seu banco para iniciar a conciliação."
          action={
            <button className="btn-primary" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Importar OFX
            </button>
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Data</th>
                <th className="px-4 py-2.5 font-medium">Descrição</th>
                <th className="px-4 py-2.5 text-right font-medium">Valor</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Título vinculado</th>
                <th className="px-4 py-2.5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtradas.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30">
                  <td className="whitespace-nowrap px-4 py-3">{formatDate(t.data)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{t.descricao || "—"}</div>
                    {t.documento && (
                      <div className="text-xs text-muted-foreground">Doc: {t.documento}</div>
                    )}
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums ${
                      t.tipo === "credito" ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {formatBRL(t.valor)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUS_STYLE[t.statusConciliacao]}`}>
                      {STATUS_LABEL[t.statusConciliacao]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {t.contaReceberId ? (
                      <EntityLink type="conta-receber" id={t.contaReceberId} />
                    ) : t.contaPagarId ? (
                      <EntityLink type="conta-pagar" id={t.contaPagarId} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1">
                      {!readOnly && t.statusConciliacao === "pendente" && (
                        <>
                          <button
                            className="btn-primary btn-sm"
                            onClick={() => abrirLancar(t)}
                            title={
                              t.tipo === "debito"
                                ? "Criar conta a pagar baixada"
                                : "Criar conta a receber baixada"
                            }
                          >
                            <PlusCircle className="h-3.5 w-3.5" /> Lançar
                          </button>
                          <button
                            className="btn-outline btn-sm"
                            onClick={() => abrirConciliacao(t)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Conciliar
                          </button>
                          <button
                            className="btn-ghost btn-sm text-muted-foreground"
                            title="Ignorar"
                            onClick={() => ignorar(t)}
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {!readOnly && t.statusConciliacao !== "pendente" && (
                        <button
                          className="btn-ghost btn-sm"
                          title="Desfazer"
                          onClick={() => desfazer(t)}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!alvo}
        title="Conciliar transação"
        onClose={() => setAlvo(null)}
        width="max-w-xl"
      >
        {alvo && (
          <div className="space-y-4">
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{formatDate(alvo.data)}</span>
                <span className={alvo.tipo === "credito" ? "text-emerald-600" : "text-red-600"}>
                  {formatBRL(alvo.valor)}
                </span>
              </div>
              <div className="font-medium">{alvo.descricao || "—"}</div>
            </div>

            {categoriaIdSugerida && (
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-200">
                Categoria sugerida:{" "}
                <strong>{catMap.get(categoriaIdSugerida) ?? "—"}</strong>
                <span className="ml-1 text-xs opacity-80">(via regra de conciliação)</span>
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-medium">
                Sugestões ({alvo.tipo === "credito" ? "contas a receber" : "contas a pagar"})
              </p>
              {sugestoes.length === 0 ? (
                <div className="space-y-3">
                  <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                    Nenhum título compatível encontrado. Use <strong>Lançar</strong> para criar um
                    novo em Contas a {alvo.tipo === "credito" ? "Receber" : "Pagar"}.
                  </p>
                  <button
                    className="btn-primary w-full"
                    onClick={() => {
                      setAlvo(null);
                      abrirLancar(alvo);
                    }}
                  >
                    <PlusCircle className="h-4 w-4" /> Lançar novo título
                  </button>
                </div>
              ) : (
                <ul className="space-y-2">
                  {sugestoes.map((s) => (
                    <li
                      key={`${s.tipo}-${s.id}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{s.pessoa}</p>
                        <p className="text-xs text-muted-foreground">
                          Venc. {formatDate(s.dataVencimento)} · saldo {formatBRL(s.saldo)} ·{" "}
                          {s.motivo}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="badge bg-accent text-accent-foreground">{s.score}%</span>
                        <button className="btn-primary btn-sm" onClick={() => confirmar(s)}>
                          Confirmar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              A confirmação registra a baixa (pagamento/recebimento) no título vinculado.
            </p>
          </div>
        )}
      </Modal>

      <Modal
        open={!!lancarAlvo}
        title={
          lancarAlvo?.tipo === "credito"
            ? "Lançar em Contas a Receber"
            : "Lançar em Contas a Pagar"
        }
        onClose={() => !lancando && setLancarAlvo(null)}
        width="max-w-2xl"
        footer={
          <>
            <button className="btn-outline btn-sm" disabled={lancando} onClick={() => setLancarAlvo(null)}>
              Cancelar
            </button>
            <button className="btn-primary btn-sm" disabled={lancando} onClick={confirmarLancar}>
              {lancando ? "Salvando…" : "Confirmar lançamento"}
            </button>
          </>
        }
      >
        {lancarAlvo && (
          <div className="space-y-3 [&_.label]:text-xs">
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs sm:text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">{formatDate(lancarAlvo.data)}</span>
                <span
                  className={
                    lancarAlvo.tipo === "credito"
                      ? "font-medium text-emerald-600"
                      : "font-medium text-red-600"
                  }
                >
                  {formatBRL(lancarAlvo.valor)}
                </span>
              </div>
              <div className="mt-0.5 font-medium leading-snug">{lancarAlvo.descricao || "—"}</div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {lancarParcelas > 1 || (lancarRecorrencia && lancarRecorrenciaOcorrencias > 1)
                  ? "A 1ª parcela/ocorrência é baixada na data do banco; as demais ficam em aberto."
                  : `Título criado já ${
                      lancarAlvo.tipo === "credito" ? "recebido" : "pago"
                    } na data do banco. Competência e vencimento = data do extrato.`}
              </p>
            </div>

            <div className="flex gap-1 border-b border-border">
              {(
                [
                  { id: "dados" as const, label: "Dados" },
                  { id: "parcelas" as const, label: "Parcelas / repetição" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm ${
                    lancarTab === tab.id
                      ? "border-b-2 border-primary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setLancarTab(tab.id)}
                >
                  {tab.label}
                  {tab.id === "parcelas" &&
                    (lancarParcelas > 1 ||
                      (lancarRecorrencia && lancarRecorrenciaOcorrencias > 1)) && (
                      <span className="ml-1 text-[10px] text-primary">●</span>
                    )}
                </button>
              ))}
            </div>

            {lancarTab === "dados" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label="Categoria"
                  required
                  error={lancarErro || undefined}
                  className="sm:col-span-2"
                >
                  <Select
                    value={lancarCategoriaId}
                    onChange={(v) => {
                      setLancarCategoriaId(v);
                      setLancarErro("");
                    }}
                    options={[
                      { value: "", label: "— selecione —" },
                      ...categoriasLancar.map((c) => ({ value: c.id, label: c.nome })),
                    ]}
                  />
                </Field>

                <Field
                  label={
                    lancarAlvo.tipo === "credito" ? "Pagador / cliente" : "Favorecido / fornecedor"
                  }
                  required
                  hint="Busque cliente ou fornecedor cadastrado, ou digite um nome livre."
                  className="sm:col-span-2"
                >
                  <SearchableSelect
                    value={lancarPessoa}
                    onChange={applyParceiroLancar}
                    allowFreeText
                    placeholder="Buscar cliente ou fornecedor…"
                    searchPlaceholder="Digite nome ou documento…"
                    options={parceiroOptions}
                  />
                </Field>

                <Field label="Tipo">
                  <Select
                    value={lancarTipoPessoa}
                    onChange={(v) => {
                      setLancarTipoPessoa(v as TipoPessoa);
                      setLancarCnpjCpf("");
                    }}
                    options={[
                      { value: "pj", label: "Pessoa jurídica (CNPJ)" },
                      { value: "pf", label: "Pessoa física (CPF)" },
                    ]}
                  />
                </Field>
                <Field
                  label={lancarTipoPessoa === "pj" ? "CNPJ" : "CPF"}
                  hint="Opcional (informativo)."
                >
                  <input
                    className="input h-9 uppercase"
                    inputMode={lancarTipoPessoa === "pj" ? "text" : "numeric"}
                    maxLength={18}
                    value={lancarCnpjCpf}
                    onChange={(e) => setLancarCnpjCpf(formatCpfCnpj(e.target.value))}
                    placeholder={
                      lancarTipoPessoa === "pj" ? "00.000.000/0000-00" : "000.000.000-00"
                    }
                  />
                </Field>

                <Field label="Valor (R$)">
                  <input
                    className="input h-9 bg-muted/40"
                    readOnly
                    value={Math.abs(lancarAlvo.valor).toFixed(2)}
                  />
                </Field>
                <Field label="Status">
                  <input
                    className="input h-9 bg-muted/40"
                    readOnly
                    value={
                      lancarParcelas > 1 ||
                      (lancarRecorrencia && lancarRecorrenciaOcorrencias > 1)
                        ? `1ª ${lancarAlvo.tipo === "credito" ? "recebida" : "paga"}; demais em aberto`
                        : lancarAlvo.tipo === "credito"
                          ? "Recebida"
                          : "Paga"
                    }
                  />
                </Field>

                <Field label="Competência">
                  <input
                    className="input h-9 bg-muted/40"
                    readOnly
                    value={formatDate(lancarAlvo.data)}
                  />
                </Field>
                <Field label="Vencimento">
                  <input
                    className="input h-9 bg-muted/40"
                    readOnly
                    value={formatDate(lancarAlvo.data)}
                  />
                </Field>

                {lancarAlvo.tipo === "debito" && (
                  <Field label="Conta / Cartão">
                    <Select
                      value={lancarContaFinId}
                      onChange={setLancarContaFinId}
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
                <Field
                  label="Centro de custo"
                  className={lancarAlvo.tipo === "credito" ? "sm:col-span-2" : undefined}
                >
                  <Select
                    value={lancarCentroId}
                    onChange={setLancarCentroId}
                    options={[
                      { value: "", label: "— sem centro —" },
                      ...centros.map((c) => ({ value: c.id, label: c.nome })),
                    ]}
                  />
                </Field>

                <Field label="Observação" className="sm:col-span-2">
                  <textarea
                    className="input min-h-[4rem] py-2 text-sm"
                    rows={2}
                    value={lancarObs}
                    onChange={(e) => setLancarObs(e.target.value)}
                    placeholder="Opcional"
                  />
                </Field>
              </div>
            )}

            {lancarTab === "parcelas" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  O valor do extrato ({formatBRL(Math.abs(lancarAlvo.valor))}) é o valor de cada
                  parcela/ocorrência — não é dividido. A 1ª fica baixada; as demais entram em{" "}
                  {lancarAlvo.tipo === "credito" ? "Contas a Receber" : "Contas a Pagar"} em aberto.
                </p>
                {lancarErro && lancarTab === "parcelas" && (
                  <p className="text-xs text-destructive">{lancarErro}</p>
                )}
                <ParcelasRepeticaoFields
                  parcelas={lancarParcelas}
                  recorrencia={lancarRecorrencia}
                  recorrenciaDias={lancarRecorrenciaDias}
                  recorrenciaOcorrencias={lancarRecorrenciaOcorrencias}
                  editing={false}
                  onChange={(partial) => {
                    if (partial.parcelas !== undefined) setLancarParcelas(partial.parcelas);
                    if (partial.recorrencia !== undefined) setLancarRecorrencia(partial.recorrencia);
                    if (partial.recorrenciaDias !== undefined) {
                      setLancarRecorrenciaDias(partial.recorrenciaDias);
                    }
                    if (partial.recorrenciaOcorrencias !== undefined) {
                      setLancarRecorrenciaOcorrencias(partial.recorrenciaOcorrencias);
                    }
                    setLancarErro("");
                  }}
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={loteOpen}
        title="Lançar pendentes do extrato"
        onClose={() => !lancando && setLoteOpen(false)}
        width="max-w-lg"
        footer={
          <>
            <button className="btn-outline" disabled={lancando} onClick={() => setLoteOpen(false)}>
              Cancelar
            </button>
            <button className="btn-primary" disabled={lancando} onClick={confirmarLote}>
              {lancando ? "Lançando…" : `Lançar até ${pendentes.length}`}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Cada pendente vira Conta a Pagar (débito) ou Conta a Receber (crédito), já baixada.
            Linhas com regra de conciliação usam a categoria sugerida; as demais usam a categoria
            abaixo (quando o tipo bater).
          </p>
          <Field
            label="Categoria padrão (opcional)"
            hint="Usada só quando não houver regra. Escolha uma de despesa ou de receita — só as linhas do mesmo tipo serão lançadas com ela."
            error={loteErro || undefined}
          >
            <Select
              value={loteCategoriaId}
              onChange={setLoteCategoriaId}
              options={[
                { value: "", label: "— só usar categorias das regras —" },
                ...categorias
                  .filter((c) => c.ativo)
                  .map((c) => ({
                    value: c.id,
                    label: `${c.nome} (${c.tipo === "despesa" ? "despesa" : "receita"})`,
                  })),
              ]}
            />
          </Field>
          <p className="text-xs text-muted-foreground">
            Pendentes sem categoria sugerida e sem categoria padrão compatível serão puladas.
          </p>
        </div>
      </Modal>

      <Modal
        open={!!editExtrato}
        title="Editar extrato importado"
        onClose={() => !editSaving && setEditExtrato(null)}
        width="max-w-lg"
        footer={
          <>
            <button
              className="btn-outline"
              disabled={editSaving}
              onClick={() => setEditExtrato(null)}
            >
              Cancelar
            </button>
            <button className="btn-primary" disabled={editSaving} onClick={salvarEditExtrato}>
              {editSaving ? "Salvando…" : "Salvar"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Banco">
            <input
              className="input"
              value={editBanco}
              onChange={(e) => setEditBanco(e.target.value)}
              placeholder="Código ou nome do banco"
            />
          </Field>
          <Field label="Conta">
            <input
              className="input"
              value={editConta}
              onChange={(e) => setEditConta(e.target.value)}
              placeholder="Agência / conta"
            />
          </Field>
          <Field label="Início do período">
            <DatePicker value={editInicio} onChange={setEditInicio} placeholder="Opcional" />
          </Field>
          <Field label="Fim do período">
            <DatePicker value={editFim} onChange={setEditFim} placeholder="Opcional" />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDeleteExtrato}
        title="Excluir extrato importado"
        destructive
        confirmLabel={deletingExtrato ? "Excluindo…" : "Excluir"}
        onCancel={() => !deletingExtrato && setToDeleteExtrato(null)}
        onConfirm={() => {
          if (!deletingExtrato) void confirmDeleteExtrato();
        }}
        message={
          toDeleteExtrato ? (
            <div className="space-y-3">
              <p>
                Extrato <span className="font-medium text-foreground">{toDeleteExtrato.banco}</span>
                {" / "}
                <span className="font-medium text-foreground">{toDeleteExtrato.conta}</span>
                {toDeleteExtrato.qtdTransacoes > 0
                  ? ` · ${toDeleteExtrato.qtdTransacoes} transação(ões)`
                  : null}
                .
              </p>
              {toDeleteExtrato.qtdConciliadas > 0 ? (
                <p>
                  Há{" "}
                  <span className="font-medium text-destructive">
                    {toDeleteExtrato.qtdConciliadas} transação(ões) já conciliada(s)
                  </span>
                  . Ao confirmar,{" "}
                  <span className="font-medium text-destructive">tudo deste extrato será excluído</span>{" "}
                  (pendentes, conciliadas e ignoradas). Esta ação é irreversível.
                </p>
              ) : (
                <p>
                  Nenhuma linha foi conciliada ainda. O extrato importado e suas transações serão
                  removidos. Esta ação é irreversível.
                </p>
              )}
              <p className="text-xs">
                Títulos já criados em Contas a Pagar/Receber não são apagados automaticamente.
              </p>
            </div>
          ) : (
            ""
          )
        }
      />
    </>
  );
}

export function ConciliacaoPage() {
  return <RequireEmpresa>{(id) => <Inner empresaId={id} />}</RequireEmpresa>;
}
