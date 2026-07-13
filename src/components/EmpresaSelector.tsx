import { Building2, ChevronDown } from "lucide-react";
import { useEmpresa } from "@/context/EmpresaContext";

export function EmpresaSelector() {
  const { empresas, empresaAtiva, setEmpresaAtiva } = useEmpresa();

  if (empresas.length === 0) return null;

  return (
    <div className="relative">
      <label className="sr-only" htmlFor="empresa-select">
        Empresa ativa
      </label>
      <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <select
        id="empresa-select"
        className="input h-10 appearance-none pl-9 pr-9 font-medium"
        value={empresaAtiva?.id ?? ""}
        onChange={(e) => setEmpresaAtiva(e.target.value)}
      >
        {empresas.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nomeFantasia}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
