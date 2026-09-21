import { useState } from "react";
import { ShoppingCart, Plus, CheckCircle2, PackageCheck, Ban, Trash2 } from "lucide-react";
import type { Categoria, CentroCusto, Fornecedor, ItemEditavel, PedidoCompra, Produto } from "@/types/domain";
import { compraService } from "@/data/operacao";
import { fornecedorService } from "@/data/cadastros";
import { produtoService } from "@/data/estoque";
import { categoriaService, centroCustoService } from "@/data/services";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatBRL, formatDate, today } from "@/lib/utils";
import { canWrite } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RequireEmpresa } from "@/components/RequireEmpresa";
import { useToast } from "@/components/ui/Toast";
import { ItensEditor } from "@/features/pedidos/ItensEditor";
import { EntityLink } from "@/components/EntityLink";

const STATUS_STYLE: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  aprovado: "bg-blue-100 text-blue-700",
  recebido: "bg-emerald-100 text-emerald-700",
  cancelado: "bg-zinc-200 text-zinc-600 line-through",
};

function Inner({ empresaId }: { empresaId: string }) {
  const { version, bumpData, papel } = useEmpresa();
  const readOnly = !canWrite(papel);
  const { notify } = useToast();

  const { data: pedidos } = useAsyncData(() => compraService.list(empresaId), [empresaId, version], [] as PedidoCompra[]);
  const { data: fornecedores } = useAsyncData(() => fornecedorService.listAtivos(empresaId), [empresaId, version], [] as Fornecedor[]);
  const { data: produtos } = useAsyncData(() => produtoService.listAtivos(empresaId), [empresaId, version], [] as Produto[]);
  const { data: categorias } = useAsyncData(() => categoriaService.listAtivas(empresaId, "despesa"), [empresaId, version], [] as Categoria[]);
  const { data: centros } = useAsyncData(() => centroCustoService.listAtivos(empresaId), [empresaId, version], [] as CentroCusto[]);

  // criar pedido
  const [novoOpen, setNovoOpen] = useState(false);
  const [fornecedorId, setFornecedorId] = useState("");
  const [data, setData] = useState(today());
  const [obs, setObs] = useState("");
  const [itens, setItens] = useState<ItemEditavel[]>([]);

  // receber
  const [receber, setReceber] = useState<PedidoCompra | null>(null);
  const [vencimento, setVencimento] = useState(today());
  const [categoriaId, setCategoriaId] = useState("");
  const [centroId, setCentroId] = useState("");

  const [toCancel, setToCancel] = useState<PedidoCompra | null>(null);
  const [toDelete, setToDelete] = useState<PedidoCompra | null>(null);

  function abrirNovo() {
    setFornecedorId("");
    setData(today());
    setObs("");
    setItens([]);
    setNovoOpen(true);
  }

  async function criar() {
    try {
      const f = fornecedores.find((x) => x.id === fornecedorId);
      await compraService.create(empresaId, {
        fornecedorId: fornecedorId || null,
        fornecedorNome: f?.nome ?? "",
        data,
        observacao: obs,
        itens,
      });
      bumpData();
      notify("Pedido de compra criado.");
      setNovoOpen(false);
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  async function aprovar(p: PedidoCompra) {
    try {
      await compraService.aprovar(empresaId, p.id);
      bumpData();
      notify("Pedido aprovado.");
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  function abrirReceber(p: PedidoCompra) {
    setReceber(p);
    setVencimento(today());
    setCategoriaId("");
    setCentroId("");
  }
  async function confirmarReceber() {
    if (!receber) return;
    try {
      await compraService.receber(empresaId, receber.id, {
        dataVencimento: vencimento,
        categoriaId: categoriaId || null,
        centroCustoId: centroId || null,
      });
      bumpData();
      notify("Pedido recebido: conta a pagar e estoque atualizados.");
      setReceber(null);
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  async function confirmarCancelar() {
    if (!toCancel) return;
    try {
      await compraService.cancelar(empresaId, toCancel.id);
      bumpData();
      notify("Pedido cancelado.");
    } catch (e) {
      notify((e as Error).message, "error");
    }
    setToCancel(null);
  }
  async function confirmarExcluir() {
    if (!toDelete) return;
    try {
      await compraService.remove(empresaId, toDelete.id);
      bumpData();
      notify("Pedido excluído.");
    } catch (e) {
      notify((e as Error).message, "error");
    }
    setToDelete(null);
  }

  return (
    <>
      <PageHeader
        title="Compras"
        subtitle="Pedidos de compra. Ao receber, geram conta a pagar e entrada no estoque."
        actions={
          !readOnly ? (
            <button className="btn-primary" onClick={abrirNovo}>
              <Plus className="h-4 w-4" /> Novo pedido
            </button>
          ) : undefined
        }
      />

      {pedidos.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Nenhum pedido de compra"
          description="Crie um pedido, aprove e receba para gerar a conta a pagar."
          action={<button className="btn-primary" onClick={abrirNovo}><Plus className="h-4 w-4" /> Novo pedido</button>}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Data</th>
                <th className="px-4 py-2.5 font-medium">Fornecedor</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Financeiro</th>
                <th className="px-4 py-2.5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pedidos.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="whitespace-nowrap px-4 py-3">{formatDate(p.data)}</td>
                  <td className="px-4 py-3">{p.fornecedorNome || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatBRL(p.valorTotal)}</td>
                  <td className="px-4 py-3"><span className={`badge ${STATUS_STYLE[p.status]}`}>{p.status}</span></td>
                  <td className="px-4 py-3">
                    {p.contaPagarId ? (
                      <EntityLink type="conta-pagar" id={p.contaPagarId} label="Conta a pagar" />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {!readOnly && p.status === "rascunho" && (
                        <button className="btn-outline btn-sm" onClick={() => aprovar(p)}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
                        </button>
                      )}
                      {!readOnly && (p.status === "aprovado" || p.status === "rascunho") && (
                        <button className="btn-outline btn-sm" onClick={() => abrirReceber(p)}>
                          <PackageCheck className="h-3.5 w-3.5" /> Receber
                        </button>
                      )}
                      {!readOnly && p.status !== "cancelado" && p.status !== "recebido" && (
                        <button className="btn-ghost btn-sm text-warning" title="Cancelar" onClick={() => setToCancel(p)}>
                          <Ban className="h-4 w-4" />
                        </button>
                      )}
                      {!readOnly && p.status !== "recebido" && (
                        <button className="btn-ghost btn-sm text-destructive" onClick={() => setToDelete(p)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Novo pedido */}
      <Modal
        open={novoOpen}
        title="Novo pedido de compra"
        width="max-w-2xl"
        onClose={() => setNovoOpen(false)}
        footer={
          <>
            <button className="btn-outline" onClick={() => setNovoOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={criar}>Criar pedido</button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Fornecedor">
              <Select
                value={fornecedorId}
                onChange={setFornecedorId}
                placeholder="— selecione —"
                options={[
                  { value: "", label: "— selecione —" },
                  ...fornecedores.map((f) => ({ value: f.id, label: f.nome })),
                ]}
              />
            </Field>
            <Field label="Data">
              <DatePicker value={data} onChange={setData} />
            </Field>
          </div>
          <ItensEditor itens={itens} onChange={setItens} produtos={produtos} precoFonte="custo" />
          <Field label="Observação">
            <input className="input" value={obs} onChange={(e) => setObs(e.target.value)} />
          </Field>
        </div>
      </Modal>

      {/* Receber */}
      <Modal
        open={!!receber}
        title="Receber pedido"
        onClose={() => setReceber(null)}
        footer={
          <>
            <button className="btn-outline" onClick={() => setReceber(null)}>Cancelar</button>
            <button className="btn-primary" onClick={confirmarReceber}>Confirmar recebimento</button>
          </>
        }
      >
        {receber && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Total {formatBRL(receber.valorTotal)} → gera conta a pagar para {receber.fornecedorNome || "fornecedor"} e entrada no estoque dos itens com produto.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Vencimento" required>
                <DatePicker value={vencimento} onChange={setVencimento} />
              </Field>
              <Field label="Categoria">
                <Select
                  value={categoriaId}
                  onChange={setCategoriaId}
                  options={[
                    { value: "", label: "— sem categoria —" },
                    ...categorias.map((c) => ({ value: c.id, label: c.nome })),
                  ]}
                />
              </Field>
              <Field label="Centro de custo" className="sm:col-span-2">
                <Select
                  value={centroId}
                  onChange={setCentroId}
                  options={[
                    { value: "", label: "— sem centro —" },
                    ...centros.map((c) => ({ value: c.id, label: c.nome })),
                  ]}
                />
              </Field>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!toCancel} title="Cancelar pedido" message="Confirmar cancelamento do pedido?" confirmLabel="Cancelar pedido" onConfirm={confirmarCancelar} onCancel={() => setToCancel(null)} />
      <ConfirmDialog open={!!toDelete} title="Excluir pedido" message="Excluir o pedido e seus itens?" confirmLabel="Excluir" destructive onConfirm={confirmarExcluir} onCancel={() => setToDelete(null)} />
    </>
  );
}

export function ComprasPage() {
  return <RequireEmpresa>{(id) => <Inner empresaId={id} />}</RequireEmpresa>;
}
