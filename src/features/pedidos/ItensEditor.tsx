import { Plus, Trash2 } from "lucide-react";
import type { ItemEditavel, Produto } from "@/types/domain";
import { formatBRL } from "@/lib/utils";

interface Props {
  itens: ItemEditavel[];
  onChange: (itens: ItemEditavel[]) => void;
  produtos: Produto[];
  precoFonte: "venda" | "custo";
}

export function ItensEditor({ itens, onChange, produtos, precoFonte }: Props) {
  function add() {
    onChange([...itens, { produtoId: null, descricao: "", quantidade: 1, valorUnitario: 0 }]);
  }
  function update(i: number, patch: Partial<ItemEditavel>) {
    onChange(itens.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function remove(i: number) {
    onChange(itens.filter((_, idx) => idx !== i));
  }
  function onSelectProduto(i: number, produtoId: string) {
    if (!produtoId) {
      update(i, { produtoId: null });
      return;
    }
    const p = produtos.find((x) => x.id === produtoId);
    if (!p) return;
    update(i, {
      produtoId,
      descricao: p.nome,
      valorUnitario: precoFonte === "venda" ? p.precoVenda : p.custoMedio,
    });
  }

  const total = itens.reduce((s, it) => s + it.quantidade * it.valorUnitario, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="label">Itens</span>
        <button type="button" className="btn-outline btn-sm" onClick={add}>
          <Plus className="h-3.5 w-3.5" /> Adicionar item
        </button>
      </div>

      {itens.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
          Nenhum item. Clique em "Adicionar item".
        </p>
      ) : (
        <div className="space-y-2">
          {itens.map((it, i) => (
            <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-md border border-border p-2">
              <div className="col-span-12 sm:col-span-5">
                <label className="text-xs text-muted-foreground">Produto / descrição</label>
                {produtos.length > 0 && (
                  <select
                    className="input mb-1 h-8 text-xs"
                    value={it.produtoId ?? ""}
                    onChange={(e) => onSelectProduto(i, e.target.value)}
                  >
                    <option value="">— avulso —</option>
                    {produtos.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                )}
                <input
                  className="input h-8"
                  placeholder="Descrição"
                  value={it.descricao}
                  onChange={(e) => update(i, { descricao: e.target.value })}
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <label className="text-xs text-muted-foreground">Qtd</label>
                <input
                  className="input h-8"
                  type="number"
                  step="0.001"
                  value={it.quantidade || ""}
                  onChange={(e) => update(i, { quantidade: Number(e.target.value) })}
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <label className="text-xs text-muted-foreground">Vlr unit.</label>
                <input
                  className="input h-8"
                  type="number"
                  step="0.01"
                  value={it.valorUnitario || ""}
                  onChange={(e) => update(i, { valorUnitario: Number(e.target.value) })}
                />
              </div>
              <div className="col-span-3 sm:col-span-2 text-right text-sm tabular-nums">
                {formatBRL(it.quantidade * it.valorUnitario)}
              </div>
              <div className="col-span-1 flex justify-end">
                <button type="button" className="btn-ghost btn-sm text-destructive" onClick={() => remove(i)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-1 text-sm font-medium">
        Total: <span className="ml-2 tabular-nums">{formatBRL(total)}</span>
      </div>
    </div>
  );
}
