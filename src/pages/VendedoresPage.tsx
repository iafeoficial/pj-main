import { UserCog } from "lucide-react";
import { vendedorService } from "@/data/cadastros";
import { RequireEmpresa } from "@/components/RequireEmpresa";
import { SimpleCrud, type SimpleCrudConfig } from "@/features/crud/SimpleCrud";

const config: SimpleCrudConfig = {
  titulo: "Vendedores",
  subtitulo: "Cadastro de vendedores e percentual de comissão.",
  icon: UserCog,
  singular: "Vendedor",
  nomeKey: "nome",
  modalWidth: "max-w-xl",
  fields: [
    { key: "nome", label: "Nome", type: "text", required: true, fullWidth: true },
    { key: "email", label: "E-mail", type: "email" },
    { key: "telefone", label: "Telefone", type: "telefone" },
    { key: "cpf", label: "CPF", type: "cpfCnpj" },
    { key: "comissaoPercent", label: "Comissão (%)", type: "number", default: 0 },
    { key: "ativo", label: "Ativo", type: "checkbox", default: true },
    { key: "observacao", label: "Observação", type: "textarea", fullWidth: true, section: "Observações" },
  ],
  columns: [
    { key: "nome", label: "Nome" },
    { key: "email", label: "E-mail" },
    { key: "telefone", label: "Telefone", render: (r) => (r.telefone ? String(r.telefone) : "—") },
    { key: "comissaoPercent", label: "Comissão", align: "right", render: (r) => `${Number(r.comissaoPercent ?? 0)}%` },
    { key: "ativo", label: "Situação", render: (r) => (r.ativo ? "Ativo" : "Inativo") },
  ],
  service: vendedorService as unknown as SimpleCrudConfig["service"],
};

export function VendedoresPage() {
  return <RequireEmpresa>{(id) => <SimpleCrud config={config} empresaId={id} />}</RequireEmpresa>;
}
