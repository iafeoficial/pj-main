import { ScrollText } from "lucide-react";
import type { AuditLog } from "@/types/domain";
import { listAudit } from "@/data/audit";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { RequireEmpresa } from "@/components/RequireEmpresa";

const ACAO_LABEL: Record<string, string> = {
  inclusao: "Inclusão",
  alteracao: "Alteração",
  exclusao: "Exclusão",
  baixa: "Baixa",
  cancelamento: "Cancelamento",
};

const ACAO_STYLE: Record<string, string> = {
  inclusao: "bg-emerald-100 text-emerald-700",
  alteracao: "bg-blue-100 text-blue-700",
  exclusao: "bg-red-100 text-red-700",
  baixa: "bg-teal-100 text-teal-700",
  cancelamento: "bg-amber-100 text-amber-700",
};

function Inner({ empresaId }: { empresaId: string }) {
  const { version } = useEmpresa();
  const { data: logs } = useAsyncData(
    () => listAudit(empresaId),
    [empresaId, version],
    [] as AuditLog[]
  );

  return (
    <>
      <PageHeader
        title="Auditoria"
        subtitle="Registro de ações relevantes (inclusão, alteração, exclusão, baixa e cancelamento)."
      />

      {logs.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Sem registros de auditoria"
          description="As ações realizadas nesta empresa aparecerão aqui."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Data/Hora</th>
                <th className="px-4 py-2.5 font-medium">Ação</th>
                <th className="px-4 py-2.5 font-medium">Entidade</th>
                <th className="px-4 py-2.5 font-medium">Descrição</th>
                <th className="px-4 py-2.5 font-medium">Usuário</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-muted/30">
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                    {new Date(l.createdAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`badge ${ACAO_STYLE[l.acao] ?? "bg-muted"}`}>
                      {ACAO_LABEL[l.acao] ?? l.acao}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{l.entidade}</td>
                  <td className="px-4 py-2.5">{l.descricao}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{l.usuario}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function AuditoriaPage() {
  return <RequireEmpresa>{(id) => <Inner empresaId={id} />}</RequireEmpresa>;
}
