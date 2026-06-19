import { Truck } from "lucide-react";
import { fornecedorService } from "@/data/cadastros";
import { RequireEmpresa } from "@/components/RequireEmpresa";
import { SimpleCrud, type SimpleCrudConfig } from "@/features/crud/SimpleCrud";

const config: SimpleCrudConfig = {
  titulo: "Fornecedores",
  subtitulo: "Cadastro de fornecedores para compras e contas a pagar.",
  icon: Truck,
  singular: "Fornecedor",
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
  service: fornecedorService as unknown as SimpleCrudConfig["service"],
};

export function FornecedoresPage() {
  return <RequireEmpresa>{(id) => <SimpleCrud config={config} empresaId={id} />}</RequireEmpresa>;
}
