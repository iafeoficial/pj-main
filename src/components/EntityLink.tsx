import { Link } from "react-router-dom";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  FileText,
  ShoppingBag,
  ShoppingCart,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { EntityType } from "@/lib/entityLinks";

const CONFIG: Record<EntityType, { to: (id: string) => string; icon: LucideIcon; defaultLabel: string }> = {
  "conta-pagar": {
    to: (id) => `/contas-pagar?id=${id}`,
    icon: ArrowUpCircle,
    defaultLabel: "Conta a pagar",
  },
  "conta-receber": {
    to: (id) => `/contas-receber?id=${id}`,
    icon: ArrowDownCircle,
    defaultLabel: "Conta a receber",
  },
  compra: {
    to: (id) => `/compras?id=${id}`,
    icon: ShoppingCart,
    defaultLabel: "Compra",
  },
  venda: {
    to: (id) => `/vendas?id=${id}`,
    icon: ShoppingBag,
    defaultLabel: "Venda",
  },
  documento: {
    to: (id) => `/documentos?id=${id}`,
    icon: FileText,
    defaultLabel: "Documento",
  },
};

/** Link React Router com ícone conforme o tipo de entidade. */
export function EntityLink({
  type,
  id,
  label,
  className = "",
}: {
  type: EntityType;
  id: string;
  label?: string;
  className?: string;
}) {
  const cfg = CONFIG[type];
  const Icon = cfg.icon;
  return (
    <Link
      to={cfg.to(id)}
      className={`inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline ${className}`}
    >
      <Icon className="h-3 w-3" />
      {label ?? cfg.defaultLabel}
    </Link>
  );
}
