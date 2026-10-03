import { useMemo, useRef, useState } from "react";
import { Landmark, Upload, CheckCircle2, Ban, RotateCcw, PlusCircle } from "lucide-react";
import type { Categoria, ExtratoBancario, RegraConciliacao, TransacaoBancaria } from "@/types/domain";
import {
  conciliacaoService,
  categoriaSugerida,
  regraService,
  sugerirConciliacao,
  type Sugestao,
} from "@/data/conciliacao";
import { categoriaService } from "@/data/services";
import { parseOFX } from "@/lib/ofx";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatBRL, formatDate } from "@/lib/utils";
import { canWrite } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
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
  const catMap = useMemo(() => new Map(categorias.map((c) => [c.id, c.nome])), [categorias]);

  const [filtro, setFiltro] = useState<string>("pendente");

  const [alvo, setAlvo] = useState<TransacaoBancaria | null>(null);
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [categoriaIdSugerida, setCategoriaIdSugerida] = useState<string | null>(null);

  const [lancarAlvo, setLancarAlvo] = useState<TransacaoBancaria | null>(null);
  const [lancarPessoa, setLancarPessoa] = useState("");
  const [lancarCategoriaId, setLancarCategoriaId] = useState("");
  const [lancarErro, setLancarErro] = useState("");
  const [lancando, setLancando] = useState(false);

  const [loteOpen, setLoteOpen] = useState(false);
  const [loteCategoriaId, setLoteCategoriaId] = useState("");
  const [loteErro, setLoteErro] = useState("");

  const extratoResumo = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of transacoes) {
      if (t.extratoId) counts.set(t.extratoId, (counts.get(t.extratoId) ?? 0) + 1);
    }
    return extratos.map((e) => ({ ...e, qtdTransacoes: counts.get(e.id) ?? 0 }));
  }, [extratos, transacoes]);

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

  function abrirLancar(t: TransacaoBancaria) {
    const catId = categoriaSugerida(regras, t.tipo, t.descricao) ?? "";
    setLancarAlvo(t);
    setLancarPessoa(t.descricao || "");
    setLancarCategoriaId(catId);
    setLancarErro("");
  }

  async function confirmarLancar() {
    if (!lancarAlvo) return;
    if (!lancarPessoa.trim()) {
      setLancarErro("Informe o nome da pessoa.");
      return;
    }
    if (!lancarCategoriaId) {
      setLancarErro("Escolha a categoria.");
      return;
    }
    setLancando(true);
    try {
      const res = await conciliacaoService.lancarDeTransacao(empresaId, lancarAlvo.id, {
        pessoa: lancarPessoa.trim(),
        categoriaId: lancarCategoriaId,
      });
      bumpData();
      notify(
        res.tipo === "pagar"
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
                    <td className="px-4 py-3 text-right tabular-nums">{e.qtdTransacoes}</td>
                    <td className="px-4 py-3">{formatDate(e.createdAt.slice(0, 10))}</td>
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
        width="max-w-lg"
        footer={
          <>
            <button className="btn-outline" disabled={lancando} onClick={() => setLancarAlvo(null)}>
              Cancelar
            </button>
            <button className="btn-primary" disabled={lancando} onClick={confirmarLancar}>
              {lancando ? "Salvando…" : "Confirmar lançamento"}
            </button>
          </>
        }
      >
        {lancarAlvo && (
          <div className="space-y-4">
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{formatDate(lancarAlvo.data)}</span>
                <span
                  className={lancarAlvo.tipo === "credito" ? "text-emerald-600" : "text-red-600"}
                >
                  {formatBRL(lancarAlvo.valor)}
                </span>
              </div>
              <div className="font-medium">{lancarAlvo.descricao || "—"}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                O título será criado já{" "}
                {lancarAlvo.tipo === "credito" ? "recebido" : "pago"} na data do banco.
              </p>
            </div>
            <Field
              label={lancarAlvo.tipo === "credito" ? "Pagador / cliente" : "Favorecido / fornecedor"}
              required
            >
              <input
                className="input"
                value={lancarPessoa}
                onChange={(e) => setLancarPessoa(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label="Categoria" required error={lancarErro || undefined}>
              <Select
                value={lancarCategoriaId}
                onChange={setLancarCategoriaId}
                options={[
                  { value: "", label: "— selecione —" },
                  ...categoriasLancar.map((c) => ({ value: c.id, label: c.nome })),
                ]}
              />
            </Field>
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
    </>
  );
}

export function ConciliacaoPage() {
  return <RequireEmpresa>{(id) => <Inner empresaId={id} />}</RequireEmpresa>;
}
