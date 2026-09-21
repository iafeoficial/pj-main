export type EntityType =
  | "conta-pagar"
  | "conta-receber"
  | "compra"
  | "venda"
  | "documento";

/** Extrai referência de pedido a partir de observação ou documento de estoque. */
export function parsePedidoRef(text: string): { type: "compra" | "venda"; prefix: string } | null {
  const m = text.match(/^(Compra|Venda)\s+([a-f0-9]{8})/i);
  if (!m) return null;
  return {
    type: m[1].toLowerCase() as "compra" | "venda",
    prefix: m[2],
  };
}

/** Resolve ID completo a partir do prefixo de 8 caracteres. */
export function resolveIdByPrefix(ids: string[], prefix: string): string | null {
  return ids.find((id) => id.startsWith(prefix)) ?? null;
}

/** Extrai origem de conta a partir da observação. */
export function parseContaOrigem(observacao: string): { type: EntityType; prefix: string } | null {
  const compra = observacao.match(/Pedido de compra\s+([a-f0-9]{8})/i);
  if (compra) return { type: "compra", prefix: compra[1] };
  const venda = observacao.match(/^Venda\s+([a-f0-9]{8})/i);
  if (venda) return { type: "venda", prefix: venda[1] };
  const comissao = observacao.match(/Comissão ref\./i);
  if (comissao) return null;
  return null;
}
