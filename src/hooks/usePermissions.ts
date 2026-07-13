import { useCallback } from "react";
import { useEmpresa } from "@/context/EmpresaContext";
import { can, canWrite, type Capability } from "@/lib/rbac";

export function usePermissions() {
  const { papel } = useEmpresa();
  const canCap = useCallback((cap: Capability) => can(papel, cap), [papel]);
  return {
    papel,
    canCap,
    canWrite: canWrite(papel),
    isAdmin: can(papel, "admin"),
  };
}
