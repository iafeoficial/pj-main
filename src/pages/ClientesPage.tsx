import { Users } from "lucide-react";
import { clienteService } from "@/data/cadastros";
import { RequireEmpresa } from "@/components/RequireEmpresa";
import { ParceiroCrud, type ParceiroCrudConfig } from "@/features/cadastros/ParceiroCrud";

const config: ParceiroCrudConfig = {
  titulo: "Clientes",
  subtitulo: "Cadastro de clientes para vendas e contas a receber.",
  icon: Users,
  singular: "Cliente",
  variant: "cliente" as const,
  service: clienteService as unknown as ParceiroCrudConfig["service"],
};

export function ClientesPage() {
  return <RequireEmpresa>{(id) => <ParceiroCrud config={config} empresaId={id} />}</RequireEmpresa>;
}
