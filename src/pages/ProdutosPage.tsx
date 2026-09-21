import { Package } from "lucide-react";
import { produtoService } from "@/data/estoque";
import { formatBRL } from "@/lib/utils";
import { RequireEmpresa } from "@/components/RequireEmpresa";
import { SimpleCrud, type SimpleCrudConfig } from "@/features/crud/SimpleCrud";

const UNIDADE_OPTIONS = [
  { value: "un", label: "un — Unidade" },
  { value: "cx", label: "cx — Caixa" },
  { value: "pct", label: "pct — Pacote" },
  { value: "kg", label: "kg — Quilograma" },
  { value: "g", label: "g — Grama" },
  { value: "L", label: "L — Litro" },
  { value: "mL", label: "mL — Mililitro" },
  { value: "m", label: "m — Metro" },
  { value: "m²", label: "m² — Metro quadrado" },
  { value: "hr", label: "hr — Hora (serviços)" },
];

const config: SimpleCrudConfig = {
  titulo: "Produtos",
  subtitulo: "Catálogo de produtos. Saldo e custo médio são atualizados pelas movimentações.",
  icon: Package,
  singular: "Produto",
  nomeKey: "nome",
  modalWidth: "max-w-xl",
  fields: [
    { key: "nome", label: "Nome", type: "text", required: true, fullWidth: true },
    { key: "sku", label: "SKU", type: "text" },
    {
      key: "unidade",
      label: "Unidade de medida",
      type: "select",
      default: "un",
      options: UNIDADE_OPTIONS,
      hint: "Como o produto é medido ou vendido.",
    },

    { key: "precoVenda", label: "Preço de venda (R$)", type: "number", default: 0 },
    { key: "controlaEstoque", label: "Controla estoque", type: "checkbox", default: true },
    { key: "ativo", label: "Ativo", type: "checkbox", default: true },
    { key: "descricao", label: "Descrição", type: "textarea", fullWidth: true, section: "Detalhes" },
    { key: "observacao", label: "Observação", type: "textarea", fullWidth: true },
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
