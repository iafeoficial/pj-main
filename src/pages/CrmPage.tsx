import { useState } from "react";
import { Target, Plus, Pencil, Trash2, UserPlus, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import type { Cliente, Oportunidade, OportunidadeEstagio, Vendedor } from "@/types/domain";
import { oportunidadeService } from "@/data/operacao";
import { clienteService, vendedorService } from "@/data/cadastros";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { usePermissions } from "@/hooks/usePermissions";
import { formatBRL } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RequireEmpresa } from "@/components/RequireEmpresa";
import { WriteGate } from "@/components/RequireCapability";
import { useToast } from "@/components/ui/Toast";

const ESTAGIOS: { key: OportunidadeEstagio; label: string; style: string }[] = [
  { key: "lead", label: "Lead", style: "bg-zinc-100 text-zinc-700" },
  { key: "qualificado", label: "Qualificado", style: "bg-blue-100 text-blue-700" },
  { key: "proposta", label: "Proposta", style: "bg-amber-100 text-amber-700" },
  { key: "ganho", label: "Ganho", style: "bg-emerald-100 text-emerald-700" },
  { key: "perdido", label: "Perdido", style: "bg-red-100 text-red-700" },
];
const estagioInfo = (e: string) => ESTAGIOS.find((x) => x.key === e) ?? ESTAGIOS[0];

interface FormState {
  titulo: string;
  clienteId: string;
  clienteNome: string;
  vendedorId: string;
  contato: string;
  valorEstimado: number;
  estagio: OportunidadeEstagio;
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
  observacao: "",
};

function Inner({ empresaId }: { empresaId: string }) {
  const { version, bumpData } = useEmpresa();
  const { canWrite } = usePermissions();
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
  const [novoClienteOpen, setNovoClienteOpen] = useState(false);
  const [clienteRapidoNome, setClienteRapidoNome] = useState("");

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setNovoClienteOpen(clientes.length === 0);
    setError("");
    setOpen(true);
  }

  function openEdit(o: Oportunidade) {
    setEditing(o);
    setForm({
      titulo: o.titulo,
      clienteId: o.clienteId ?? "",
      clienteNome: o.clienteNome,
      vendedorId: o.vendedorId ?? "",
      contato: o.contato,
      valorEstimado: o.valorEstimado,
      estagio: o.estagio,
      observacao: o.observacao,
    });
    setNovoClienteOpen(false);
    setError("");
    setOpen(true);
  }

  function syncCliente(id: string) {
    const c = clientes.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      clienteId: id,
      clienteNome: c?.nome ?? "",
      contato: c?.telefone || c?.email || f.contato,
    }));
  }

  async function cadastrarClienteRapido() {
    const nome = clienteRapidoNome.trim();
    if (!nome) {
      notify("Informe o nome do cliente.", "error");
      return;
    }
    try {
      const c = await clienteService.create(empresaId, {
        nome,
        cnpjCpf: "",
        email: "",
        telefone: "",
        ativo: true,
      });
      bumpData();
      syncCliente(c.id);
      setNovoClienteOpen(false);
      setClienteRapidoNome("");
      notify("Cliente cadastrado.");
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
      titulo: form.titulo.trim(),
      clienteId: form.clienteId || null,
      clienteNome: form.clienteNome.trim(),
      vendedorId: form.vendedorId || null,
      contato: form.contato.trim(),
      valorEstimado: form.valorEstimado,
      estagio: form.estagio,
      observacao: form.observacao.trim(),
      pedidoVendaId: editing?.pedidoVendaId ?? null,
    };
    try {
      if (editing) {
        await oportunidadeService.update(empresaId, editing.id, payload);
        notify("Oportunidade atualizada.");
      } else {
        await oportunidadeService.create(empresaId, payload);
        notify("Oportunidade criada.");
      }
      bumpData();
      setOpen(false);
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  async function gerarOrcamento(o: Oportunidade) {
    try {
      const { pedido } = await oportunidadeService.gerarOrcamento(empresaId, o.id);
      bumpData();
      notify(`Orçamento criado para ${pedido.clienteNome}. Veja em Vendas.`);
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

  const totalPipeline = oportunidades
    .filter((o) => o.estagio !== "perdido" && o.estagio !== "ganho")
    .reduce((s, o) => s + o.valorEstimado, 0);

  const podeGerarOrcamento = (o: Oportunidade) =>
    !o.pedidoVendaId &&
    (o.estagio === "proposta" || o.estagio === "qualificado" || o.estagio === "ganho");

  return (
    <>
      <PageHeader
        title="CRM — Oportunidades"
        subtitle={`Pipeline em aberto: ${formatBRL(totalPipeline)}`}
        actions={
          <WriteGate>
            <button className="btn-primary" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Nova oportunidade
            </button>
          </WriteGate>
        }
      />

      {oportunidades.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Nenhuma oportunidade"
          description="Registre leads vinculados a clientes e converta em orçamentos de venda."
          action={
            <WriteGate>
              <button className="btn-primary" onClick={openCreate}>
                <Plus className="h-4 w-4" /> Nova oportunidade
              </button>
            </WriteGate>
          }
        />
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
              {oportunidades.map((o) => {
                const info = estagioInfo(o.estagio);
                return (
                  <tr key={o.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{o.titulo}</div>
                      {o.observacao && <div className="text-xs text-muted-foreground">{o.observacao}</div>}
                      {o.pedidoVendaId && (
                        <Link to="/vendas" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <ShoppingBag className="h-3 w-3" /> Ver venda
                        </Link>
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
                        {canWrite && podeGerarOrcamento(o) && (
                          <button className="btn-outline btn-sm" onClick={() => gerarOrcamento(o)}>
                            Gerar orçamento
                          </button>
                        )}
                        {canWrite && (
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

      <Modal
        open={open}
        title={editing ? "Editar oportunidade" : "Nova oportunidade"}
        width="max-w-lg"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn-outline" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={save}>Salvar</button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Título" required error={error} className="sm:col-span-2">
            <input className="input" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} autoFocus />
          </Field>

          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <span className="label">Cliente</span>
              {!novoClienteOpen && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  onClick={() => setNovoClienteOpen(true)}
                >
                  <UserPlus className="h-3.5 w-3.5" /> Cadastrar
                </button>
              )}
            </div>
            {novoClienteOpen ? (
              <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
                <Field label="Nome" required>
                  <input className="input" value={clienteRapidoNome} onChange={(e) => setClienteRapidoNome(e.target.value)} />
                </Field>
                <div className="flex gap-2">
                  <button type="button" className="btn-primary btn-sm" onClick={cadastrarClienteRapido}>Salvar</button>
                  <button type="button" className="btn-outline btn-sm" onClick={() => setNovoClienteOpen(false)}>Cancelar</button>
                </div>
              </div>
            ) : (
              <select className="input" value={form.clienteId} onChange={(e) => syncCliente(e.target.value)}>
                <option value="">— selecione —</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            )}
          </div>

          <Field label="Vendedor">
            <select className="input" value={form.vendedorId} onChange={(e) => setForm({ ...form, vendedorId: e.target.value })}>
              <option value="">— sem vendedor —</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>{v.nome}</option>
              ))}
            </select>
          </Field>

          <Field label="Contato">
            <input className="input" value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} />
          </Field>
          <Field label="Valor estimado (R$)">
            <input className="input" type="number" step="0.01" value={form.valorEstimado || ""} onChange={(e) => setForm({ ...form, valorEstimado: Number(e.target.value) })} />
          </Field>
          <Field label="Estágio">
            <select className="input" value={form.estagio} onChange={(e) => setForm({ ...form, estagio: e.target.value as OportunidadeEstagio })}>
              {ESTAGIOS.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
            </select>
          </Field>
          <Field label="Observação" className="sm:col-span-2">
            <input className="input" value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog open={!!toDelete} title="Excluir oportunidade" message={`Excluir "${toDelete?.titulo}"?`} confirmLabel="Excluir" destructive onConfirm={confirmDelete} onCancel={() => setToDelete(null)} />
    </>
  );
}

export function CrmPage() {
  return <RequireEmpresa>{(id) => <Inner empresaId={id} />}</RequireEmpresa>;
}
