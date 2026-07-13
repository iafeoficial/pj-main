import { useState } from "react";
import { UserPlus, Trash2, ShieldAlert, Mail, X, Copy, Check } from "lucide-react";
import { membroService, conviteService, type Convite, type Membro } from "@/data/membros";
import { conviteLink } from "@/lib/conviteLink";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { PAPEIS, PAPEL_LABEL, can, type Papel } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
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
  const [ultimoConvite, setUltimoConvite] = useState<Convite | null>(null);
  const [copiado, setCopiado] = useState(false);

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
      const convite = await conviteService.create(empresaId, email, novoPapel);
      bumpData();
      setUltimoConvite(convite);
      setCopiado(false);
      notify("Convite criado. Compartilhe o link com o convidado.");
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

  async function copiarLink() {
    if (!ultimoConvite) return;
    try {
      await navigator.clipboard.writeText(conviteLink(ultimoConvite.token));
      setCopiado(true);
      notify("Link copiado.");
    } catch {
      notify("Não foi possível copiar. Selecione o link manualmente.", "error");
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
            <select className="input" value={novoPapel} onChange={(e) => setNovoPapel(e.target.value as Papel)}>
              {PAPEIS.map((p) => <option key={p} value={p}>{PAPEL_LABEL[p]}</option>)}
            </select>
          </Field>
          <button className="btn-primary" onClick={convidar}>Convidar</button>
        </div>
        {ultimoConvite && (
          <div className="mt-4 space-y-3 rounded-md border border-primary/30 bg-accent/30 p-3 text-sm">
            <p>
              Compartilhe este link com <strong>{ultimoConvite.email}</strong>. A pessoa deve{" "}
              <strong>criar conta ou entrar com exatamente este e-mail</strong> e aceitar o convite
              como <strong>{PAPEL_LABEL[ultimoConvite.papel]}</strong>.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input className="input min-w-0 flex-1 text-xs" readOnly value={conviteLink(ultimoConvite.token)} />
              <button type="button" className="btn-outline btn-sm shrink-0" onClick={copiarLink}>
                {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiado ? "Copiado" : "Copiar link"}
              </button>
            </div>
          </div>
        )}
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
                  <select
                    className="input h-8 w-40 text-xs"
                    value={m.papel}
                    onChange={(e) => mudarPapel(m, e.target.value as Papel)}
                  >
                    {PAPEIS.map((p) => <option key={p} value={p}>{PAPEL_LABEL[p]}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(m.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <button className="btn-ghost btn-sm btn-delete" title="Remover" onClick={() => setToRemove(m)}>
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
