import { useState } from "react";
import { ShoppingBag, Plus, FileText, Ban, Trash2 } from "lucide-react";
import type { Categoria, CentroCusto, Cliente, ItemEditavel, PedidoVenda, Produto, Vendedor } from "@/types/domain";
import { vendaService } from "@/data/operacao";
import { clienteService, vendedorService } from "@/data/cadastros";
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
  orcamento: "bg-muted text-muted-foreground",
  pedido: "bg-blue-100 text-blue-700",
  faturado: "bg-emerald-100 text-emerald-700",
  cancelado: "bg-zinc-200 text-zinc-600 line-through",
};
const STATUS_LABEL: Record<string, string> = { orcamento: "Orçamento", pedido: "Pedido", faturado: "Faturado", cancelado: "Cancelado" };

function Inner({ empresaId }: { empresaId: string }) {
  const { version, bumpData, papel } = useEmpresa();
  const readOnly = !canWrite(papel);
  const { notify } = useToast();

  const { data: pedidos } = useAsyncData(() => vendaService.list(empresaId), [empresaId, version], [] as PedidoVenda[]);
  const { data: clientes } = useAsyncData(() => clienteService.listAtivos(empresaId), [empresaId, version], [] as Cliente[]);
  const { data: vendedores } = useAsyncData(() => vendedorService.listAtivos(empresaId), [empresaId, version], [] as Vendedor[]);
  const { data: produtos } = useAsyncData(() => produtoService.listAtivos(empresaId), [empresaId, version], [] as Produto[]);
  const { data: categorias } = useAsyncData(() => categoriaService.listAtivas(empresaId, "receita"), [empresaId, version], [] as Categoria[]);
  const { data: centros } = useAsyncData(() => centroCustoService.listAtivos(empresaId), [empresaId, version], [] as CentroCusto[]);

  const [novoOpen, setNovoOpen] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [status, setStatus] = useState<"orcamento" | "pedido">("orcamento");
  const [data, setData] = useState(today());
  const [obs, setObs] = useState("");
  const [itens, setItens] = useState<ItemEditavel[]>([]);

  const [faturar, setFaturar] = useState<PedidoVenda | null>(null);
  const [vencimento, setVencimento] = useState(today());
  const [categoriaId, setCategoriaId] = useState("");
  const [centroId, setCentroId] = useState("");

  const [toCancel, setToCancel] = useState<PedidoVenda | null>(null);
  const [toDelete, setToDelete] = useState<PedidoVenda | null>(null);

  function abrirNovo() {
    setClienteId("");
    setVendedorId("");
    setStatus("orcamento");
    setData(today());
    setObs("");
    setItens([]);
    setNovoOpen(true);
  }

  async function criar() {
    try {
      const c = clientes.find((x) => x.id === clienteId);
      await vendaService.create(empresaId, {
        clienteId: clienteId || null,
        clienteNome: c?.nome ?? "",
        vendedorId: vendedorId || null,
        status,
        data,
        observacao: obs,
        itens,
      });
      bumpData();
      notify("Venda criada.");
      setNovoOpen(false);
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  function abrirFaturar(p: PedidoVenda) {
    setFaturar(p);
    setVencimento(today());
    setCategoriaId("");
    setCentroId("");
  }
  async function confirmarFaturar() {
    if (!faturar) return;
    try {
      await vendaService.faturar(empresaId, faturar.id, {
        dataVencimento: vencimento,
        categoriaId: categoriaId || null,
        centroCustoId: centroId || null,
      });
      bumpData();
      notify("Venda faturada: conta a receber e estoque atualizados.");
      setFaturar(null);
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  async function confirmarCancelar() {
    if (!toCancel) return;
    try {
      await vendaService.cancelar(empresaId, toCancel.id);
      bumpData();
      notify("Venda cancelada.");
    } catch (e) {
      notify((e as Error).message, "error");
    }
    setToCancel(null);
  }
  async function confirmarExcluir() {
    if (!toDelete) return;
    try {
      await vendaService.remove(empresaId, toDelete.id);
      bumpData();
      notify("Venda excluída.");
    } catch (e) {
      notify((e as Error).message, "error");
    }
    setToDelete(null);
  }

  return (
    <>
      <PageHeader
        title="Vendas"
        subtitle="Orçamentos e pedidos. Ao faturar, geram conta a receber, saída de estoque e comissão."
        actions={!readOnly ? <button className="btn-primary" onClick={abrirNovo}><Plus className="h-4 w-4" /> Nova venda</button> : undefined}
      />

      {pedidos.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Nenhuma venda"
          description="Crie um orçamento/pedido e fature para gerar a conta a receber."
          action={<button className="btn-primary" onClick={abrirNovo}><Plus className="h-4 w-4" /> Nova venda</button>}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Data</th>
                <th className="px-4 py-2.5 font-medium">Cliente</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
                <th className="px-4 py-2.5 text-right font-medium">Comissão</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Financeiro</th>
                <th className="px-4 py-2.5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pedidos.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="whitespace-nowrap px-4 py-3">{formatDate(p.data)}</td>
                  <td className="px-4 py-3">{p.clienteNome || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatBRL(p.valorTotal)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {p.comissaoValor > 0 ? formatBRL(p.comissaoValor) : "—"}
                  </td>
                  <td className="px-4 py-3"><span className={`badge ${STATUS_STYLE[p.status]}`}>{STATUS_LABEL[p.status]}</span></td>
                  <td className="px-4 py-3">
                    {p.contaReceberId ? (
                      <EntityLink type="conta-receber" id={p.contaReceberId} label="Conta a receber" />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {!readOnly && (p.status === "orcamento" || p.status === "pedido") && (
                        <button className="btn-outline btn-sm" onClick={() => abrirFaturar(p)}>
                          <FileText className="h-3.5 w-3.5" /> Faturar
                        </button>
                      )}
                      {!readOnly && p.status !== "cancelado" && p.status !== "faturado" && (
                        <button className="btn-ghost btn-sm text-warning" title="Cancelar" onClick={() => setToCancel(p)}>
                          <Ban className="h-4 w-4" />
                        </button>
                      )}
                      {!readOnly && p.status !== "faturado" && (
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

      {/* Nova venda */}
      <Modal
        open={novoOpen}
        title="Nova venda"
        width="max-w-2xl"
        onClose={() => setNovoOpen(false)}
        footer={
          <>
            <button className="btn-outline" onClick={() => setNovoOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={criar}>Criar</button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Cliente">
              <Select
                value={clienteId}
                onChange={setClienteId}
                options={[
                  { value: "", label: "— selecione —" },
                  ...clientes.map((c) => ({ value: c.id, label: c.nome })),
                ]}
              />
            </Field>
            <Field label="Vendedor">
              <Select
                value={vendedorId}
                onChange={setVendedorId}
                options={[
                  { value: "", label: "— sem vendedor —" },
                  ...vendedores.map((v) => ({
                    value: v.id,
                    label: `${v.nome} (${v.comissaoPercent}%)`,
                  })),
                ]}
              />
            </Field>
            <Field label="Tipo">
              <Select
                value={status}
                onChange={(v) => setStatus(v as "orcamento" | "pedido")}
                options={[
                  { value: "orcamento", label: "Orçamento" },
                  { value: "pedido", label: "Pedido" },
                ]}
              />
            </Field>
            <Field label="Data">
              <DatePicker value={data} onChange={setData} />
            </Field>
          </div>
          <ItensEditor itens={itens} onChange={setItens} produtos={produtos} precoFonte="venda" />
          <Field label="Observação">
            <input className="input" value={obs} onChange={(e) => setObs(e.target.value)} />
          </Field>
        </div>
      </Modal>

      {/* Faturar */}
      <Modal
        open={!!faturar}
        title="Faturar venda"
        onClose={() => setFaturar(null)}
        footer={
          <>
            <button className="btn-outline" onClick={() => setFaturar(null)}>Cancelar</button>
            <button className="btn-primary" onClick={confirmarFaturar}>Confirmar faturamento</button>
          </>
        }
      >
        {faturar && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Total {formatBRL(faturar.valorTotal)} → gera conta a receber de {faturar.clienteNome || "cliente"} e baixa de estoque.
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

      <ConfirmDialog open={!!toCancel} title="Cancelar venda" message="Confirmar cancelamento?" confirmLabel="Cancelar venda" onConfirm={confirmarCancelar} onCancel={() => setToCancel(null)} />
      <ConfirmDialog open={!!toDelete} title="Excluir venda" message="Excluir a venda e seus itens?" confirmLabel="Excluir" destructive onConfirm={confirmarExcluir} onCancel={() => setToDelete(null)} />
    </>
  );
}

export function VendasPage() {
  return <RequireEmpresa>{(id) => <Inner empresaId={id} />}</RequireEmpresa>;
}
