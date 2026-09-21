import { useState } from "react";
import { UserPlus, Trash2, ShieldAlert, Mail, X } from "lucide-react";
import { membroService, conviteService, type Convite, type Membro } from "@/data/membros";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { PAPEIS, PAPEL_LABEL, can, type Papel } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RequireEmpresa } from "@/components/RequireEmpresa";
import { useToast } from "@/components/ui/Toast";

function Inner({ empresaId }: { empresaId: string }) {
  const { version, bumpData, papel } = useEmpresa();
  const { notify } = useToast();
  const isAdmin = can(papel, "admin");

  const { data: membros } = useAsyncData(() => membroService.list(empresaId), [empresaId, version], [] as Membro[]);
  const { data: convites } = useAsyncData(
    () => (isAdmin ? conviteService.listDaEmpresa(empresaId) : Promise.resolve([])),
    [empresaId, version, isAdmin],
    [] as Convite[]
  );

  const [email, setEmail] = useState("");
  const [novoPapel, setNovoPapel] = useState<Papel>("consulta");
  const [toRemove, setToRemove] = useState<Membro | null>(null);

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Equipe" subtitle="Membros da empresa." />
        <EmptyState icon={ShieldAlert} title="Acesso restrito" description="Apenas administradores gerenciam a equipe." />
      </>
    );
  }

  async function convidar() {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      notify("Informe um e-mail válido.", "error");
      return;
    }
    try {
      await conviteService.create(empresaId, email, novoPapel);
      bumpData();
      notify("Convite enviado. O usuário aceita ao entrar com esse e-mail.");
      setEmail("");
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  async function mudarPapel(m: Membro, papelNovo: Papel) {
    try {
      await membroService.updatePapel(empresaId, m.id, papelNovo);
      bumpData();
      notify("Papel atualizado.");
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  async function confirmarRemover() {
    if (!toRemove) return;
    try {
      await membroService.remove(empresaId, toRemove.id);
      bumpData();
      notify("Membro removido.");
    } catch (e) {
      notify((e as Error).message, "error");
    }
    setToRemove(null);
  }

  async function cancelarConvite(c: Convite) {
    try {
      await conviteService.cancelar(empresaId, c.id);
      bumpData();
      notify("Convite cancelado.");
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  const pendentes = convites.filter((c) => c.status === "pendente");

  return (
    <>
      <PageHeader title="Equipe" subtitle="Membros da empresa e seus papéis (RBAC)." />

      {/* Convidar */}
      <div className="card mb-6 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <UserPlus className="h-4 w-4 text-primary" /> Convidar membro
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end">
          <Field label="E-mail">
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@empresa.com" />
          </Field>
          <Field label="Papel">
            <Select
              value={novoPapel}
              onChange={(v) => setNovoPapel(v as Papel)}
              options={PAPEIS.map((p) => ({ value: p, label: PAPEL_LABEL[p] }))}
            />
          </Field>
          <button className="btn-primary" onClick={convidar}>Convidar</button>
        </div>
      </div>

      {/* Membros */}
      <h2 className="mb-3 text-sm font-semibold">Membros</h2>
      <div className="card mb-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">E-mail</th>
              <th className="px-4 py-2.5 font-medium">Papel</th>
              <th className="px-4 py-2.5 font-medium">Desde</th>
              <th className="px-4 py-2.5 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {membros.map((m) => (
              <tr key={m.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">{m.email || "—"}</td>
                <td className="px-4 py-3">
                  <Select
                    className="w-40 [&>button]:h-8 [&>button]:text-xs"
                    value={m.papel}
                    onChange={(v) => mudarPapel(m, v as Papel)}
                    options={PAPEIS.map((p) => ({ value: p, label: PAPEL_LABEL[p] }))}
                  />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(m.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <button className="btn-ghost btn-sm text-destructive" onClick={() => setToRemove(m)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Convites pendentes */}
      {pendentes.length > 0 && (
        <>
          <h2 className="mb-3 text-sm font-semibold">Convites pendentes</h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {pendentes.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {c.email}</span>
                    </td>
                    <td className="px-4 py-3">{PAPEL_LABEL[c.papel]}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="btn-ghost btn-sm" onClick={() => cancelarConvite(c)}>
                        <X className="h-4 w-4" /> Cancelar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!toRemove}
        title="Remover membro"
        message={`Remover "${toRemove?.email}" desta empresa?`}
        confirmLabel="Remover"
        destructive
        onConfirm={confirmarRemover}
        onCancel={() => setToRemove(null)}
      />
    </>
  );
}

export function MembrosPage() {
  return <RequireEmpresa>{(id) => <Inner empresaId={id} />}</RequireEmpresa>;
}
