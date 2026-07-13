import { usePermissions } from "@/hooks/usePermissions";
import { can, type Capability } from "@/lib/rbac";
import { useEmpresa } from "@/context/EmpresaContext";
import { EmptyState } from "@/components/ui/EmptyState";
import { ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

interface RequireCapabilityProps {
  cap: Capability;
  children: ReactNode;
  redirect?: boolean;
}

/** Bloqueia rota/conteúdo quando o papel não tem a capability. */
export function RequireCapability({ cap, children, redirect }: RequireCapabilityProps) {
  const { papel } = useEmpresa();
  if (!can(papel, cap)) {
    if (redirect) return <Navigate to="/" replace />;
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Seu papel não tem permissão para acessar esta área."
      />
    );
  }
  return <>{children}</>;
}

/** Desabilita ações de escrita quando o papel é somente leitura. */
export function WriteGate({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const { canWrite } = usePermissions();
  if (!canWrite) return <>{fallback}</>;
  return <>{children}</>;
}
