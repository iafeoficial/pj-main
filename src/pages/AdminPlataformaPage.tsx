import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, Shield } from "lucide-react";
import type { Empresa, UserProfile } from "@/types/domain";
import { useAuth } from "@/context/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { plataformaService } from "@/data/plataforma";
import { isPlataformaAdminEmail, empresaAcessoOk } from "@/lib/acesso";
import { formatCNPJ, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { DatePicker } from "@/components/ui/DatePicker";
import { useToast } from "@/components/ui/Toast";

type Aba = "empresas" | "usuarios";

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function fromDateInput(yyyyMmDd: string): string | null {
  if (!yyyyMmDd) return null;
  return new Date(`${yyyyMmDd}T23:59:59`).toISOString();
}

export function AdminPlataformaPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const [aba, setAba] = useState<Aba>("empresas");
  const [version, setVersion] = useState(0);
  const [editEmpresa, setEditEmpresa] = useState<Empresa | null>(null);
  const [unlockEmpresa, setUnlockEmpresa] = useState<Empresa | null>(null);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);

  const allowed = isPlataformaAdminEmail(user?.email);

  const {
    data: empresas,
    loading: loadingEmp,
    error: errorEmp,
  } = useAsyncData(
    () => (allowed ? plataformaService.listEmpresas() : Promise.resolve([] as Empresa[])),
    [allowed, version],
    [] as Empresa[]
  );
  const {
    data: profiles,
    loading: loadingProf,
    error: errorProf,
  } = useAsyncData(
    () => (allowed ? plataformaService.listProfiles() : Promise.resolve([] as UserProfile[])),
    [allowed, version],
    [] as UserProfile[]
  );

  if (!allowed) return <Navigate to="/" replace />;

  const schemaPendente =
    !!(errorEmp || errorProf) &&
    /admin_list_|Could not find the function|schema cache|PGRST202|does not exist/i.test(
      `${errorEmp ?? ""} ${errorProf ?? ""}`
    );

  return (
    <>
      <PageHeader
        title="Admin da plataforma"
        subtitle="Período de uso e bloqueio de empresas e usuários (IAFÉ)."
      />

      {(errorEmp || errorProf) && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {schemaPendente ? (
            <>
              <p className="font-medium">Migration ainda não aplicada no Supabase.</p>
              <p className="mt-1 text-amber-800/90">
                Rode o arquivo{" "}
                <code className="rounded bg-amber-100 px-1">supabase/migrations/0034_acesso_periodo_bloqueio.sql</code>{" "}
                no SQL Editor do projeto (Dashboard → SQL) e depois recarregue esta página.
              </p>
            </>
          ) : (
            <p>{errorEmp || errorProf}</p>
          )}
        </div>
      )}

      <div className="mb-4 inline-flex flex-wrap gap-1 rounded-full bg-secondary p-1">
        {(
          [
            { id: "empresas" as const, label: "Empresas" },
            { id: "usuarios" as const, label: "Usuários" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            className={
              aba === t.id
                ? "rounded-full bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground"
                : "rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            }
            onClick={() => setAba(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {aba === "empresas" && (
        <div className="card overflow-x-auto">
          {loadingEmp ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">CNPJ</th>
                  <th className="px-4 py-3">Período</th>
                  <th className="px-4 py-3">Acesso</th>
                  <th className="px-4 py-3 text-right min-w-[13.5rem]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {empresas.map((e) => {
                  const ok = empresaAcessoOk(e);
                  return (
                    <tr key={e.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">{e.nomeFantasia}</div>
                        <div className="text-xs text-muted-foreground">{e.razaoSocial}</div>
                      </td>
                      <td className="px-4 py-3 tabular-nums whitespace-nowrap">{formatCNPJ(e.cnpj)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {e.acessoInicio ? formatDate(e.acessoInicio.slice(0, 10)) : "—"}
                        {" → "}
                        {e.acessoFim ? formatDate(e.acessoFim.slice(0, 10)) : "sem prazo"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {ok ? (
                          <span className="badge bg-[#E8F4EE] text-success">Liberado</span>
                        ) : e.acessoBloqueado ? (
                          <span className="badge bg-red-100 text-red-700">Bloqueado</span>
                        ) : (
                          <span className="badge bg-amber-100 text-amber-800">Período encerrado</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          {!ok && (
                            <button
                              type="button"
                              className="btn-primary btn-sm"
                              onClick={() => setUnlockEmpresa(e)}
                            >
                              Desbloquear
                            </button>
                          )}
                          <button type="button" className="btn-outline btn-sm" onClick={() => setEditEmpresa(e)}>
                            Período / bloqueio
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {empresas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhuma empresa encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {aba === "usuarios" && (
        <div className="card overflow-x-auto">
          {loadingProf ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Motivo</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {profiles.map((p) => (
                  <tr key={p.userId} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{p.email || p.userId}</td>
                    <td className="px-4 py-3">
                      {p.bloqueado ? (
                        <span className="badge bg-red-100 text-red-700">Bloqueado</span>
                      ) : (
                        <span className="badge bg-[#E8F4EE] text-success">Ativo</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {p.bloqueadoMotivo || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" className="btn-outline btn-sm" onClick={() => setEditUser(p)}>
                        {p.bloqueado ? "Desbloquear" : "Bloquear"}
                      </button>
                    </td>
                  </tr>
                ))}
                {profiles.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {editEmpresa && (
        <EmpresaAcessoModal
          empresa={editEmpresa}
          onClose={() => setEditEmpresa(null)}
          onSaved={() => {
            setEditEmpresa(null);
            setVersion((v) => v + 1);
            notify("Acesso da empresa atualizado.");
          }}
          onError={(m) => notify(m, "error")}
        />
      )}

      {unlockEmpresa && (
        <EmpresaDesbloquearModal
          empresa={unlockEmpresa}
          onClose={() => setUnlockEmpresa(null)}
          onSaved={() => {
            setUnlockEmpresa(null);
            setVersion((v) => v + 1);
            notify("Empresa desbloqueada.");
          }}
          onError={(m) => notify(m, "error")}
        />
      )}

      {editUser && (
        <UsuarioBloqueioModal
          profile={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => {
            setEditUser(null);
            setVersion((v) => v + 1);
            notify("Usuário atualizado.");
          }}
          onError={(m) => notify(m, "error")}
        />
      )}
    </>
  );
}

function EmpresaAcessoModal({
  empresa,
  onClose,
  onSaved,
  onError,
}: {
  empresa: Empresa;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [inicio, setInicio] = useState(toDateInput(empresa.acessoInicio));
  const [fim, setFim] = useState(toDateInput(empresa.acessoFim));
  const [bloqueado, setBloqueado] = useState(!!empresa.acessoBloqueado);
  const [motivo, setMotivo] = useState(empresa.acessoMotivo ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await plataformaService.updateEmpresaAcesso(empresa.id, {
        acessoInicio: inicio ? new Date(`${inicio}T00:00:00`).toISOString() : null,
        acessoFim: fromDateInput(fim),
        acessoBloqueado: bloqueado,
        acessoMotivo: motivo.trim() || null,
      });
      onSaved();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={`Acesso — ${empresa.nomeFantasia}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" disabled={saving} onClick={() => void save()}>
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Início do período">
          <DatePicker value={inicio} onChange={setInicio} placeholder="dd/mm/aaaa" />
        </Field>
        <Field label="Fim do período" hint="Vazio ou Limpar = sem prazo">
          <DatePicker value={fim} onChange={setFim} placeholder="dd/mm/aaaa" />
        </Field>
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="rounded border-border"
              checked={bloqueado}
              onChange={(e) => setBloqueado(e.target.checked)}
            />
            Bloquear empresa agora (independente do prazo)
          </label>
        </div>
        <Field label="Motivo (visível para o cliente)" className="sm:col-span-2">
          <input
            className="input"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: fim do período grátis, inadimplência…"
          />
        </Field>
      </div>
    </Modal>
  );
}

function EmpresaDesbloquearModal({
  empresa,
  onClose,
  onSaved,
  onError,
}: {
  empresa: Empresa;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [modo, setModo] = useState<"sem_prazo" | "novo_prazo">("sem_prazo");
  const [fim, setFim] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (modo === "novo_prazo" && !fim) {
      onError("Informe a nova data de fim do período, ou escolha sem prazo.");
      return;
    }
    setSaving(true);
    try {
      const hoje = new Date();
      const inicioIso = new Date(
        `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}T00:00:00`
      ).toISOString();
      await plataformaService.updateEmpresaAcesso(empresa.id, {
        acessoInicio: inicioIso,
        acessoFim: modo === "sem_prazo" ? null : fromDateInput(fim),
        acessoBloqueado: false,
        acessoMotivo: null,
      });
      onSaved();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={`Desbloquear — ${empresa.nomeFantasia}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" disabled={saving} onClick={() => void save()}>
            {saving ? "Salvando…" : "Desbloquear"}
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted-foreground">
        Como liberar o acesso desta empresa?
      </p>
      <div className="space-y-2">
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-secondary/60">
          <input
            type="radio"
            name="unlock-modo"
            className="mt-0.5"
            checked={modo === "sem_prazo"}
            onChange={() => setModo("sem_prazo")}
          />
          <span>
            <span className="font-medium">Sem prazo</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Acesso liberado sem data de fim. Pode definir um prazo depois em Período / bloqueio.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-secondary/60">
          <input
            type="radio"
            name="unlock-modo"
            className="mt-0.5"
            checked={modo === "novo_prazo"}
            onChange={() => setModo("novo_prazo")}
          />
          <span>
            <span className="font-medium">Com novo prazo</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Define uma nova data de fim. O início passa a ser hoje.
            </span>
          </span>
        </label>
      </div>
      {modo === "novo_prazo" && (
        <Field label="Novo fim do período" className="mt-3">
          <DatePicker value={fim} onChange={setFim} placeholder="dd/mm/aaaa" />
        </Field>
      )}
    </Modal>
  );
}

function UsuarioBloqueioModal({
  profile,
  onClose,
  onSaved,
  onError,
}: {
  profile: UserProfile;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const bloqueando = !profile.bloqueado;
  const [motivo, setMotivo] = useState(profile.bloqueadoMotivo ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await plataformaService.setProfileBloqueado(
        profile.userId,
        bloqueando,
        bloqueando ? motivo.trim() || null : null
      );
      onSaved();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={bloqueando ? "Bloquear usuário" : "Desbloquear usuário"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className={bloqueando ? "btn-primary" : "btn-outline"}
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "Salvando…" : bloqueando ? "Bloquear" : "Desbloquear"}
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted-foreground">
        <Shield className="mr-1 inline h-4 w-4" />
        {profile.email || profile.userId}
      </p>
      {bloqueando && (
        <Field label="Motivo (visível na tela de bloqueio)">
          <input
            className="input"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: falta de pagamento"
          />
        </Field>
      )}
      {!bloqueando && (
        <p className="text-sm text-muted-foreground">O usuário voltará a acessar o sistema normalmente.</p>
      )}
    </Modal>
  );
}
