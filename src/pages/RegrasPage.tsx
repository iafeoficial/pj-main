import { useMemo, useState } from "react";
import { Filter, Pencil, Plus, Trash2 } from "lucide-react";
import type { Categoria, RegraConciliacao, TransacaoTipo } from "@/types/domain";
import { regraService } from "@/data/conciliacao";
import { categoriaService } from "@/data/services";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RequireEmpresa } from "@/components/RequireEmpresa";
import { useToast } from "@/components/ui/Toast";

interface FormState {
  nome: string;
  palavraChave: string;
  tipo: "" | TransacaoTipo;
  categoriaId: string;
  prioridade: number;
  ativo: boolean;
}

const EMPTY: FormState = {
  nome: "",
  palavraChave: "",
  tipo: "",
  categoriaId: "",
  prioridade: 0,
  ativo: true,
};

function Inner({ empresaId }: { empresaId: string }) {
  const { version, bumpData } = useEmpresa();
  const { notify } = useToast();

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

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RegraConciliacao | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState("");
  const [toDelete, setToDelete] = useState<RegraConciliacao | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setError("");
    setModalOpen(true);
  }

  function openEdit(r: RegraConciliacao) {
    setEditing(r);
    setForm({
      nome: r.nome,
      palavraChave: r.palavraChave,
      tipo: r.tipo ?? "",
      categoriaId: r.categoriaId ?? "",
      prioridade: r.prioridade,
      ativo: r.ativo,
    });
    setError("");
    setModalOpen(true);
  }

  async function save() {
    if (!form.nome.trim()) {
      setError("Informe o nome da regra.");
      return;
    }
    const payload = {
      nome: form.nome,
      palavraChave: form.palavraChave,
      tipo: form.tipo === "" ? null : form.tipo,
      categoriaId: form.categoriaId || null,
      prioridade: Number(form.prioridade) || 0,
      ativo: form.ativo,
    };
    try {
      if (editing) {
        await regraService.update(empresaId, editing.id, payload);
        notify("Regra atualizada.");
      } else {
        await regraService.create(empresaId, payload);
        notify("Regra criada.");
      }
      bumpData();
      setModalOpen(false);
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await regraService.remove(empresaId, toDelete.id);
      bumpData();
      notify("Regra excluída.");
    } catch (e) {
      notify((e as Error).message, "error");
    }
    setToDelete(null);
  }

  return (
    <>
      <PageHeader
        title="Regras de Conciliação"
        subtitle="Sugira categorias automaticamente por palavra-chave (a confirmação permanece manual)."
        actions={
          <button className="btn-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nova regra
          </button>
        }
      />

      {regras.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="Nenhuma regra"
          description="Crie regras para acelerar a categorização das transações importadas."
          action={
            <button className="btn-primary" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Nova regra
            </button>
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Prioridade</th>
                <th className="px-4 py-2.5 font-medium">Nome</th>
                <th className="px-4 py-2.5 font-medium">Palavra-chave</th>
                <th className="px-4 py-2.5 font-medium">Tipo</th>
                <th className="px-4 py-2.5 font-medium">Categoria</th>
                <th className="px-4 py-2.5 font-medium">Situação</th>
                <th className="px-4 py-2.5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {regras.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 tabular-nums">{r.prioridade}</td>
                  <td className="px-4 py-3 font-medium">{r.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.palavraChave || "—"}</td>
                  <td className="px-4 py-3 capitalize">{r.tipo ?? "ambos"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.categoriaId ? catMap.get(r.categoriaId) ?? "—" : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.ativo ? "Ativa" : "Inativa"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button className="btn-ghost btn-sm" onClick={() => openEdit(r)}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        className="btn-ghost btn-sm text-destructive"
                        onClick={() => setToDelete(r)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editing ? "Editar regra" : "Nova regra"}
        onClose={() => setModalOpen(false)}
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
          <Field label="Nome" required error={error} className="sm:col-span-2">
            <input
              className="input"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              autoFocus
            />
          </Field>
          <Field label="Palavra-chave (na descrição)" className="sm:col-span-2">
            <input
              className="input"
              value={form.palavraChave}
              onChange={(e) => setForm({ ...form, palavraChave: e.target.value })}
              placeholder="Ex.: TARIFA, PIX, ALUGUEL"
            />
          </Field>
          <Field label="Aplica-se a">
            <select
              className="input"
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value as FormState["tipo"] })}
            >
              <option value="">Ambos</option>
              <option value="credito">Crédito (entrada)</option>
              <option value="debito">Débito (saída)</option>
            </select>
          </Field>
          <Field label="Categoria sugerida">
            <select
              className="input"
              value={form.categoriaId}
              onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
            >
              <option value="">— nenhuma —</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Prioridade">
            <input
              className="input"
              type="number"
              value={form.prioridade}
              onChange={(e) => setForm({ ...form, prioridade: Number(e.target.value) })}
            />
          </Field>
          <Field label=" ">
            <label className="flex h-9 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              />
              Regra ativa
            </label>
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Excluir regra"
        message={`Excluir a regra "${toDelete?.nome}"?`}
        confirmLabel="Excluir"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

export function RegrasPage() {
  return <RequireEmpresa>{(id) => <Inner empresaId={id} />}</RequireEmpresa>;
}
