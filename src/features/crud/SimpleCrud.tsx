import { Fragment, useState, type ReactNode } from "react";
import { Pencil, Plus, Trash2, type LucideIcon } from "lucide-react";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useFormDraft } from "@/hooks/useFormDraft";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { formatCpfCnpj, formatTelefone, TELEFONE_PLACEHOLDER } from "@/lib/masks";

type FieldType = "text" | "number" | "email" | "checkbox" | "cpfCnpj" | "telefone" | "textarea" | "select";
type Row = Record<string, unknown> & { id: string };
type FormValues = Record<string, string | number | boolean>;

export interface CrudFieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  fullWidth?: boolean;
  default?: string | number | boolean;
  section?: string;
  hint?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
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
  nomeKey: string;
  fields: CrudFieldDef[];
  columns: CrudColumn[];
  modalWidth?: string;
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

function maskFieldValue(type: FieldType, value: string): string {
  if (type === "cpfCnpj") return formatCpfCnpj(value);
  if (type === "telefone") return formatTelefone(value);
  return value;
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="border-b border-border pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-2">
      {children}
    </h3>
  );
}

export function SimpleCrud({ config, empresaId }: { config: SimpleCrudConfig; empresaId: string }) {
  const { version, bumpData } = useEmpresa();
  const { notify } = useToast();
  const { data: rows } = useAsyncData(() => config.service.list(empresaId), [empresaId, version], [] as Row[]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<FormValues>(() => emptyForm(config.fields));
  const [error, setError] = useState("");
  const [toDelete, setToDelete] = useState<Row | null>(null);

  const draftKey = config.singular.toLowerCase().replace(/\s+/g, "-");
  const { clearDraft } = useFormDraft(
    draftKey,
    { open, form, editingId: editing?.id ?? null },
    (draft) => {
      setForm(draft.form);
      setEditing(draft.editingId ? ({ id: draft.editingId } as Row) : null);
      setOpen(true);
      notify("Rascunho restaurado.", "info");
    }
  );

  function closeModal() {
    clearDraft();
    setOpen(false);
  }

  function openCreate() {
    clearDraft();
    setEditing(null);
    setForm(emptyForm(config.fields));
    setError("");
    setOpen(true);
  }
  function openEdit(row: Row) {
    clearDraft();
    setEditing(row);
    const f: FormValues = {};
    for (const fd of config.fields) {
      const v = row[fd.key];
      if (fd.type === "checkbox") f[fd.key] = Boolean(v);
      else if (fd.type === "number") f[fd.key] = Number(v ?? 0);
      else {
        const raw = String(v ?? "");
        f[fd.key] = fd.type === "cpfCnpj" || fd.type === "telefone" ? maskFieldValue(fd.type, raw) : raw;
      }
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
      await config.service.remove(empresaId, toDelete.id);
      bumpData();
      notify(`${config.singular} excluído.`);
    } catch (e) {
      notify((e as Error).message, "error");
    }
    setToDelete(null);
  }

  const Icon = config.icon;
  let lastSection = "";

  return (
    <>
      <PageHeader
        title={config.titulo}
        subtitle={config.subtitulo}
        actions={
          <button className="btn-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Novo
          </button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Icon}
          title={`Nenhum ${config.singular.toLowerCase()}`}
          description="Cadastre o primeiro registro."
          action={
            <button className="btn-primary" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Novo
            </button>
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
                    <div className="flex justify-end gap-1">
                      <button className="btn-ghost btn-sm" onClick={() => openEdit(row)}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button className="btn-ghost btn-sm text-destructive" onClick={() => setToDelete(row)}>
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
        open={open}
        title={editing ? `Editar ${config.singular.toLowerCase()}` : `Novo ${config.singular.toLowerCase()}`}
        onClose={closeModal}
        width={config.modalWidth ?? "max-w-lg"}
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
          {config.fields.map((fd) => {
            const sectionEl =
              fd.section && fd.section !== lastSection ? (
                ((lastSection = fd.section), (<SectionTitle key={`sec-${fd.section}`}>{fd.section}</SectionTitle>))
              ) : null;

            if (fd.type === "checkbox") {
              return (
                <Fragment key={fd.key}>
                  {sectionEl}
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={Boolean(form[fd.key])}
                      onChange={(e) => setForm({ ...form, [fd.key]: e.target.checked })}
                    />
                    {fd.label}
                  </label>
                </Fragment>
              );
            }

            if (fd.type === "textarea") {
              return (
                <Fragment key={fd.key}>
                  {sectionEl}
                  <Field
                    label={fd.label}
                    required={fd.required}
                    error={error && fd.required && !String(form[fd.key] ?? "").trim() ? error : undefined}
                    className={fd.fullWidth ? "sm:col-span-2" : undefined}
                  >
                    <textarea
                      className="input min-h-[72px] resize-y"
                      value={String(form[fd.key] ?? "")}
                      onChange={(e) => setForm({ ...form, [fd.key]: e.target.value })}
                    />
                  </Field>
                </Fragment>
              );
            }

            if (fd.type === "select") {
              const currentValue = String(form[fd.key] ?? "");
              const baseOptions = fd.options ?? [];
              const options =
                currentValue && !baseOptions.some((o) => o.value === currentValue)
                  ? [{ value: currentValue, label: `${currentValue} — (personalizado)` }, ...baseOptions]
                  : baseOptions;

              return (
                <Fragment key={fd.key}>
                  {sectionEl}
                  <Field
                    label={fd.label}
                    required={fd.required}
                    error={error && fd.required && !String(form[fd.key] ?? "").trim() ? error : undefined}
                    className={fd.fullWidth ? "sm:col-span-2" : undefined}
                  >
                    <Select
                      value={currentValue}
                      onChange={(v) => setForm({ ...form, [fd.key]: v })}
                      options={options}
                      placeholder={fd.placeholder}
                    />
                    {fd.hint && <p className="text-xs text-muted-foreground">{fd.hint}</p>}
                  </Field>
                </Fragment>
              );
            }

            return (
              <Fragment key={fd.key}>
                {sectionEl}
                <Field
                  label={fd.label}
                  required={fd.required}
                  error={error && fd.required && !String(form[fd.key] ?? "").trim() ? error : undefined}
                  className={fd.fullWidth ? "sm:col-span-2" : undefined}
                >
                  <input
                    className={fd.type === "cpfCnpj" ? "input uppercase" : "input"}
                    type={fd.type === "number" ? "number" : fd.type === "email" ? "email" : "text"}
                    inputMode={
                      fd.type === "telefone" ? "numeric" : fd.type === "cpfCnpj" ? "text" : undefined
                    }
                    autoCapitalize={fd.type === "cpfCnpj" ? "characters" : undefined}
                    maxLength={fd.type === "cpfCnpj" ? 18 : undefined}
                    step={fd.type === "number" ? "0.01" : undefined}
                    placeholder={fd.type === "telefone" ? TELEFONE_PLACEHOLDER : undefined}
                    value={String(form[fd.key] ?? "")}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const next =
                        fd.type === "number"
                          ? Number(raw)
                          : fd.type === "cpfCnpj" || fd.type === "telefone"
                            ? maskFieldValue(fd.type, raw)
                            : raw;
                      setForm({ ...form, [fd.key]: next });
                    }}
                  />
                </Field>
              </Fragment>
            );
          })}
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
