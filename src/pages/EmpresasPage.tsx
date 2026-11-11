import { useEffect, useMemo, useState } from "react";
import { Building2, Pencil, Plus, Trash2, CheckCircle2, Mail } from "lucide-react";
import type { Empresa } from "@/types/domain";
import { empresaService } from "@/data/services";
import { seedDemo } from "@/data/seed";
import { conviteService, type Convite } from "@/data/membros";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { PAPEL_LABEL } from "@/lib/rbac";
import { formatCNPJ, isValidCNPJ } from "@/lib/utils";
import { formatTelefone } from "@/lib/masks";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { EnderecoFields, EMPTY_ENDERECO } from "@/components/EnderecoFields";

interface FormState {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  email: string;
  telefone: string;
  status: "ativa" | "inativa";
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
}

const EMPTY: FormState = {
  cnpj: "",
  razaoSocial: "",
  nomeFantasia: "",
  email: "",
  telefone: "",
  status: "ativa",
  ...EMPTY_ENDERECO,
};

const DRAFT_NOVA_KEY = "financas_pj:draft:nova-empresa";

type NovaEmpresaDraft = { open: boolean; form: FormState };

function lerDraftNova(): NovaEmpresaDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_NOVA_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NovaEmpresaDraft;
    if (!parsed || typeof parsed !== "object" || !parsed.form) return null;
    return { open: !!parsed.open, form: { ...EMPTY, ...parsed.form } };
  } catch {
    return null;
  }
}

function gravarDraftNova(draft: NovaEmpresaDraft | null) {
  try {
    if (!draft) sessionStorage.removeItem(DRAFT_NOVA_KEY);
    else sessionStorage.setItem(DRAFT_NOVA_KEY, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

export function EmpresasPage() {
  const { empresas, empresaAtiva, version, refreshEmpresas, setEmpresaAtiva } = useEmpresa();
  const { user } = useAuth();
  const { notify } = useToast();

  const { data: convitesPendentes } = useAsyncData(
    () => (user?.email ? conviteService.meusPendentes(user.email) : Promise.resolve([])),
    [user?.email, version],
    [] as Convite[]
  );

  async function aceitarConvite(c: Convite) {
    try {
      await conviteService.aceitar(c.id);
      await refreshEmpresas();
      setEmpresaAtiva(c.empresaId);
      notify("Convite aceito! Você agora tem acesso à empresa.");
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  const draftInicial = useMemo(() => lerDraftNova(), []);
  const [modalOpen, setModalOpen] = useState(() => !!draftInicial?.open);
  const [editing, setEditing] = useState<Empresa | null>(null);
  const [form, setForm] = useState<FormState>(() => draftInicial?.form ?? EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toDelete, setToDelete] = useState<Empresa | null>(null);

  const sorted = useMemo(() => empresas, [empresas]);

  // Rascunho de "Nova empresa": sobrevive a remount (ex.: foco na aba / refresh de sessão).
  useEffect(() => {
    if (editing) return;
    if (!modalOpen) {
      gravarDraftNova(null);
      return;
    }
    gravarDraftNova({ open: true, form });
  }, [modalOpen, form, editing]);

  function fecharModal() {
    const eraNova = !editing;
    setModalOpen(false);
    setEditing(null);
    setErrors({});
    if (eraNova) {
      setForm(EMPTY);
      gravarDraftNova(null);
    }
  }

  function openCreate() {
    const draft = lerDraftNova();
    setEditing(null);
    setForm(draft?.form ?? EMPTY);
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(e: Empresa) {
    gravarDraftNova(null);
    setEditing(e);
    setForm({
      cnpj: e.cnpj,
      razaoSocial: e.razaoSocial,
      nomeFantasia: e.nomeFantasia,
      email: e.email,
      telefone: formatTelefone(e.telefone),
      status: e.status,
      cep: e.cep ?? "",
      logradouro: e.logradouro ?? "",
      numero: e.numero ?? "",
      complemento: e.complemento ?? "",
      bairro: e.bairro ?? "",
      cidade: e.cidade ?? "",
      uf: e.uf ?? "",
    });
    setErrors({});
    setModalOpen(true);
  }

  function validate(): boolean {
    const err: Record<string, string> = {};
    if (!form.razaoSocial.trim()) err.razaoSocial = "Informe a razão social.";
    if (!form.nomeFantasia.trim()) err.nomeFantasia = "Informe o nome fantasia.";
    if (!form.cnpj.trim()) err.cnpj = "Informe o CNPJ.";
    else if (!isValidCNPJ(form.cnpj)) err.cnpj = "CNPJ inválido.";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      err.email = "E-mail inválido.";
    setErrors(err);
    return Object.keys(err).length === 0;
  }

  async function save() {
    if (!validate()) return;
    try {
      if (editing) {
        await empresaService.update(editing.id, form);
        notify("Empresa atualizada com sucesso.");
      } else {
        const created = await empresaService.create(form);
        if (!empresaAtiva) setEmpresaAtiva(created.id);
        notify("Empresa cadastrada com sucesso.");
        gravarDraftNova(null);
        setForm(EMPTY);
      }
      await refreshEmpresas();
      setModalOpen(false);
      setEditing(null);
    } catch (e) {
      notify((e as Error).message || "Erro ao salvar empresa.", "error");
    }
  }

  async function carregarDemo() {
    try {
      const id = await seedDemo();
      await refreshEmpresas();
      setEmpresaAtiva(id);
      notify("Dados de demonstração carregados.");
    } catch (e) {
      notify((e as Error).message || "Erro ao carregar demonstração.", "error");
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await empresaService.remove(toDelete.id);
      await refreshEmpresas();
      notify("Empresa excluída.");
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setToDelete(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Empresas"
        subtitle="Gestão multiempresa — dados isolados por CNPJ."
        actions={
          <button className="btn-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nova empresa
          </button>
        }
      />

      {convitesPendentes.length > 0 && (
        <div className="card mb-5 border-primary/30 bg-accent/40 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Mail className="h-4 w-4 text-primary" /> Convites pendentes para você
          </div>
          <ul className="space-y-2">
            {convitesPendentes.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded-md bg-card px-3 py-2 text-sm">
                <span>
                  Você foi convidado para{" "}
                  <strong>{c.empresaNome || "uma empresa"}</strong> como{" "}
                  <strong>{PAPEL_LABEL[c.papel]}</strong>.
                </span>
                <button className="btn-primary btn-sm" onClick={() => aceitarConvite(c)}>
                  Aceitar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhuma empresa cadastrada"
          description="Cadastre a primeira empresa ou carregue dados de demonstração."
          action={
            <div className="flex gap-2">
              <button className="btn-primary" onClick={openCreate}>
                <Plus className="h-4 w-4" /> Nova empresa
              </button>
              <button className="btn-outline" onClick={carregarDemo}>
                Carregar demonstração
              </button>
            </div>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Empresa</th>
                <th className="px-4 py-2.5 font-medium">CNPJ</th>
                <th className="px-4 py-2.5 font-medium">Cidade</th>
                <th className="px-4 py-2.5 font-medium">Contato</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((e) => (
                <tr key={e.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-medium">
                      {e.nomeFantasia}
                      {empresaAtiva?.id === e.id && (
                        <span className="inline-flex items-center gap-1 text-xs text-primary">
                          <CheckCircle2 className="h-3.5 w-3.5" /> ativa
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{e.razaoSocial}</div>
                  </td>
                  <td className="px-4 py-3">{formatCNPJ(e.cnpj)}</td>
                  <td className="px-4 py-3">{e.cidade ? `${e.cidade}${e.uf ? `/${e.uf}` : ""}` : "—"}</td>
                  <td className="px-4 py-3">
                    <div>{e.email || "—"}</div>
                    <div className="text-xs text-muted-foreground">{e.telefone || ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {empresaAtiva?.id !== e.id && (
                        <button
                          className="btn-outline btn-sm"
                          onClick={() => setEmpresaAtiva(e.id)}
                        >
                          Selecionar
                        </button>
                      )}
                      <button className="btn-ghost btn-sm" onClick={() => openEdit(e)}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        className="btn-ghost btn-sm text-destructive"
                        onClick={() => setToDelete(e)}
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
        title={editing ? "Editar empresa" : "Nova empresa"}
        width="max-w-2xl"
        onClose={fecharModal}
        footer={
          <>
            <button className="btn-outline" onClick={fecharModal}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={save}>
              Salvar
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome fantasia" required error={errors.nomeFantasia} className="sm:col-span-2">
            <input
              className="input"
              value={form.nomeFantasia}
              onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })}
            />
          </Field>
          <Field label="Razão social" required error={errors.razaoSocial} className="sm:col-span-2">
            <input
              className="input"
              value={form.razaoSocial}
              onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })}
            />
          </Field>
          <Field label="CNPJ" required error={errors.cnpj} hint="Numérico ou alfanumérico (letras e números).">
            <input
              className="input uppercase"
              inputMode="text"
              autoCapitalize="characters"
              maxLength={18}
              value={formatCNPJ(form.cnpj)}
              onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
              placeholder="00.000.000/0000-00"
            />
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(status) =>
                setForm({ ...form, status: status as FormState["status"] })
              }
              options={[
                { value: "ativa", label: "Ativa" },
                { value: "inativa", label: "Inativa" },
              ]}
            />
          </Field>
          <Field label="E-mail" error={errors.email}>
            <input
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Telefone">
            <input
              className="input"
              inputMode="numeric"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: formatTelefone(e.target.value) })}
            />
          </Field>

          <h3 className="border-b border-border pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-2">
            Endereço
          </h3>
          <div className="sm:col-span-2">
            <EnderecoFields
              value={{
                cep: form.cep,
                logradouro: form.logradouro,
                numero: form.numero,
                complemento: form.complemento,
                bairro: form.bairro,
                cidade: form.cidade,
                uf: form.uf,
              }}
              onChange={(addr) => setForm({ ...form, ...addr })}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Excluir empresa"
        message={`Excluir "${toDelete?.nomeFantasia}"? Os lançamentos vinculados deixarão de ser exibidos.`}
        confirmLabel="Excluir"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
