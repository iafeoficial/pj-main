import { useState } from "react";
import { ShoppingBag, Plus, FileText, Ban, Trash2, UserPlus } from "lucide-react";
import type { Categoria, CentroCusto, Cliente, ItemEditavel, PedidoVenda, Produto, Vendedor } from "@/types/domain";
import { vendaService } from "@/data/operacao";
import { clienteService, vendedorService } from "@/data/cadastros";
import { produtoService } from "@/data/estoque";
import { categoriaService, centroCustoService } from "@/data/services";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatBRL, formatDate, today } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RequireEmpresa } from "@/components/RequireEmpresa";
import { usePermissions } from "@/hooks/usePermissions";
import { WriteGate } from "@/components/RequireCapability";
import { useToast } from "@/components/ui/Toast";
import { ItensEditor } from "@/features/pedidos/ItensEditor";

const STATUS_STYLE: Record<string, string> = {
  orcamento: "bg-muted text-muted-foreground",
  pedido: "bg-blue-100 text-blue-700",
  faturado: "bg-emerald-100 text-emerald-700",
  cancelado: "bg-zinc-200 text-zinc-600 line-through",
};
const STATUS_LABEL: Record<string, string> = { orcamento: "Orçamento", pedido: "Pedido", faturado: "Faturado", cancelado: "Cancelado" };

function Inner({ empresaId }: { empresaId: string }) {
  const { version, bumpData } = useEmpresa();
  const { canWrite } = usePermissions();
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

  const [novoClienteOpen, setNovoClienteOpen] = useState(false);
  const [clienteRapidoNome, setClienteRapidoNome] = useState("");
  const [clienteRapidoCnpj, setClienteRapidoCnpj] = useState("");
  const [clienteRapidoEmail, setClienteRapidoEmail] = useState("");
  const [clienteRapidoTel, setClienteRapidoTel] = useState("");
  const [salvandoCliente, setSalvandoCliente] = useState(false);

  const [novoVendedorOpen, setNovoVendedorOpen] = useState(false);
  const [vendedorRapidoNome, setVendedorRapidoNome] = useState("");
  const [vendedorRapidoEmail, setVendedorRapidoEmail] = useState("");
  const [vendedorRapidoComissao, setVendedorRapidoComissao] = useState("0");
  const [salvandoVendedor, setSalvandoVendedor] = useState(false);

  function resetClienteRapido() {
    setClienteRapidoNome("");
    setClienteRapidoCnpj("");
    setClienteRapidoEmail("");
    setClienteRapidoTel("");
  }

  function resetVendedorRapido() {
    setVendedorRapidoNome("");
    setVendedorRapidoEmail("");
    setVendedorRapidoComissao("0");
  }

  function abrirNovo() {
    setClienteId("");
    setVendedorId("");
    setStatus("orcamento");
    setData(today());
    setObs("");
    setItens([]);
    resetClienteRapido();
    resetVendedorRapido();
    setNovoClienteOpen(clientes.length === 0);
    setNovoVendedorOpen(false);
    setNovoOpen(true);
  }

  async function cadastrarClienteRapido() {
    const nome = clienteRapidoNome.trim();
    if (!nome) {
      notify("Informe o nome do cliente.", "error");
      return;
    }
    setSalvandoCliente(true);
    try {
      const c = await clienteService.create(empresaId, {
        nome,
        cnpjCpf: clienteRapidoCnpj.trim(),
        email: clienteRapidoEmail.trim(),
        telefone: clienteRapidoTel.trim(),
        ativo: true,
      });
      bumpData();
      setClienteId(c.id);
      setNovoClienteOpen(false);
      resetClienteRapido();
      notify("Cliente cadastrado.");
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setSalvandoCliente(false);
    }
  }

  async function cadastrarVendedorRapido() {
    const nome = vendedorRapidoNome.trim();
    if (!nome) {
      notify("Informe o nome do vendedor.", "error");
      return;
    }
    const comissaoPercent = Number(vendedorRapidoComissao);
    if (Number.isNaN(comissaoPercent) || comissaoPercent < 0) {
      notify("Informe uma comissão válida (0 ou mais).", "error");
      return;
    }
    setSalvandoVendedor(true);
    try {
      const v = await vendedorService.create(empresaId, {
        nome,
        email: vendedorRapidoEmail.trim(),
        comissaoPercent,
        ativo: true,
      });
      bumpData();
      setVendedorId(v.id);
      setNovoVendedorOpen(false);
      resetVendedorRapido();
      notify("Vendedor cadastrado.");
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setSalvandoVendedor(false);
    }
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
        actions={
          <WriteGate>
            <button className="btn-primary" onClick={abrirNovo}><Plus className="h-4 w-4" /> Nova venda</button>
          </WriteGate>
        }
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
                    {canWrite && (
                      <div className="flex justify-end gap-1">
                        {(p.status === "orcamento" || p.status === "pedido") && (
                          <button className="btn-outline btn-sm" onClick={() => abrirFaturar(p)}>
                            <FileText className="h-3.5 w-3.5" /> Faturar
                          </button>
                        )}
                        {p.status !== "cancelado" && p.status !== "faturado" && (
                          <button className="btn-ghost btn-sm text-warning" title="Cancelar" onClick={() => setToCancel(p)}>
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                        {p.status !== "faturado" && (
                          <button className="btn-ghost btn-sm text-destructive" onClick={() => setToDelete(p)}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
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
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="label">Cliente</span>
                {!novoClienteOpen && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    onClick={() => setNovoClienteOpen(true)}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Cadastrar
                  </button>
                )}
              </div>
              {novoClienteOpen ? (
                <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    {clientes.length === 0
                      ? "Primeiro acesso? Cadastre o cliente para continuar a venda."
                      : "Cadastro rápido — você pode completar os dados depois em Clientes."}
                  </p>
                  <Field label="Nome" required>
                    <input
                      className="input"
                      value={clienteRapidoNome}
                      onChange={(e) => setClienteRapidoNome(e.target.value)}
                      placeholder="Nome ou razão social"
                      autoFocus
                    />
                  </Field>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="CNPJ/CPF">
                      <input className="input" value={clienteRapidoCnpj} onChange={(e) => setClienteRapidoCnpj(e.target.value)} />
                    </Field>
                    <Field label="Telefone">
                      <input className="input" value={clienteRapidoTel} onChange={(e) => setClienteRapidoTel(e.target.value)} />
                    </Field>
                  </div>
                  <Field label="E-mail">
                    <input className="input" type="email" value={clienteRapidoEmail} onChange={(e) => setClienteRapidoEmail(e.target.value)} />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      disabled={salvandoCliente}
                      onClick={cadastrarClienteRapido}
                    >
                      {salvandoCliente ? "Salvando…" : "Salvar cliente"}
                    </button>
                    <button
                      type="button"
                      className="btn-outline btn-sm"
                      disabled={salvandoCliente}
                      onClick={() => {
                        setNovoClienteOpen(false);
                        resetClienteRapido();
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <select className="input" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                    <option value="">— selecione —</option>
                    {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                  {clientes.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhum cliente cadastrado.</p>
                  )}
                </>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="label">Vendedor</span>
                {!novoVendedorOpen && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    onClick={() => setNovoVendedorOpen(true)}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Cadastrar
                  </button>
                )}
              </div>
              {novoVendedorOpen ? (
                <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    Cadastro rápido — opcional. Complete os dados depois em Vendedores.
                  </p>
                  <Field label="Nome" required>
                    <input
                      className="input"
                      value={vendedorRapidoNome}
                      onChange={(e) => setVendedorRapidoNome(e.target.value)}
                      placeholder="Nome do vendedor"
                      autoFocus
                    />
                  </Field>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="E-mail">
                      <input className="input" type="email" value={vendedorRapidoEmail} onChange={(e) => setVendedorRapidoEmail(e.target.value)} />
                    </Field>
                    <Field label="Comissão (%)">
                      <input
                        className="input"
                        type="number"
                        min={0}
                        step={0.1}
                        value={vendedorRapidoComissao}
                        onChange={(e) => setVendedorRapidoComissao(e.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      disabled={salvandoVendedor}
                      onClick={cadastrarVendedorRapido}
                    >
                      {salvandoVendedor ? "Salvando…" : "Salvar vendedor"}
                    </button>
                    <button
                      type="button"
                      className="btn-outline btn-sm"
                      disabled={salvandoVendedor}
                      onClick={() => {
                        setNovoVendedorOpen(false);
                        resetVendedorRapido();
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <select className="input" value={vendedorId} onChange={(e) => setVendedorId(e.target.value)}>
                    <option value="">— sem vendedor —</option>
                    {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome} ({v.comissaoPercent}%)</option>)}
                  </select>
                  {vendedores.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhum vendedor cadastrado (opcional).</p>
                  )}
                </>
              )}
            </div>

            <Field label="Tipo">
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value as "orcamento" | "pedido")}>
                <option value="orcamento">Orçamento</option>
                <option value="pedido">Pedido</option>
              </select>
            </Field>
            <Field label="Data">
              <input className="input" type="date" value={data} onChange={(e) => setData(e.target.value)} />
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
                <input className="input" type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
              </Field>
              <Field label="Categoria">
                <select className="input" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
                  <option value="">— sem categoria —</option>
                  {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </Field>
              <Field label="Centro de custo" className="sm:col-span-2">
                <select className="input" value={centroId} onChange={(e) => setCentroId(e.target.value)}>
                  <option value="">— sem centro —</option>
                  {centros.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
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
