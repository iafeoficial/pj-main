import { useMemo, useState, type DragEvent } from "react";
import { Target, Plus, Pencil, Trash2, ShoppingBag, List, LayoutGrid } from "lucide-react";
import type { Cliente, FonteLead, Oportunidade, OportunidadeEstagio, Vendedor } from "@/types/domain";
import { oportunidadeService } from "@/data/operacao";
import { clienteService, vendedorService } from "@/data/cadastros";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useFormDraft } from "@/hooks/useFormDraft";
import { formatBRL } from "@/lib/utils";
import { canWrite } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RequireEmpresa } from "@/components/RequireEmpresa";
import { useToast } from "@/components/ui/Toast";
import { EntityLink } from "@/components/EntityLink";
import {
  ParceiroForm,
  emptyParceiroForm,
  parceiroToPayload,
  type ParceiroFormData,
} from "@/features/cadastros/ParceiroForm";

const ESTAGIOS: { key: OportunidadeEstagio; label: string; style: string }[] = [
  { key: "lead", label: "Lead", style: "bg-zinc-100 text-zinc-700" },
  { key: "qualificado", label: "Qualificado", style: "bg-blue-100 text-blue-700" },
  { key: "proposta", label: "Proposta", style: "bg-amber-100 text-amber-700" },
  { key: "ganho", label: "Ganho", style: "bg-emerald-100 text-emerald-700" },
  { key: "perdido", label: "Perdido", style: "bg-red-100 text-red-700" },
];
const estagioInfo = (e: string) => ESTAGIOS.find((x) => x.key === e) ?? ESTAGIOS[0];

type ViewMode = "lista" | "kanban";
type FiltroEstagio = "todos" | OportunidadeEstagio;

const FILTRO_OPTS: FiltroEstagio[] = ["todos", ...ESTAGIOS.map((e) => e.key)];
const filtroLabel = (f: FiltroEstagio) => (f === "todos" ? "Todos" : estagioInfo(f).label);

const FONTES_LEAD: { value: FonteLead; label: string }[] = [
  { value: "indicacao", label: "Indicação" },
  { value: "site", label: "Site" },
  { value: "redes", label: "Redes sociais" },
  { value: "evento", label: "Evento" },
  { value: "outro", label: "Outro" },
];

interface FormState {
  titulo: string;
  clienteId: string;
  clienteNome: string;
  vendedorId: string;
  contato: string;
  valorEstimado: number;
  estagio: OportunidadeEstagio;
  dataPrevisaoFechamento: string;
  fonteLead: FonteLead | "";
  observacao: string;
}
const EMPTY: FormState = {
  titulo: "",
  clienteId: "",
  clienteNome: "",
  vendedorId: "",
  contato: "",
  valorEstimado: 0,
  estagio: "lead",
  dataPrevisaoFechamento: "",
  fonteLead: "",
  observacao: "",
};

const NOVO_CLIENTE = "__novo_cliente__";

function Inner({ empresaId }: { empresaId: string }) {
  const { version, bumpData, papel } = useEmpresa();
  const readOnly = !canWrite(papel);
  const { notify } = useToast();
  const { data: oportunidades } = useAsyncData(
    () => oportunidadeService.list(empresaId),
    [empresaId, version],
    [] as Oportunidade[]
  );
  const { data: clientes } = useAsyncData(
    () => clienteService.listAtivos(empresaId),
    [empresaId, version],
    [] as Cliente[]
  );
  const { data: vendedores } = useAsyncData(
    () => vendedorService.listAtivos(empresaId),
    [empresaId, version],
    [] as Vendedor[]
  );

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Oportunidade | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState("");
  const [toDelete, setToDelete] = useState<Oportunidade | null>(null);
  const [convertendo, setConvertendo] = useState<string | null>(null);
  const [clienteModalOpen, setClienteModalOpen] = useState(false);
  const [novoCliente, setNovoCliente] = useState<ParceiroFormData>(() => emptyParceiroForm());
  const [clienteError, setClienteError] = useState("");
  const [view, setView] = useState<ViewMode>("lista");
  const [filtroEstagio, setFiltroEstagio] = useState<FiltroEstagio>("todos");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<OportunidadeEstagio | null>(null);

  const { clearDraft } = useFormDraft(
    "crm",
    { open, form, editingId: editing?.id ?? null },
    (draft) => {
      setForm(draft.form);
      setEditing(draft.editingId ? ({ id: draft.editingId } as Oportunidade) : null);
      setOpen(true);
      notify("Rascunho restaurado.", "info");
    }
  );

  const { clearDraft: clearClienteDraft } = useFormDraft(
    "crm-cliente",
    { open: clienteModalOpen, form: novoCliente, editingId: null },
    (draft) => {
      setNovoCliente(draft.form);
      setClienteModalOpen(true);
      notify("Rascunho restaurado.", "info");
    }
  );

  function closeModal() {
    clearDraft();
    setOpen(false);
  }

  function closeClienteModal() {
    clearClienteDraft();
    setClienteModalOpen(false);
  }

  function openCreate() {
    clearDraft();
    setEditing(null);
    setForm(EMPTY);
    setError("");
    setOpen(true);
  }

  function openEdit(o: Oportunidade) {
    clearDraft();
    setEditing(o);
    setForm({
      titulo: o.titulo,
      clienteId: o.clienteId ?? "",
      clienteNome: o.clienteNome,
      vendedorId: o.vendedorId ?? "",
      contato: o.contato,
      valorEstimado: o.valorEstimado,
      estagio: o.estagio,
      dataPrevisaoFechamento: o.dataPrevisaoFechamento ?? "",
      fonteLead: o.fonteLead ?? "",
      observacao: o.observacao,
    });
    setError("");
    setOpen(true);
  }

  function onClienteChange(clienteId: string) {
    const c = clientes.find((x) => x.id === clienteId);
    setForm({
      ...form,
      clienteId,
      clienteNome: c?.nome ?? "",
      contato: c?.email || c?.telefone || form.contato,
    });
  }

  function openNovoClienteModal() {
    clearClienteDraft();
    setNovoCliente(emptyParceiroForm());
    setClienteError("");
    setClienteModalOpen(true);
  }

  function onClienteSelectChange(clienteId: string) {
    if (clienteId === NOVO_CLIENTE) {
      openNovoClienteModal();
      return;
    }
    onClienteChange(clienteId);
  }

  async function salvarNovoCliente() {
    if (!novoCliente.nome.trim()) {
      setClienteError("Informe o nome.");
      return;
    }
    try {
      const c = await clienteService.create(empresaId, parceiroToPayload(novoCliente));
      bumpData();
      setForm({
        ...form,
        clienteId: c.id,
        clienteNome: c.nome,
        contato: c.email || c.telefone || form.contato,
      });
      clearClienteDraft();
      setClienteModalOpen(false);
      notify("Cliente criado.");
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  async function save() {
    if (!form.titulo.trim()) {
      setError("Informe o título.");
      return;
    }
    const payload = {
      titulo: form.titulo,
      clienteId: form.clienteId || null,
      clienteNome: form.clienteNome,
      vendedorId: form.vendedorId || null,
      contato: form.contato,
      valorEstimado: form.valorEstimado,
      estagio: form.estagio,
      dataPrevisaoFechamento: form.dataPrevisaoFechamento || null,
      fonteLead: form.fonteLead || null,
      observacao: form.observacao,
    };
    try {
      if (editing) {
        await oportunidadeService.update(empresaId, editing.id, payload);
        notify("Oportunidade atualizada.");
      } else {
        await oportunidadeService.create(empresaId, {
          ...payload,
          pedidoVendaId: null,
        });
        notify("Oportunidade criada.");
      }
      clearDraft();
      bumpData();
      setOpen(false);
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await oportunidadeService.remove(empresaId, toDelete.id);
      bumpData();
      notify("Oportunidade excluída.");
    } catch (e) {
      notify((e as Error).message, "error");
    }
    setToDelete(null);
  }

  async function criarVenda(o: Oportunidade) {
    setConvertendo(o.id);
    try {
      const pedido = await oportunidadeService.converterParaVenda(empresaId, o.id);
      bumpData();
      notify(`Venda criada. Acesse em Vendas para faturar.`);
      void pedido;
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setConvertendo(null);
    }
  }

  const totalPipeline = oportunidades
    .filter((o) => o.estagio !== "perdido" && o.estagio !== "ganho")
    .reduce((s, o) => s + o.valorEstimado, 0);

  const filtradas = useMemo(
    () =>
      filtroEstagio === "todos" ? oportunidades : oportunidades.filter((o) => o.estagio === filtroEstagio),
    [oportunidades, filtroEstagio]
  );

  async function moverEstagio(o: Oportunidade, novoEstagio: OportunidadeEstagio) {
    if (readOnly || o.estagio === novoEstagio) return;
    try {
      await oportunidadeService.update(empresaId, o.id, { estagio: novoEstagio });
      bumpData();
      notify("Estágio atualizado.");
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  function onDragStart(e: DragEvent, id: string) {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(id);
  }

  function onDragEnd() {
    setDraggingId(null);
    setDropTarget(null);
  }

  function onColumnDragOver(e: DragEvent, estagio: OportunidadeEstagio) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(estagio);
  }

  function onColumnDrop(e: DragEvent, estagio: OportunidadeEstagio) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const o = oportunidades.find((x) => x.id === id);
    setDraggingId(null);
    setDropTarget(null);
    if (o) void moverEstagio(o, estagio);
  }

  return (
    <>
      <PageHeader
        title="CRM — Oportunidades"
        subtitle={`Pipeline em aberto: ${formatBRL(totalPipeline)}`}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-border p-0.5">
              <button
                type="button"
                className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-medium transition-colors ${
                  view === "lista"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
                onClick={() => setView("lista")}
              >
                <List className="h-4 w-4" /> Lista
              </button>
              <button
                type="button"
                className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-medium transition-colors ${
                  view === "kanban"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
                onClick={() => setView("kanban")}
              >
                <LayoutGrid className="h-4 w-4" /> Kanban
              </button>
            </div>
            {!readOnly && (
              <button className="btn-primary" onClick={openCreate}>
                <Plus className="h-4 w-4" /> Nova oportunidade
              </button>
            )}
          </div>
        }
      />

      {oportunidades.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Nenhuma oportunidade"
          description="Registre leads e acompanhe o estágio até o fechamento."
          action={
            <button className="btn-primary" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Nova oportunidade
            </button>
          }
        />
      ) : view === "lista" ? (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {FILTRO_OPTS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltroEstagio(f)}
                className={`badge cursor-pointer ${
                  filtroEstagio === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {filtroLabel(f)}
              </button>
            ))}
          </div>

          {filtradas.length === 0 ? (
            <div className="card p-8 text-center text-sm text-muted-foreground">
              Nenhuma oportunidade neste estágio.
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Título</th>
                    <th className="px-4 py-2.5 font-medium">Cliente / contato</th>
                    <th className="px-4 py-2.5 text-right font-medium">Valor estimado</th>
                    <th className="px-4 py-2.5 font-medium">Estágio</th>
                    <th className="px-4 py-2.5 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtradas.map((o) => {
                    const info = estagioInfo(o.estagio);
                    return (
                      <tr key={o.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="font-medium">{o.titulo}</div>
                          {o.observacao && <div className="text-xs text-muted-foreground">{o.observacao}</div>}
                          {o.pedidoVendaId && (
                            <div className="mt-1">
                              <EntityLink type="venda" id={o.pedidoVendaId} label="Ver venda" />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div>{o.clienteNome || "—"}</div>
                          <div className="text-xs text-muted-foreground">{o.contato}</div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatBRL(o.valorEstimado)}</td>
                        <td className="px-4 py-3">
                          <span className={`badge ${info.style}`}>{info.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            {!readOnly && o.estagio === "ganho" && !o.pedidoVendaId && (
                              <button
                                className="btn-outline btn-sm"
                                disabled={convertendo === o.id}
                                onClick={() => criarVenda(o)}
                              >
                                <ShoppingBag className="h-3.5 w-3.5" /> Criar venda
                              </button>
                            )}
                            {!readOnly && (
                              <>
                                <button className="btn-ghost btn-sm" onClick={() => openEdit(o)}>
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button className="btn-ghost btn-sm text-destructive" onClick={() => setToDelete(o)}>
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
        </>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-2">
          <div className="flex min-w-max gap-3">
            {ESTAGIOS.map((est) => {
              const items = oportunidades.filter((o) => o.estagio === est.key);
              const totalCol = items.reduce((s, o) => s + o.valorEstimado, 0);
              const isDropTarget = dropTarget === est.key;
              return (
                <div
                  key={est.key}
                  className={`flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30 ${
                    isDropTarget ? "border-primary ring-2 ring-primary/20" : "border-border"
                  }`}
                  onDragOver={(e) => onColumnDragOver(e, est.key)}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={(e) => onColumnDrop(e, est.key)}
                >
                  <div className="border-b border-border px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`badge ${est.style}`}>{est.label}</span>
                      <span className="text-xs text-muted-foreground">{items.length}</span>
                    </div>
                    <div className="mt-1 text-xs tabular-nums text-muted-foreground">{formatBRL(totalCol)}</div>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-2">
                    {items.map((o) => (
                      <div
                        key={o.id}
                        draggable={!readOnly}
                        onDragStart={(e) => onDragStart(e, o.id)}
                        onDragEnd={onDragEnd}
                        onClick={() => openEdit(o)}
                        className={`card cursor-pointer p-3 shadow-sm transition-opacity hover:shadow-md ${
                          draggingId === o.id ? "opacity-50" : ""
                        } ${!readOnly ? "cursor-grab active:cursor-grabbing" : ""}`}
                      >
                        <div className="font-medium leading-snug">{o.titulo}</div>
                        {o.clienteNome && (
                          <div className="mt-1 text-sm text-muted-foreground">{o.clienteNome}</div>
                        )}
                        <div className="mt-2 text-sm font-medium tabular-nums">{formatBRL(o.valorEstimado)}</div>
                        {o.contato && <div className="mt-1 truncate text-xs text-muted-foreground">{o.contato}</div>}
                        {o.pedidoVendaId && (
                          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                            <EntityLink type="venda" id={o.pedidoVendaId} label="Ver venda" />
                          </div>
                        )}
                      </div>
                    ))}
                    {items.length === 0 && (
                      <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                        Arraste oportunidades aqui
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Modal
        open={open}
        title={editing ? "Editar oportunidade" : "Nova oportunidade"}
        width="max-w-lg"
        onClose={closeModal}
        footer={
          <>
            <button className="btn-outline" onClick={closeModal}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={save}>
              Salvar
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Título" required error={error} className="sm:col-span-2">
            <input
              className="input"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              autoFocus
            />
          </Field>
          <Field label="Cliente">
            <div className="flex gap-2">
              <Select
                className="min-w-0 flex-1"
                value={form.clienteId}
                onChange={onClienteSelectChange}
                options={[
                  { value: "", label: "— selecione ou digite abaixo —" },
                  ...(!readOnly ? [{ value: NOVO_CLIENTE, label: "+ Novo cliente" }] : []),
                  ...clientes.map((c) => ({ value: c.id, label: c.nome })),
                ]}
              />
              {!readOnly && (
                <button
                  type="button"
                  className="btn-outline shrink-0 px-2.5"
                  title="Novo cliente"
                  aria-label="Novo cliente"
                  onClick={openNovoClienteModal}
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>
          </Field>
          <Field label="Nome do cliente (livre)">
            <input
              className="input"
              value={form.clienteNome}
              onChange={(e) => setForm({ ...form, clienteNome: e.target.value, clienteId: "" })}
            />
          </Field>
          <Field label="Vendedor">
            <Select
              value={form.vendedorId}
              onChange={(vendedorId) => setForm({ ...form, vendedorId })}
              options={[
                { value: "", label: "— sem vendedor —" },
                ...vendedores.map((v) => ({ value: v.id, label: v.nome })),
              ]}
            />
          </Field>
          <Field label="Contato">
            <input className="input" value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} />
          </Field>
          <Field label="Valor estimado (R$)">
            <input
              className="input"
              type="number"
              step="0.01"
              value={form.valorEstimado || ""}
              onChange={(e) => setForm({ ...form, valorEstimado: Number(e.target.value) })}
            />
          </Field>
          <Field label="Estágio">
            <Select
              value={form.estagio}
              onChange={(estagio) => setForm({ ...form, estagio: estagio as OportunidadeEstagio })}
              options={ESTAGIOS.map((e) => ({ value: e.key, label: e.label }))}
            />
          </Field>
          <Field label="Previsão de fechamento">
            <DatePicker
              value={form.dataPrevisaoFechamento}
              onChange={(dataPrevisaoFechamento) => setForm({ ...form, dataPrevisaoFechamento })}
            />
          </Field>
          <Field label="Fonte do lead">
            <Select
              value={form.fonteLead}
              onChange={(fonteLead) => setForm({ ...form, fonteLead: fonteLead as FonteLead | "" })}
              options={[
                { value: "", label: "— não informado —" },
                ...FONTES_LEAD.map((f) => ({ value: f.value, label: f.label })),
              ]}
            />
          </Field>
          <Field label="Observação" className="sm:col-span-2">
            <input className="input" value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={clienteModalOpen}
        title="Novo cliente"
        width="max-w-2xl"
        zIndex={60}
        onClose={closeClienteModal}
        footer={
          <>
            <button className="btn-outline" onClick={closeClienteModal}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={salvarNovoCliente}>
              Salvar
            </button>
          </>
        }
      >
        <ParceiroForm
          variant="cliente"
          mode="compact"
          value={novoCliente}
          onChange={setNovoCliente}
          error={clienteError}
        />
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Excluir oportunidade"
        message={`Excluir "${toDelete?.titulo}"?`}
        confirmLabel="Excluir"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

export function CrmPage() {
  return <RequireEmpresa>{(id) => <Inner empresaId={id} />}</RequireEmpresa>;
}
