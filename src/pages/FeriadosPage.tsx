import { useMemo, useState } from "react";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import type { Feriado } from "@/types/domain";
import { feriadoService } from "@/data/feriados";
import { feriadosNacionais } from "@/lib/diaUtil";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatDate, today } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { DatePicker } from "@/components/ui/DatePicker";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RequireEmpresa } from "@/components/RequireEmpresa";
import { useToast } from "@/components/ui/Toast";

function Inner({ empresaId }: { empresaId: string }) {
  const { version, bumpData } = useEmpresa();
  const { notify } = useToast();
  const ano = new Date().getFullYear();
  const nacionais = useMemo(
    () => [...feriadosNacionais(ano), ...feriadosNacionais(ano + 1)],
    [ano]
  );
  const { data: proprios } = useAsyncData(
    () => feriadoService.list(empresaId),
    [empresaId, version],
    [] as Feriado[]
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [data, setData] = useState(today());
  const [nome, setNome] = useState("");
  const [repeteAnual, setRepeteAnual] = useState(true);
  const [error, setError] = useState("");
  const [toDelete, setToDelete] = useState<Feriado | null>(null);

  function openCreate() {
    setData(today());
    setNome("");
    setRepeteAnual(true);
    setError("");
    setModalOpen(true);
  }

  async function save() {
    if (!nome.trim()) {
      setError("Informe o nome do feriado.");
      return;
    }
    try {
      await feriadoService.create(empresaId, { data, nome, repeteAnual });
      bumpData();
      notify("Feriado cadastrado.");
      setModalOpen(false);
    } catch (e) {
      const msg = (e as Error).message;
      notify(
        /duplicate|unique/i.test(msg) ? "Já existe um feriado nesta data." : msg,
        "error"
      );
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await feriadoService.remove(empresaId, toDelete.id);
      bumpData();
      notify("Feriado excluído.");
    } catch (e) {
      notify((e as Error).message, "error");
    }
    setToDelete(null);
  }

  return (
    <>
      <PageHeader
        title="Feriados"
        subtitle="Nacionais entram sozinhos. Cadastre os estaduais e municipais da empresa para o vencimento pular sábado, domingo e feriado."
        actions={
          <button className="btn-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Novo feriado
          </button>
        }
      />

      <div className="card mb-6 overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium">Nacionais ({ano} e {ano + 1})</h2>
          <p className="text-xs text-muted-foreground">Somente leitura. Valem para todas as empresas.</p>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Data</th>
              <th className="px-4 py-2.5 font-medium">Nome</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {nacionais.map((f) => (
              <tr key={`${f.data}-${f.nome}`}>
                <td className="px-4 py-2.5 tabular-nums">{formatDate(f.data)}</td>
                <td className="px-4 py-2.5">{f.nome}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {proprios.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nenhum feriado da empresa"
          description="Inclua feriados estaduais ou municipais. Eles entram no ajuste de vencimento."
          action={
            <button className="btn-primary" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Novo feriado
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-medium">Da empresa</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Data</th>
                <th className="px-4 py-2.5 font-medium">Nome</th>
                <th className="px-4 py-2.5 font-medium">Repete</th>
                <th className="px-4 py-2.5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {proprios.map((f) => (
                <tr key={f.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 tabular-nums">{formatDate(f.data)}</td>
                  <td className="px-4 py-3 font-medium">{f.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {f.repeteAnual ? "Todo ano" : "Só nesta data"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <button
                        className="btn-ghost btn-sm text-destructive"
                        onClick={() => setToDelete(f)}
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
        title="Novo feriado"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="btn-outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={() => void save()}>
              Salvar
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Data" required>
            <DatePicker value={data} onChange={setData} />
          </Field>
          <Field label="Nome" required error={error}>
            <input
              className="input"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Aniversário da cidade"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="rounded border-border"
              checked={repeteAnual}
              onChange={(e) => setRepeteAnual(e.target.checked)}
            />
            Repete todo ano neste dia
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Excluir feriado"
        message={`Excluir "${toDelete?.nome}"?`}
        confirmLabel="Excluir"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

export function FeriadosPage() {
  return <RequireEmpresa>{(id) => <Inner empresaId={id} />}</RequireEmpresa>;
}
