import { Building2 } from "lucide-react";
import { useEmpresa } from "@/context/EmpresaContext";
import { Select } from "@/components/ui/Select";

export function EmpresaSelector() {
  const { empresas, empresaAtiva, setEmpresaAtiva } = useEmpresa();

  if (empresas.length === 0) return null;

  return (
    <div className="relative">
      <label className="sr-only" htmlFor="empresa-select">
        Empresa ativa
      </label>
      <Building2 className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Select
        id="empresa-select"
        className="[&>button]:h-10 [&>button]:pl-9 [&>button]:font-medium"
        value={empresaAtiva?.id ?? ""}
        onChange={setEmpresaAtiva}
        options={empresas.map((e) => ({ value: e.id, label: e.nomeFantasia }))}
      />
    </div>
  );
}
