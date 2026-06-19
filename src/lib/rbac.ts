// RBAC — papéis e capacidades (do master: SEGURANÇA → RBAC).
export const PAPEIS = [
  "administrador",
  "financeiro",
  "gestor",
  "comprador",
  "vendedor",
  "contador",
  "consulta",
] as const;
export type Papel = (typeof PAPEIS)[number];

export const PAPEL_LABEL: Record<Papel, string> = {
  administrador: "Administrador",
  financeiro: "Financeiro",
  gestor: "Gestor",
  comprador: "Comprador",
  vendedor: "Vendedor",
  contador: "Contador",
  consulta: "Consulta",
};

export type Capability =
  | "dashboard"
  | "financeiro"
  | "conciliacao"
  | "documentos"
  | "fiscal"
  | "vendas"
  | "compras"
  | "estoque"
  | "cadastros"
  | "auditoria"
  | "admin" // gerenciar empresa e equipe
  | "write"; // pode alterar dados

const MATRIX: Record<Papel, Capability[]> = {
  administrador: [
    "dashboard", "financeiro", "conciliacao", "documentos", "fiscal",
    "vendas", "compras", "estoque", "cadastros", "auditoria", "admin", "write",
  ],
  financeiro: [
    "dashboard", "financeiro", "conciliacao", "documentos", "fiscal",
    "cadastros", "auditoria", "write",
  ],
  gestor: [
    "dashboard", "financeiro", "conciliacao", "documentos", "fiscal",
    "vendas", "compras", "estoque", "cadastros", "auditoria", "write",
  ],
  comprador: ["dashboard", "compras", "estoque", "cadastros", "write"],
  vendedor: ["dashboard", "vendas", "cadastros", "write"],
  contador: ["dashboard", "financeiro", "fiscal", "documentos", "auditoria"], // sem "write"
  consulta: [
    // visualiza tudo, sem "write" e sem "admin"
    "dashboard", "financeiro", "conciliacao", "documentos", "fiscal",
    "vendas", "compras", "estoque", "cadastros", "auditoria",
  ],
};

export function can(papel: Papel | null | undefined, cap: Capability): boolean {
  if (!papel) return false;
  return MATRIX[papel]?.includes(cap) ?? false;
}

export function canWrite(papel: Papel | null | undefined): boolean {
  return can(papel, "write");
}
