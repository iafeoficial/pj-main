import { useState } from "react";
import { ShieldCheck, Pencil, Plus, Trash2 } from "lucide-react";
import type { Certificado, CertificadoTipo } from "@/types/domain";
import { certificadoService, diasParaVencer } from "@/data/certificados";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatDate, today } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RequireEmpresa } from "@/components/RequireEmpresa";
import { useToast } from "@/components/ui/Toast";

interface FormState {
  titular: string;
  tipo: CertificadoTipo;
  validade: string;
  observacao: string;
  ativo: boolean;
}

const EMPTY: FormState = { titular: "", tipo: "A1", validade: today(), observacao: "", ativo: true };

function ValidadeBadge({ validade }: { validade: string }) {
  const dias = diasParaVencer(validade);
  if (dias < 0) return <span className="badge bg-red-100 text-red-700">Vencido</span>;
  if (dias <= 30) return <span className="badge bg-amber-100 text-amber-700">Vence em {dias}d</span>;
  return <span className="badge bg-emerald-100 text-emerald-700">Válido ({dias}d)</span>;
}

function Inner({ empresaId }: { empresaId: string }) {
  const { version, bumpData } = useEmpresa();
  const { notify } = useToast();

  const { data: certificados } = useAsyncData(
    () => certificadoService.list(empresaId),
    [empresaId, version],
    [] as Certificado[]
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Certificado | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState("");
  const [toDelete, setToDelete] = useState<Certificado | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setError("");
    setModalOpen(true);
  }
  function openEdit(c: Certificado) {
    setEditing(c);
    setForm({ titular: c.titular, tipo: c.tipo, validade: c.validade, observacao: c.observacao, ativo: c.ativo });
    setError("");
    setModalOpen(true);
  }

  async function save() {
    if (!form.titular.trim()) {
      setError("Informe o titular do certificado.");
      return;
    }
    if (!form.validade) {
      setError("Informe a validade.");
      return;
    }
    try {
      if (editing) {
        await certificadoService.update(empresaId, editing.id, form);
        notify("Certificado atualizado.");
      } else {
        await certificadoService.create(empresaId, form);
        notify("Certificado cadastrado.");
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
      await certificadoService.remove(empresaId, toDelete.id);
      bumpData();
      notify("Certificado excluído.");
    } catch (e) {
      notify((e as Error).message, "error");
    }
    setToDelete(null);
  }

  return (
    <>
      <PageHeader
        title="Certificados Digitais"
        subtitle="Cadastro e controle de validade do certificado da empresa."
        actions={
          <button className="btn-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Novo certificado
          </button>
        }
      />

      <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Por segurança, este cadastro guarda apenas os <strong>metadados</strong> (titular, tipo,
        validade). O arquivo <code>.pfx</code> e a senha <strong>não</strong> são armazenados — a
        assinatura de documentos fiscais exige um backend seguro.
      </div>

      {certificados.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nenhum certificado cadastrado"
          description="Cadastre o certificado para acompanhar a validade."
          action={
            <button className="btn-primary" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Novo certificado
            </button>
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Titular</th>
                <th className="px-4 py-2.5 font-medium">Tipo</th>
                <th className="px-4 py-2.5 font-medium">Validade</th>
                <th className="px-4 py-2.5 font-medium">Situação</th>
                <th className="px-4 py-2.5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {certificados.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.titular}</div>
                    {c.observacao && <div className="text-xs text-muted-foreground">{c.observacao}</div>}
                  </td>
                  <td className="px-4 py-3">{c.tipo}</td>
                  <td className="px-4 py-3">{formatDate(c.validade)}</td>
                  <td className="px-4 py-3">
                    <ValidadeBadge validade={c.validade} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button className="btn-ghost btn-sm" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button className="btn-ghost btn-sm text-destructive" onClick={() => setToDelete(c)}>
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
        title={editing ? "Editar certificado" : "Novo certificado"}
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
          <Field label="Titular (razão social / CNPJ)" required error={error} className="sm:col-span-2">
            <input className="input" value={form.titular} onChange={(e) => setForm({ ...form, titular: e.target.value })} autoFocus />
          </Field>
          <Field label="Tipo">
            <select className="input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as CertificadoTipo })}>
              <option value="A1">A1 (arquivo)</option>
              <option value="A3">A3 (token/cartão)</option>
            </select>
          </Field>
          <Field label="Validade" required>
            <input className="input" type="date" value={form.validade} onChange={(e) => setForm({ ...form, validade: e.target.value })} />
          </Field>
          <Field label="Observação" className="sm:col-span-2">
            <input className="input" value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
            Certificado ativo
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Excluir certificado"
        message={`Excluir o certificado de "${toDelete?.titular}"?`}
        confirmLabel="Excluir"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

export function CertificadosPage() {
  return <RequireEmpresa>{(id) => <Inner empresaId={id} />}</RequireEmpresa>;
}
