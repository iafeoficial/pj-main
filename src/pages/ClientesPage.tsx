import { Users } from "lucide-react";
import { clienteService } from "@/data/cadastros";
import { RequireEmpresa } from "@/components/RequireEmpresa";
import { SimpleCrud, type SimpleCrudConfig } from "@/features/crud/SimpleCrud";

const config: SimpleCrudConfig = {
  titulo: "Clientes",
  subtitulo: "Cadastro de clientes para vendas e contas a receber.",
  icon: Users,
  singular: "Cliente",
  nomeKey: "nome",
  fields: [
    { key: "nome", label: "Nome", type: "text", required: true, fullWidth: true },
    { key: "cnpjCpf", label: "CNPJ/CPF", type: "text" },
    { key: "telefone", label: "Telefone", type: "text" },
    { key: "email", label: "E-mail", type: "email", fullWidth: true },
    { key: "ativo", label: "Ativo", type: "checkbox", default: true },
  ],
  columns: [
    { key: "nome", label: "Nome" },
    { key: "cnpjCpf", label: "CNPJ/CPF" },
    { key: "email", label: "E-mail" },
    { key: "ativo", label: "Situação", render: (r) => (r.ativo ? "Ativo" : "Inativo") },
  ],
  service: clienteService as unknown as SimpleCrudConfig["service"],
};

export function ClientesPage() {
  return <RequireEmpresa>{(id) => <SimpleCrud config={config} empresaId={id} />}</RequireEmpresa>;
}
