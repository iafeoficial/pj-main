import { Truck } from "lucide-react";
import { fornecedorService } from "@/data/cadastros";
import { RequireEmpresa } from "@/components/RequireEmpresa";
import { ParceiroCrud, type ParceiroCrudConfig } from "@/features/cadastros/ParceiroCrud";

const config: ParceiroCrudConfig = {
  titulo: "Fornecedores",
  subtitulo: "Cadastro de fornecedores para compras e contas a pagar.",
  icon: Truck,
  singular: "Fornecedor",
  variant: "fornecedor" as const,
  service: fornecedorService as unknown as ParceiroCrudConfig["service"],
};

export function FornecedoresPage() {
  return <RequireEmpresa>{(id) => <ParceiroCrud config={config} empresaId={id} />}</RequireEmpresa>;
}
