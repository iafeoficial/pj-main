import { useMemo, useState } from "react";
import { Boxes, Plus } from "lucide-react";
import type { EstoqueMovimento, EstoqueMovTipo, Produto } from "@/types/domain";
import { estoqueService, produtoService } from "@/data/estoque";
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
import { RequireEmpresa } from "@/components/RequireEmpresa";
import { useToast } from "@/components/ui/Toast";
import { EntityLink } from "@/components/EntityLink";
import { parsePedidoRef, resolveIdByPrefix } from "@/lib/entityLinks";
import { compraService, vendaService } from "@/data/operacao";

const TIPO_LABEL: Record<EstoqueMovTipo, string> = { entrada: "Entrada", saida: "Saída", ajuste: "Ajuste" };
const TIPO_STYLE: Record<EstoqueMovTipo, string> = {
  entrada: "bg-emerald-100 text-emerald-700",
  saida: "bg-red-100 text-red-700",
  ajuste: "bg-blue-100 text-blue-700",
};

function Inner({ empresaId }: { empresaId: string }) {
  const { version, bumpData, papel } = useEmpresa();
  const readOnly = !canWrite(papel);
  const { notify } = useToast();

  const { data: movimentos } = useAsyncData(
    () => estoqueService.listMovimentos(empresaId),
    [empresaId, version],
    [] as EstoqueMovimento[]
  );
  const { data: produtos } = useAsyncData(
    () => produtoService.listAtivos(empresaId),
    [empresaId, version],
    [] as Produto[]
  );
  const { data: compras } = useAsyncData(
    () => compraService.list(empresaId),
    [empresaId, version],
    []
  );
  const { data: vendas } = useAsyncData(
    () => vendaService.list(empresaId),
    [empresaId, version],
    []
  );
  const prodMap = useMemo(() => new Map(produtos.map((p) => [p.id, p.nome])), [produtos]);
  const compraIds = useMemo(() => compras.map((c) => c.id), [compras]);
  const vendaIds = useMemo(() => vendas.map((v) => v.id), [vendas]);

  const [open, setOpen] = useState(false);
  const [produtoId, setProdutoId] = useState("");
  const [tipo, setTipo] = useState<EstoqueMovTipo>("entrada");
  const [quantidade, setQuantidade] = useState(0);
  const [custo, setCusto] = useState(0);
  const [data, setData] = useState(today());
  const [obs, setObs] = useState("");

  function openModal() {
    setProdutoId(produtos[0]?.id ?? "");
    setTipo("entrada");
    setQuantidade(0);
    setCusto(0);
    setData(today());
    setObs("");
    setOpen(true);
  }

  async function salvar() {
    if (!produtoId) {
      notify("Selecione um produto.", "error");
      return;
    }
    if (!quantidade || quantidade === 0) {
      notify("Informe a quantidade.", "error");
      return;
    }
    try {
      await estoqueService.registrarMovimento(empresaId, {
        produtoId,
        tipo,
        quantidade,
        custoUnitario: custo,
        observacao: obs,
        data,
      });
      bumpData();
      notify("Movimentação registrada.");
      setOpen(false);
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  return (
    <>
      <PageHeader
        title="Estoque"
        subtitle="Movimentações de entrada, saída e ajuste. Compras e vendas geram movimentos automaticamente."
        actions={
          !readOnly ? (
            <button className="btn-primary" onClick={openModal} disabled={produtos.length === 0}>
              <Plus className="h-4 w-4" /> Nova movimentação
            </button>
          ) : undefined
        }
      />

      {movimentos.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="Sem movimentações"
          description={produtos.length === 0 ? "Cadastre produtos antes de movimentar o estoque." : "Registre uma entrada/saída ou aguarde compras/vendas."}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Data</th>
                <th className="px-4 py-2.5 font-medium">Produto</th>
                <th className="px-4 py-2.5 font-medium">Tipo</th>
                <th className="px-4 py-2.5 text-right font-medium">Qtd</th>
                <th className="px-4 py-2.5 text-right font-medium">Custo unit.</th>
                <th className="px-4 py-2.5 font-medium">Documento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {movimentos.map((m) => (
                <tr key={m.id} className="hover:bg-muted/30">
                  <td className="whitespace-nowrap px-4 py-2.5">{formatDate(m.data)}</td>
                  <td className="px-4 py-2.5">{prodMap.get(m.produtoId) ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`badge ${TIPO_STYLE[m.tipo]}`}>{TIPO_LABEL[m.tipo]}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{Number(m.quantidade)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatBRL(Number(m.custoUnitario))}</td>
                  <td className="px-4 py-2.5">
                    {(() => {
                      const ref = m.documento ? parsePedidoRef(m.documento) : null;
                      if (ref) {
                        const ids = ref.type === "compra" ? compraIds : vendaIds;
                        const fullId = resolveIdByPrefix(ids, ref.prefix);
                        if (fullId) {
                          return <EntityLink type={ref.type} id={fullId} label={m.documento} />;
                        }
                      }
                      return (
                        <span className="text-muted-foreground">{m.documento || m.observacao || "—"}</span>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open}
        title="Nova movimentação"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn-outline" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={salvar}>Salvar</button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Produto" required className="sm:col-span-2">
            <Select
              value={produtoId}
              onChange={setProdutoId}
              options={produtos.map((p) => ({ value: p.id, label: p.nome }))}
            />
          </Field>
          <Field label="Tipo">
            <Select
              value={tipo}
              onChange={(v) => setTipo(v as EstoqueMovTipo)}
              options={[
                { value: "entrada", label: "Entrada" },
                { value: "saida", label: "Saída" },
                { value: "ajuste", label: "Ajuste (delta +/-)" },
              ]}
            />
          </Field>
          <Field label="Quantidade" required>
            <input className="input" type="number" step="0.001" value={quantidade || ""} onChange={(e) => setQuantidade(Number(e.target.value))} />
          </Field>
          <Field label="Custo unitário (R$)">
            <input className="input" type="number" step="0.01" value={custo || ""} onChange={(e) => setCusto(Number(e.target.value))} />
          </Field>
          <Field label="Data">
            <DatePicker value={data} onChange={setData} />
          </Field>
          <Field label="Observação" className="sm:col-span-2">
            <input className="input" value={obs} onChange={(e) => setObs(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </>
  );
}

export function EstoquePage() {
  return <RequireEmpresa>{(id) => <Inner empresaId={id} />}</RequireEmpresa>;
}
