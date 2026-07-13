import { Package } from "lucide-react";
import { produtoService } from "@/data/estoque";
import { formatBRL } from "@/lib/utils";
import { RequireEmpresa } from "@/components/RequireEmpresa";
import { SimpleCrud, type SimpleCrudConfig } from "@/features/crud/SimpleCrud";

const config: SimpleCrudConfig = {
  titulo: "Produtos",
  subtitulo: "Catálogo de produtos. Saldo e custo médio são atualizados pelas movimentações.",
  icon: Package,
  singular: "Produto",
  nomeKey: "nome",
  fields: [
    { key: "nome", label: "Nome", type: "text", required: true, fullWidth: true },
    { key: "sku", label: "SKU", type: "text" },
    { key: "unidade", label: "Unidade", type: "text", default: "un" },
    { key: "precoVenda", label: "Preço de venda (R$)", type: "number", default: 0 },
    { key: "controlaEstoque", label: "Controla estoque", type: "checkbox", default: true },
    { key: "ativo", label: "Ativo", type: "checkbox", default: true },
  ],
  columns: [
    { key: "nome", label: "Produto" },
    { key: "sku", label: "SKU" },
    { key: "precoVenda", label: "Preço", align: "right", render: (r) => formatBRL(Number(r.precoVenda ?? 0)) },
    { key: "estoqueAtual", label: "Estoque", align: "right", render: (r) => (r.controlaEstoque ? String(Number(r.estoqueAtual ?? 0)) : "—") },
    { key: "custoMedio", label: "Custo médio", align: "right", render: (r) => formatBRL(Number(r.custoMedio ?? 0)) },
    { key: "ativo", label: "Situação", render: (r) => (r.ativo ? "Ativo" : "Inativo") },
  ],
  service: produtoService as unknown as SimpleCrudConfig["service"],
};

export function ProdutosPage() {
  return <RequireEmpresa>{(id) => <SimpleCrud config={config} empresaId={id} />}</RequireEmpresa>;
}
