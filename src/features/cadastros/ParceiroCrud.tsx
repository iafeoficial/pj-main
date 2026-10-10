import { useRef, useState } from "react";
import { Pencil, Plus, Trash2, Upload, type LucideIcon } from "lucide-react";
import type { Cliente, Fornecedor } from "@/types/domain";
import { clienteService, fornecedorService } from "@/data/cadastros";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useFormDraft } from "@/hooks/useFormDraft";
import {
  lerPlanilhaParceiros,
  montarPreviewImportacao,
  type DestinoParceiro,
  type PreviewImportacaoParceiro,
} from "@/lib/parceiroPlanilha";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import {
  ParceiroForm,
  emptyParceiroForm,
  parceiroFromEntity,
  parceiroToPayload,
  type ParceiroFormData,
} from "./ParceiroForm";

type Parceiro = Cliente | Fornecedor;

interface ParceiroCrudConfig {
  titulo: string;
  subtitulo: string;
  icon: LucideIcon;
  singular: string;
  variant: "cliente" | "fornecedor";
  service: {
    list: (empresaId: string) => Promise<Parceiro[]>;
    create: (empresaId: string, data: Record<string, unknown>) => Promise<Parceiro>;
    update: (empresaId: string, id: string, data: Record<string, unknown>) => Promise<Parceiro>;
    remove: (empresaId: string, id: string) => Promise<unknown>;
  };
}

export type { ParceiroCrudConfig };

function tipoLabel(t: string | undefined) {
  return t === "pf" ? "PF" : "PJ";
}

function cidadeUf(row: Parceiro) {
  const parts = [row.cidade, row.uf].filter(Boolean);
  return parts.length ? parts.join("/") : "—";
}

function rotuloDestino(destino: DestinoParceiro) {
  return destino === "cliente" ? "Cliente" : "Fornecedor";
}

function ListaPreview({
  titulo,
  itens,
  vazio,
}: {
  titulo: string;
  itens: string[];
  vazio?: string;
}) {
  if (itens.length === 0 && !vazio) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo} ({itens.length})
      </h3>
      {itens.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <ul className="mt-1 max-h-36 space-y-0.5 overflow-y-auto text-sm">
          {itens.map((item, i) => (
            <li key={`${item}-${i}`}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ParceiroCrud({ config, empresaId }: { config: ParceiroCrudConfig; empresaId: string }) {
  const { version, bumpData } = useEmpresa();
  const { notify } = useToast();
  const { data: rows } = useAsyncData(() => config.service.list(empresaId), [empresaId, version], [] as Parceiro[]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Parceiro | null>(null);
  const [form, setForm] = useState<ParceiroFormData>(() => emptyParceiroForm());
  const [error, setError] = useState("");
  const [toDelete, setToDelete] = useState<Parceiro | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewImportacaoParceiro | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const draftKey = config.variant === "cliente" ? "clientes" : "fornecedores";
  const { clearDraft } = useFormDraft(
    draftKey,
    { open, form, editingId: editing?.id ?? null },
    (draft) => {
      setForm(draft.form);
      setEditing(draft.editingId ? ({ id: draft.editingId } as Parceiro) : null);
      setOpen(true);
      notify("Rascunho restaurado.", "info");
    }
  );

  const Icon = config.icon;

  function closeModal() {
    clearDraft();
    setOpen(false);
  }

  function openCreate() {
    clearDraft();
    setEditing(null);
    setForm(emptyParceiroForm());
    setError("");
    setOpen(true);
  }

  function openEdit(row: Parceiro) {
    clearDraft();
    setEditing(row);
    setForm(parceiroFromEntity(row));
    setError("");
    setOpen(true);
  }

  async function save() {
    if (!form.nome.trim()) {
      setError("Informe o nome.");
      return;
    }
    const payload = parceiroToPayload(form) as Record<string, unknown>;
    try {
      if (editing) {
        await config.service.update(empresaId, editing.id, payload);
        notify(`${config.singular} atualizado.`);
      } else {
        await config.service.create(empresaId, payload);
        notify(`${config.singular} criado.`);
      }
      clearDraft();
      bumpData();
      setOpen(false);
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  async function onArquivo(file: File) {
    try {
      const linhas = await lerPlanilhaParceiros(await file.arrayBuffer());
      const [clientes, fornecedores] = await Promise.all([
        clienteService.list(empresaId),
        fornecedorService.list(empresaId),
      ]);
      setPreview(montarPreviewImportacao(linhas, { clientes, fornecedores }));
      setImportOpen(true);
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  function fecharImportacao() {
    if (importing) return;
    setImportOpen(false);
    setPreview(null);
  }

  async function confirmarImportacao() {
    if (!preview || preview.criar.length === 0 || importing) return;
    setImporting(true);
    let gravados = 0;
    try {
      for (const item of preview.criar) {
        const svc = item.destino === "cliente" ? clienteService : fornecedorService;
        await svc.create(empresaId, item.payload);
        gravados += 1;
      }
      bumpData();
      notify(gravados === 1 ? "1 cadastro importado." : `${gravados} cadastros importados.`);
      setImportOpen(false);
      setPreview(null);
    } catch (e) {
      if (gravados > 0) bumpData();
      notify((e as Error).message, "error");
    } finally {
      setImporting(false);
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

  return (
    <>
      <PageHeader
        title={config.titulo}
        subtitle={config.subtitulo}
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void onArquivo(file);
              }}
            />
            <button className="btn-outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Importar planilha
            </button>
            <button className="btn-primary" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Novo
            </button>
          </>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Icon}
          title={`Nenhum ${config.singular.toLowerCase()}`}
          description="Cadastre o primeiro registro ou importe uma planilha."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <button className="btn-outline" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" /> Importar planilha
              </button>
              <button className="btn-primary" onClick={openCreate}>
                <Plus className="h-4 w-4" /> Novo
              </button>
            </div>
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Nome</th>
                <th className="px-4 py-2.5 font-medium">Tipo</th>
                <th className="px-4 py-2.5 font-medium">CNPJ/CPF</th>
                <th className="px-4 py-2.5 font-medium">Cidade/UF</th>
                <th className="px-4 py-2.5 font-medium">Contato</th>
                <th className="px-4 py-2.5 font-medium">Situação</th>
                <th className="px-4 py-2.5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.nome}</div>
                    {row.nomeFantasia && (
                      <div className="text-xs text-muted-foreground">{row.nomeFantasia}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">{tipoLabel(row.tipoPessoa)}</td>
                  <td className="px-4 py-3">{row.cnpjCpf || "—"}</td>
                  <td className="px-4 py-3">{cidadeUf(row)}</td>
                  <td className="px-4 py-3">
                    <div>{row.contatoNome || "—"}</div>
                    {(row.telefone || row.email) && (
                      <div className="text-xs text-muted-foreground">
                        {[row.telefone, row.email].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">{row.ativo ? "Ativo" : "Inativo"}</td>
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
        width="max-w-2xl"
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
        <ParceiroForm variant={config.variant} value={form} onChange={setForm} error={error} />
      </Modal>

      <Modal
        open={importOpen && !!preview}
        title="Importar planilha"
        width="max-w-2xl"
        onClose={fecharImportacao}
        footer={
          <>
            <button className="btn-outline" onClick={fecharImportacao} disabled={importing}>
              Cancelar
            </button>
            <button
              className="btn-primary"
              onClick={() => void confirmarImportacao()}
              disabled={importing || !preview || preview.criar.length === 0}
            >
              {importing ? "Importando…" : "Confirmar importação"}
            </button>
          </>
        }
      >
        {preview && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Linhas com tag de fornecedor ou cliente entram no cadastro correspondente. Quem tiver
              as duas tags é criado nos dois. Sem tag não é gravado. Quem já existir (mesmo
              CPF/CNPJ, ou o mesmo nome quando não houver documento) é pulado.
            </p>
            <ListaPreview
              titulo="Fornecedores a criar"
              itens={preview.criar.filter((i) => i.destino === "fornecedor").map((i) => i.nome)}
              vazio="Nenhum."
            />
            <ListaPreview
              titulo="Clientes a criar"
              itens={preview.criar.filter((i) => i.destino === "cliente").map((i) => i.nome)}
              vazio="Nenhum."
            />
            <ListaPreview
              titulo="Sem tag — não serão gravados"
              itens={preview.semTag.map((i) => i.nome || `Linha ${i.linha}`)}
            />
            <ListaPreview
              titulo="Já cadastrados — não serão duplicados"
              itens={preview.duplicadas.map((i) => `${i.nome} (${rotuloDestino(i.destino)})`)}
            />
            <ListaPreview
              titulo="Linhas inválidas"
              itens={preview.invalidas.map((i) => `Linha ${i.linha}: ${i.motivo}`)}
            />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title={`Excluir ${config.singular.toLowerCase()}`}
        message={`Excluir "${toDelete?.nome ?? ""}"?`}
        confirmLabel="Excluir"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
