import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "./ui/EmptyState";
import { useEmpresa } from "@/context/EmpresaContext";
import { can, type Capability } from "@/lib/rbac";

/** Bloqueia rotas sensíveis quando o papel não tem a capability exigida. */
export function RequireCapability({
  cap,
  children,
}: {
  cap: Capability;
  children: ReactNode;
}) {
  const { papel, loading } = useEmpresa();
  const navigate = useNavigate();

  if (loading) return null;

  if (!can(papel, cap)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Seu papel não tem permissão para acessar esta área."
        action={
          <button className="btn-primary" onClick={() => navigate("/")}>
            Voltar ao início
          </button>
        }
      />
    );
  }

  return <>{children}</>;
}
