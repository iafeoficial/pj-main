import { useMemo, useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Building2, Pencil, Plus, Trash2, CheckCircle2, Mail } from "lucide-react";
import type { Empresa } from "@/types/domain";
import { empresaService } from "@/data/services";
import { seedDemo } from "@/data/seed";
import { conviteService, type Convite, type ConvitePreview } from "@/data/membros";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { PAPEL_LABEL } from "@/lib/rbac";
import { formatCNPJ, isValidCNPJ } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

interface FormState {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  email: string;
  telefone: string;
  status: "ativa" | "inativa";
}

const EMPTY: FormState = {
  cnpj: "",
  razaoSocial: "",
  nomeFantasia: "",
  email: "",
  telefone: "",
  status: "ativa",
};

export function EmpresasPage() {
  const { empresas, empresaAtiva, version, refreshEmpresas, setEmpresaAtiva, bumpData } = useEmpresa();
  const { user } = useAuth();
  const { notify } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const { data: convitesPendentes } = useAsyncData(
    () => (user?.email ? conviteService.meusPendentes(user.email) : Promise.resolve([])),
    [user?.email, version],
    [] as Convite[]
  );

  const [conviteToken, setConviteToken] = useState<ConvitePreview | null>(null);
  const [conviteTokenLoading, setConviteTokenLoading] = useState(false);

  useEffect(() => {
    const token = searchParams.get("convite");
    if (!token || !user) return;
    setConviteTokenLoading(true);
    conviteService
      .buscarPorToken(token)
      .then((preview) => {
        if (!preview) {
          notify("Convite inválido ou já utilizado.", "error");
          setSearchParams({});
          return;
        }
        if (user.email && preview.email.toLowerCase() !== user.email.toLowerCase()) {
          notify(`Este convite é para ${preview.email}. Entre com esse e-mail.`, "error");
          setSearchParams({});
          return;
        }
        setConviteToken(preview);
      })
      .catch((e) => notify((e as Error).message, "error"))
      .finally(() => setConviteTokenLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispara ao abrir link com token
  }, [searchParams, user]);

  async function aceitarConvite(c: Convite | ConvitePreview, token?: string) {
    try {
      if (token) {
        await conviteService.aceitarPorToken(token);
      } else {
        await conviteService.aceitar(c.id);
      }
      await refreshEmpresas();
      setEmpresaAtiva(c.empresaId);
      bumpData();
      setConviteToken(null);
      setSearchParams({});
      notify("Convite aceito! Você agora tem acesso à empresa.");
      navigate("/");
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Empresa | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toDelete, setToDelete] = useState<Empresa | null>(null);

  const sorted = useMemo(() => empresas, [empresas]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(e: Empresa) {
    setEditing(e);
    setForm({
      cnpj: e.cnpj,
      razaoSocial: e.razaoSocial,
      nomeFantasia: e.nomeFantasia,
      email: e.email,
      telefone: e.telefone,
      status: e.status,
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
      }
      await refreshEmpresas();
      setModalOpen(false);
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
          <p className="mb-3 text-xs text-muted-foreground">
            Aceite abaixo para acessar a empresa com o papel indicado.
          </p>
          <ul className="space-y-2">
            {convitesPendentes.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded-md bg-card px-3 py-2 text-sm">
                <span>
                  Convite como <strong>{PAPEL_LABEL[c.papel]}</strong>.
                </span>
                <button className="btn-primary btn-sm" onClick={() => aceitarConvite(c)}>
                  Aceitar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal
        open={!!conviteToken && !conviteTokenLoading}
        title="Aceitar convite"
        onClose={() => {
          setConviteToken(null);
          setSearchParams({});
        }}
        footer={
          <>
            <button
              className="btn-outline"
              onClick={() => {
                setConviteToken(null);
                setSearchParams({});
              }}
            >
              Depois
            </button>
            <button
              className="btn-primary"
              onClick={() => conviteToken && aceitarConvite(conviteToken, searchParams.get("convite") ?? undefined)}
            >
              Aceitar convite
            </button>
          </>
        }
      >
        {conviteToken && (
          <p className="text-sm text-muted-foreground">
            Você foi convidado para <strong>{conviteToken.empresaNome}</strong> como{" "}
            <strong>{PAPEL_LABEL[conviteToken.papel]}</strong>. Ao aceitar, a empresa ficará disponível
            no seletor superior.
          </p>
        )}
      </Modal>

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
          <Field label="CNPJ" required error={errors.cnpj}>
            <input
              className="input"
              value={formatCNPJ(form.cnpj)}
              onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
              placeholder="00.000.000/0000-00"
            />
          </Field>
          <Field label="Status">
            <select
              className="input"
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as FormState["status"] })
              }
            >
              <option value="ativa">Ativa</option>
              <option value="inativa">Inativa</option>
            </select>
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
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            />
          </Field>
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
