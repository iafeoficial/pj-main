import { Fragment, type ReactNode } from "react";
import { Building2, Loader2, ShieldOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "./ui/EmptyState";
import { useEmpresa } from "@/context/EmpresaContext";
import { empresaAcessoMotivo, empresaAcessoOk } from "@/lib/acesso";

/** Garante uma empresa ativa e com acesso liberado antes de renderizar módulos financeiros. */
export function RequireEmpresa({ children }: { children: (empresaId: string) => ReactNode }) {
  const { empresaAtiva, loading } = useEmpresa();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!empresaAtiva) {
    return (
      <EmptyState
        icon={Building2}
        title="Nenhuma empresa selecionada"
        description="Cadastre uma empresa para começar a usar os módulos financeiros."
        action={
          <button className="btn-primary" onClick={() => navigate("/empresas")}>
            Cadastrar empresa
          </button>
        }
      />
    );
  }

  if (!empresaAcessoOk(empresaAtiva)) {
    return (
      <EmptyState
        icon={ShieldOff}
        title="Acesso à empresa bloqueado"
        description={empresaAcessoMotivo(empresaAtiva)}
        action={
          <button className="btn-outline" onClick={() => navigate("/empresas")}>
            Ver empresas
          </button>
        }
      />
    );
  }

  return <Fragment key={empresaAtiva.id}>{children(empresaAtiva.id)}</Fragment>;
}
