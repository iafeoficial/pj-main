import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, CheckCircle2, Ban } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Categoria, CategoriaTipo, CentroCusto } from "@/types/domain";
import { categoriaService, centroCustoService } from "@/data/services";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { usePermissions } from "@/hooks/usePermissions";
import { formatBRL, formatDate, today } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

/** Forma comum de uma conta a pagar/receber para a UI. */
export interface ContaLike {
  id: string;
  empresaId: string;
  pessoa: string; // fornecedor ou cliente
  categoriaId: string | null;
  centroCustoId: string | null;
  valor: number;
  valorBaixado: number; // valorPago ou valorRecebido
  dataCompetencia: string;
  dataVencimento: string;
  dataBaixa: string | null;
  status: string;
  observacao: string;
}

export interface ContasConfig {
  titulo: string;
  subtitulo: string;
  icon: LucideIcon;
  pessoaLabel: string; // "Fornecedor" | "Cliente"
  categoriaTipo: CategoriaTipo; // despesa | receita
  baixaLabel: string; // "Registrar pagamento" | "Registrar recebimento"
  statusBaixado: string; // "paga" | "recebida"
  // Operações (mapeiam para os services específicos) — assíncronas (Supabase)
  list: (empresaId: string) => Promise<ContaLike[]>;
  create: (empresaId: string, input: ContaFormData) => Promise<unknown>;
  update: (empresaId: string, id: string, input: ContaFormData) => Promise<unknown>;
  baixar: (empresaId: string, id: string, valor: number, data: string) => Promise<unknown>;
  cancelar: (empresaId: string, id: string) => Promise<unknown>;
  remove: (empresaId: string, id: string) => Promise<unknown>;
}

export interface ContaFormData {
  pessoa: string;
  categoriaId: string | null;
  centroCustoId: string | null;
  valor: number;
  dataCompetencia: string;
  dataVencimento: string;
  status: "rascunho" | "aberta";
  observacao: string;
}

const EMPTY_FORM = (): ContaFormData => ({
  pessoa: "",
  categoriaId: null,
  centroCustoId: null,
  valor: 0,
  dataCompetencia: today(),
  dataVencimento: today(),
  status: "aberta",
  observacao: "",
});

export function ContasModule({
  empresaId,
  config,
}: {
  empresaId: string;
  config: ContasConfig;
}) {
  const { version, bumpData } = useEmpresa();
  const { canWrite } = usePermissions();
  const { notify } = useToast();

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
  const { data: centros } = useAsyncData(
    () => centroCustoService.listAtivos(empresaId),
    [empresaId, version],
    [] as CentroCusto[]
  );
  const { data: todasCategorias } = useAsyncData(
    () => categoriaService.list(empresaId),
    [empresaId, version],
    [] as Categoria[]
  );
  const catMap = useMemo(
    () => new Map(todasCategorias.map((c) => [c.id, c.nome])),
    [todasCategorias]
  );

  const [filtroStatus, setFiltroStatus] = useState<string>("todos");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ContaFormData>(EMPTY_FORM());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [baixaConta, setBaixaConta] = useState<ContaLike | null>(null);
  const [baixaValor, setBaixaValor] = useState(0);
  const [baixaData, setBaixaData] = useState(today());

  const [toDelete, setToDelete] = useState<ContaLike | null>(null);
  const [toCancel, setToCancel] = useState<ContaLike | null>(null);

  const filtradas = useMemo(
    () => (filtroStatus === "todos" ? contas : contas.filter((c) => c.status === filtroStatus)),
    [contas, filtroStatus]
  );

  const totais = useMemo(() => {
    const ativas = contas.filter((c) => c.status !== "cancelada");
    const total = ativas.reduce((s, c) => s + c.valor, 0);
    const baixado = ativas.reduce((s, c) => s + c.valorBaixado, 0);
    const emAberto = ativas
      .filter((c) => c.status !== config.statusBaixado)
      .reduce((s, c) => s + (c.valor - c.valorBaixado), 0);
    return { total, baixado, emAberto };
  }, [contas, config.statusBaixado]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM());
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(c: ContaLike) {
    setEditingId(c.id);
    setForm({
      pessoa: c.pessoa,
      categoriaId: c.categoriaId,
      centroCustoId: c.centroCustoId,
      valor: c.valor,
      dataCompetencia: c.dataCompetencia,
      dataVencimento: c.dataVencimento,
      status: c.status === "rascunho" ? "rascunho" : "aberta",
      observacao: c.observacao,
    });
    setErrors({});
    setModalOpen(true);
  }

  function validate(): boolean {
    const err: Record<string, string> = {};
    if (!form.pessoa.trim()) err.pessoa = `Informe o ${config.pessoaLabel.toLowerCase()}.`;
    if (!form.valor || form.valor <= 0) err.valor = "Informe um valor maior que zero.";
    if (!form.dataVencimento) err.dataVencimento = "Informe o vencimento.";
    setErrors(err);
    return Object.keys(err).length === 0;
  }

  async function save() {
    if (!validate()) return;
    try {
      if (editingId) {
        await config.update(empresaId, editingId, form);
        notify("Lançamento atualizado.");
      } else {
        await config.create(empresaId, form);
        notify("Lançamento criado.");
      }
      bumpData();
      setModalOpen(false);
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  function openBaixa(c: ContaLike) {
    setBaixaConta(c);
    setBaixaValor(Number((c.valor - c.valorBaixado).toFixed(2)));
    setBaixaData(today());
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
    if (!toDelete) return;
    try {
      await config.remove(empresaId, toDelete.id);
      bumpData();
      notify("Lançamento excluído.");
    } catch (e) {
      notify((e as Error).message, "error");
    }
    setToDelete(null);
  }

  const STATUS_OPTS = ["todos", "aberta", "parcial", config.statusBaixado, "vencida", "rascunho", "cancelada"];

  return (
    <>
      <PageHeader
        title={config.titulo}
        subtitle={config.subtitulo}
        actions={
          canWrite ? (
            <button className="btn-primary" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Novo lançamento
            </button>
          ) : undefined
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Total" value={formatBRL(totais.total)} />
        <SummaryCard label={`Já ${config.statusBaixado === "paga" ? "pago" : "recebido"}`} value={formatBRL(totais.baixado)} tone="success" />
        <SummaryCard label="Em aberto" value={formatBRL(totais.emAberto)} tone="warning" />
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
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
      </div>

      {filtradas.length === 0 ? (
        <EmptyState
          icon={config.icon}
          title="Nenhum lançamento"
          description="Crie um lançamento ou ajuste o filtro de status."
          action={
            canWrite ? (
              <button className="btn-primary" onClick={openCreate}>
                <Plus className="h-4 w-4" /> Novo lançamento
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">{config.pessoaLabel}</th>
                <th className="px-4 py-2.5 font-medium">Categoria</th>
                <th className="px-4 py-2.5 font-medium">Vencimento</th>
                <th className="px-4 py-2.5 text-right font-medium">Valor</th>
                <th className="px-4 py-2.5 text-right font-medium">Saldo</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtradas.map((c) => {
                const saldo = c.valor - c.valorBaixado;
                const baixavel = c.status !== config.statusBaixado && c.status !== "cancelada";
                return (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{c.pessoa}</div>
                      {c.observacao && (
                        <div className="text-xs text-muted-foreground">{c.observacao}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.categoriaId ? catMap.get(c.categoriaId) ?? "—" : "—"}
                    </td>
                    <td className="px-4 py-3">{formatDate(c.dataVencimento)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatBRL(c.valor)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatBRL(saldo)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {canWrite && baixavel && (
                          <button
                            className="btn-outline btn-sm"
                            title={config.baixaLabel}
                            onClick={() => openBaixa(c)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Baixar
                          </button>
                        )}
                        {canWrite && (
                          <>
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
                              onClick={() => setToDelete(c)}
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
        title={editingId ? "Editar lançamento" : "Novo lançamento"}
        onClose={() => setModalOpen(false)}
        width="max-w-xl"
        footer={
          <>
            <button className="btn-outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={save}>
              Salvar
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={config.pessoaLabel} required error={errors.pessoa} className="sm:col-span-2">
            <input
              className="input"
              value={form.pessoa}
              onChange={(e) => setForm({ ...form, pessoa: e.target.value })}
              autoFocus
            />
          </Field>
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
            <select
              className="input"
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as ContaFormData["status"] })
              }
            >
              <option value="aberta">Aberta</option>
              <option value="rascunho">Rascunho</option>
            </select>
          </Field>
          <Field label="Competência">
            <input
              className="input"
              type="date"
              value={form.dataCompetencia}
              onChange={(e) => setForm({ ...form, dataCompetencia: e.target.value })}
            />
          </Field>
          <Field label="Vencimento" required error={errors.dataVencimento}>
            <input
              className="input"
              type="date"
              value={form.dataVencimento}
              onChange={(e) => setForm({ ...form, dataVencimento: e.target.value })}
            />
          </Field>
          <Field label="Categoria">
            <select
              className="input"
              value={form.categoriaId ?? ""}
              onChange={(e) =>
                setForm({ ...form, categoriaId: e.target.value || null })
              }
            >
              <option value="">— sem categoria —</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Centro de custo">
            <select
              className="input"
              value={form.centroCustoId ?? ""}
              onChange={(e) =>
                setForm({ ...form, centroCustoId: e.target.value || null })
              }
            >
              <option value="">— sem centro —</option>
              {centros.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Observação" className="sm:col-span-2">
            <input
              className="input"
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            />
          </Field>
        </div>
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
                {formatBRL(baixaConta.valor - baixaConta.valorBaixado)}
              </span>
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
                <input
                  className="input"
                  type="date"
                  value={baixaData}
                  onChange={(e) => setBaixaData(e.target.value)}
                />
              </Field>
            </div>
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
        open={!!toDelete}
        title="Excluir lançamento"
        message="Esta ação remove o lançamento permanentemente. Confirmar?"
        confirmLabel="Excluir"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning";
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
      <p className={`mt-1 text-lg font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
