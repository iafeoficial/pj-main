import { useState } from "react";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";
import type { CentroCusto } from "@/types/domain";
import { centroCustoService } from "@/data/services";
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
  const { data: centros } = useAsyncData(
    () => centroCustoService.list(empresaId),
    [empresaId, version],
    [] as CentroCusto[]
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CentroCusto | null>(null);
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [error, setError] = useState("");
  const [toDelete, setToDelete] = useState<CentroCusto | null>(null);

  function openCreate() {
    setEditing(null);
    setNome("");
    setCodigo("");
    setAtivo(true);
    setError("");
    setModalOpen(true);
  }

  function openEdit(c: CentroCusto) {
    setEditing(c);
    setNome(c.nome);
    setCodigo(c.codigo);
    setAtivo(c.ativo);
    setError("");
    setModalOpen(true);
  }

  async function save() {
    if (!nome.trim()) {
      setError("Informe o nome do centro de custo.");
      return;
    }
    try {
      if (editing) {
        await centroCustoService.update(empresaId, editing.id, { nome, codigo, ativo });
        notify("Centro de custo atualizado.");
      } else {
        await centroCustoService.create(empresaId, { nome, codigo, ativo });
        notify("Centro de custo criado.");
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
      await centroCustoService.remove(empresaId, toDelete.id);
      bumpData();
      notify("Centro de custo excluído.");
    } catch (e) {
      notify((e as Error).message, "error");
    }
    setToDelete(null);
  }

  return (
    <>
      <PageHeader
        title="Centros de Custo"
        subtitle="Agrupe lançamentos por área ou projeto."
        actions={
          <button className="btn-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Novo centro
          </button>
        }
      />

      {centros.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Nenhum centro de custo"
          description="Crie centros de custo para análises gerenciais."
          action={
            <button className="btn-primary" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Novo centro
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Código</th>
                <th className="px-4 py-2.5 font-medium">Nome</th>
                <th className="px-4 py-2.5 font-medium">Situação</th>
                <th className="px-4 py-2.5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {centros.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{c.codigo || "—"}</td>
                  <td className="px-4 py-3 font-medium">{c.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.ativo ? "Ativo" : "Inativo"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button className="btn-ghost btn-sm" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        className="btn-ghost btn-sm text-destructive"
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
        title={editing ? "Editar centro de custo" : "Novo centro de custo"}
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
          <Field label="Código">
            <input
              className="input"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ex.: CC-001"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
            />
            Centro de custo ativo
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Excluir centro de custo"
        message={`Excluir "${toDelete?.nome}"?`}
        confirmLabel="Excluir"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

export function CentrosCustoPage() {
  return <RequireEmpresa>{(id) => <Inner empresaId={id} />}</RequireEmpresa>;
}
