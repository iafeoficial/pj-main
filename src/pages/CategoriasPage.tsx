import { useState } from "react";
import { Tags, Pencil, Plus, Trash2 } from "lucide-react";
import type { Categoria, CategoriaTipo } from "@/types/domain";
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

function Inner({ empresaId }: { empresaId: string }) {
  const { version, bumpData } = useEmpresa();
  const { notify } = useToast();
  const { data: categorias } = useAsyncData(
    () => categoriaService.list(empresaId),
    [empresaId, version],
    [] as Categoria[]
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Categoria | null>(null);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<CategoriaTipo>("despesa");
  const [ativo, setAtivo] = useState(true);
  const [error, setError] = useState("");
  const [toDelete, setToDelete] = useState<Categoria | null>(null);

  function openCreate() {
    setEditing(null);
    setNome("");
    setTipo("despesa");
    setAtivo(true);
    setError("");
    setModalOpen(true);
  }

  function openEdit(c: Categoria) {
    setEditing(c);
    setNome(c.nome);
    setTipo(c.tipo);
    setAtivo(c.ativo);
    setError("");
    setModalOpen(true);
  }

  async function save() {
    if (!nome.trim()) {
      setError("Informe o nome da categoria.");
      return;
    }
    try {
      if (editing) {
        await categoriaService.update(empresaId, editing.id, { nome, tipo, ativo });
        notify("Categoria atualizada.");
      } else {
        await categoriaService.create(empresaId, { nome, tipo, ativo });
        notify("Categoria criada.");
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
      await categoriaService.remove(empresaId, toDelete.id);
      bumpData();
      notify("Categoria excluída.");
    } catch (e) {
      notify((e as Error).message, "error");
    }
    setToDelete(null);
  }

  return (
    <>
      <PageHeader
        title="Categorias"
        subtitle="Classifique receitas e despesas."
        actions={
          <button className="btn-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nova categoria
          </button>
        }
      />

      {categorias.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="Nenhuma categoria"
          description="Crie categorias para organizar seus lançamentos."
          action={
            <button className="btn-primary" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Nova categoria
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Nome</th>
                <th className="px-4 py-2.5 font-medium">Tipo</th>
                <th className="px-4 py-2.5 font-medium">Situação</th>
                <th className="px-4 py-2.5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {categorias.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{c.nome}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`badge ${
                        c.tipo === "receita"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {c.tipo === "receita" ? "Receita" : "Despesa"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.ativo ? "Ativa" : "Inativa"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button className="btn-ghost btn-sm btn-edit" title="Editar" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        className="btn-ghost btn-sm btn-delete"
                        title="Excluir"
                        onClick={() => setToDelete(c)}
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
        title={editing ? "Editar categoria" : "Nova categoria"}
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
        <div className="space-y-4">
          <Field label="Nome" required error={error}>
            <input
              className="input"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Tipo" required>
            <select
              className="input"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as CategoriaTipo)}
            >
              <option value="despesa">Despesa</option>
              <option value="receita">Receita</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
            />
            Categoria ativa
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Excluir categoria"
        message={`Excluir a categoria "${toDelete?.nome}"?`}
        confirmLabel="Excluir"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

export function CategoriasPage() {
  return <RequireEmpresa>{(id) => <Inner empresaId={id} />}</RequireEmpresa>;
}
