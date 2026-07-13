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
  fields: [
    { key: "nome", label: "Nome", type: "text", required: true, fullWidth: true },
    { key: "email", label: "E-mail", type: "email" },
    { key: "comissaoPercent", label: "Comissão (%)", type: "number", default: 0 },
    { key: "ativo", label: "Ativo", type: "checkbox", default: true },
  ],
  columns: [
    { key: "nome", label: "Nome" },
    { key: "email", label: "E-mail" },
    { key: "comissaoPercent", label: "Comissão", align: "right", render: (r) => `${Number(r.comissaoPercent ?? 0)}%` },
    { key: "ativo", label: "Situação", render: (r) => (r.ativo ? "Ativo" : "Inativo") },
  ],
  service: vendedorService as unknown as SimpleCrudConfig["service"],
};

export function VendedoresPage() {
  return <RequireEmpresa>{(id) => <SimpleCrud config={config} empresaId={id} />}</RequireEmpresa>;
}
