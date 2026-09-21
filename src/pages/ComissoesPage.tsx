import { useState } from "react";
import { Download, Percent, Wallet } from "lucide-react";
import { getComissoes, gerarContasComissao, type ComissaoRow } from "@/data/operacao";
import { categoriaService } from "@/data/services";
import type { Categoria } from "@/types/domain";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatBRL, monthRange, today } from "@/lib/utils";
import { exportCSV } from "@/lib/csv";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { RequireEmpresa } from "@/components/RequireEmpresa";
import { useToast } from "@/components/ui/Toast";
import { EntityLink } from "@/components/EntityLink";
import { canWrite } from "@/lib/rbac";

function Inner({ empresaId }: { empresaId: string }) {
  const { version, empresaAtiva, bumpData, papel } = useEmpresa();
  const { notify } = useToast();
  const readOnly = !canWrite(papel);
  const initial = monthRange();
  const [inicio, setInicio] = useState(initial.start);
  const [fim, setFim] = useState(initial.end);

  const { data: rows } = useAsyncData(
    () => getComissoes(empresaId, inicio, fim),
    [empresaId, inicio, fim, version],
    [] as ComissaoRow[]
  );
  const { data: categorias } = useAsyncData(
    () => categoriaService.listAtivas(empresaId, "despesa"),
    [empresaId, version],
    [] as Categoria[]
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [categoriaId, setCategoriaId] = useState("");
  const [vencimento, setVencimento] = useState(today());
  const [gerando, setGerando] = useState(false);
  const [contasGeradas, setContasGeradas] = useState<string[]>([]);

  const totalComissao = rows.reduce((s, r) => s + r.comissao, 0);

  function exportar() {
    exportCSV(
      `comissoes_${empresaAtiva?.nomeFantasia ?? "empresa"}`,
      ["Vendedor", "Qtd vendas", "Total vendido", "Comissão"],
      rows.map((r) => [r.vendedor, r.qtdVendas, r.totalVendido.toFixed(2), r.comissao.toFixed(2)])
    );
  }

  async function confirmarGeracao() {
    setGerando(true);
    try {
      const res = await gerarContasComissao(empresaId, inicio, fim, {
        categoriaId: categoriaId || null,
        dataVencimento: vencimento,
      });
      bumpData();
      setContasGeradas(res.ids);
      if (res.geradas === 0) {
        notify("Nenhuma conta nova gerada (já existem ou sem comissões).", "error");
      } else {
        notify(`${res.geradas} conta(s) a pagar gerada(s).`);
      }
      setModalOpen(false);
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setGerando(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Comissões"
        subtitle="Comissões por vendedor sobre as vendas faturadas no período."
        actions={
          <>
            {!readOnly && (
              <button
                className="btn-primary"
                onClick={() => setModalOpen(true)}
                disabled={rows.length === 0}
              >
                <Wallet className="h-4 w-4" /> Gerar contas a pagar
              </button>
            )}
            <button className="btn-outline" onClick={exportar} disabled={rows.length === 0}>
              <Download className="h-4 w-4" /> CSV
            </button>
          </>
        }
      />

      <div className="card mb-6 flex flex-wrap items-end gap-4 p-4">
        <Field label="Início">
          <DatePicker value={inicio} onChange={setInicio} />
        </Field>
        <Field label="Fim">
          <DatePicker value={fim} onChange={setFim} />
        </Field>
        <div className="ml-auto text-sm">
          <p className="text-xs text-muted-foreground">Total de comissões</p>
          <p className="font-semibold">{formatBRL(totalComissao)}</p>
        </div>
      </div>

      {contasGeradas.length > 0 && (
        <div className="card mb-6 border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="mb-2 font-medium">Contas geradas nesta sessão:</p>
          <div className="flex flex-wrap gap-3">
            {contasGeradas.map((id) => (
              <EntityLink key={id} type="conta-pagar" id={id} label={`Conta ${id.slice(0, 8)}…`} />
            ))}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Percent}
          title="Sem comissões no período"
          description="Comissões aparecem quando há vendas faturadas com vendedor associado."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Vendedor</th>
                <th className="px-4 py-2.5 text-right font-medium">Vendas</th>
                <th className="px-4 py-2.5 text-right font-medium">Total vendido</th>
                <th className="px-4 py-2.5 text-right font-medium">Comissão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.vendedorId} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{r.vendedor}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.qtdVendas}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatBRL(r.totalVendido)}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-emerald-700">
                    {formatBRL(r.comissao)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        title="Gerar contas a pagar de comissão"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="btn-outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={confirmarGeracao} disabled={gerando}>
              Confirmar
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Serão criadas contas a pagar para {rows.filter((r) => r.comissao > 0).length} vendedor(es)
            no período {inicio} a {fim}. Contas já geradas para o mesmo período serão ignoradas.
          </p>
          <Field label="Categoria de despesa">
            <Select
              value={categoriaId}
              onChange={setCategoriaId}
              options={[
                { value: "", label: "— sem categoria —" },
                ...categorias.map((c) => ({ value: c.id, label: c.nome })),
              ]}
            />
          </Field>
          <Field label="Vencimento">
            <DatePicker value={vencimento} onChange={setVencimento} />
          </Field>
        </div>
      </Modal>
    </>
  );
}

export function ComissoesPage() {
  return <RequireEmpresa>{(id) => <Inner empresaId={id} />}</RequireEmpresa>;
}
