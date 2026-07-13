import { useState, type ReactNode } from "react";
import { Pencil, Plus, Trash2, type LucideIcon } from "lucide-react";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { usePermissions } from "@/hooks/usePermissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

type FieldType = "text" | "number" | "email" | "checkbox";
type Row = Record<string, unknown> & { id: string };
type FormValues = Record<string, string | number | boolean>;

export interface CrudFieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  fullWidth?: boolean;
  default?: string | number | boolean;
}

export interface CrudColumn {
  key: string;
  label: string;
  align?: "right";
  render?: (row: Row) => ReactNode;
}

export interface SimpleCrudConfig {
  titulo: string;
  subtitulo: string;
  icon: LucideIcon;
  singular: string;
  nomeKey: string; // campo usado em mensagens de exclusão
  fields: CrudFieldDef[];
  columns: CrudColumn[];
  service: {
    list: (empresaId: string) => Promise<Row[]>;
    create: (empresaId: string, data: Record<string, unknown>) => Promise<unknown>;
    update: (empresaId: string, id: string, data: Record<string, unknown>) => Promise<unknown>;
    remove: (empresaId: string, id: string) => Promise<unknown>;
  };
}

function emptyForm(fields: CrudFieldDef[]): FormValues {
  const f: FormValues = {};
  for (const fd of fields) f[fd.key] = fd.default ?? (fd.type === "checkbox" ? true : fd.type === "number" ? 0 : "");
  return f;
}

export function SimpleCrud({ config, empresaId }: { config: SimpleCrudConfig; empresaId: string }) {
  const { version, bumpData } = useEmpresa();
  const { canWrite } = usePermissions();
  const { notify } = useToast();
  const { data: rows } = useAsyncData(() => config.service.list(empresaId), [empresaId, version], [] as Row[]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<FormValues>(() => emptyForm(config.fields));
  const [error, setError] = useState("");
  const [toDelete, setToDelete] = useState<Row | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm(config.fields));
    setError("");
    setOpen(true);
  }
  function openEdit(row: Row) {
    setEditing(row);
    const f: FormValues = {};
    for (const fd of config.fields) {
      const v = row[fd.key];
      f[fd.key] = fd.type === "checkbox" ? Boolean(v) : fd.type === "number" ? Number(v ?? 0) : String(v ?? "");
    }
    setForm(f);
    setError("");
    setOpen(true);
  }

  async function save() {
    const req = config.fields.find((fd) => fd.required && !String(form[fd.key] ?? "").trim());
    if (req) {
      setError(`Informe: ${req.label}.`);
      return;
    }
    try {
      if (editing) {
        await config.service.update(empresaId, editing.id, form);
        notify(`${config.singular} atualizado.`);
      } else {
        await config.service.create(empresaId, form);
        notify(`${config.singular} criado.`);
      }
      bumpData();
      setOpen(false);
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await config.service.remove(empresaId, toDelete.id);
      bumpData();
      notify(`${config.singular} excluído.`);
    } catch (e) {
      notify((e as Error).message, "error");
    }
    setToDelete(null);
  }

  const Icon = config.icon;

  return (
    <>
      <PageHeader
        title={config.titulo}
        subtitle={config.subtitulo}
        actions={
          canWrite ? (
            <button className="btn-primary" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Novo
            </button>
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Icon}
          title={`Nenhum ${config.singular.toLowerCase()}`}
          description="Cadastre o primeiro registro."
          action={
            canWrite ? (
              <button className="btn-primary" onClick={openCreate}>
                <Plus className="h-4 w-4" /> Novo
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                {config.columns.map((c) => (
                  <th key={c.key} className={`px-4 py-2.5 font-medium ${c.align === "right" ? "text-right" : ""}`}>
                    {c.label}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  {config.columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 ${c.align === "right" ? "text-right tabular-nums" : ""}`}>
                      {c.render ? c.render(row) : String(row[c.key] ?? "—") || "—"}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    {canWrite && (
                      <div className="flex justify-end gap-1">
                        <button className="btn-ghost btn-sm btn-edit" title="Editar" onClick={() => openEdit(row)}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button className="btn-ghost btn-sm btn-delete" title="Excluir" onClick={() => setToDelete(row)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open}
        title={editing ? `Editar ${config.singular.toLowerCase()}` : `Novo ${config.singular.toLowerCase()}`}
        onClose={() => setOpen(false)}
        width="max-w-lg"
        footer={
          <>
            <button className="btn-outline" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={save}>
              Salvar
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {config.fields.map((fd) =>
            fd.type === "checkbox" ? (
              <label key={fd.key} className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={Boolean(form[fd.key])}
                  onChange={(e) => setForm({ ...form, [fd.key]: e.target.checked })}
                />
                {fd.label}
              </label>
            ) : (
              <Field
                key={fd.key}
                label={fd.label}
                required={fd.required}
                error={error && fd.required && !String(form[fd.key] ?? "").trim() ? error : undefined}
                className={fd.fullWidth ? "sm:col-span-2" : undefined}
              >
                <input
                  className="input"
                  type={fd.type === "number" ? "number" : fd.type}
                  step={fd.type === "number" ? "0.01" : undefined}
                  value={String(form[fd.key] ?? "")}
                  onChange={(e) =>
                    setForm({ ...form, [fd.key]: fd.type === "number" ? Number(e.target.value) : e.target.value })
                  }
                />
              </Field>
            )
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title={`Excluir ${config.singular.toLowerCase()}`}
        message={`Excluir "${String(toDelete?.[config.nomeKey] ?? "")}"?`}
        confirmLabel="Excluir"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
