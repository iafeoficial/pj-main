import { useMemo, useState } from "react";
import { ArrowLeftRight, Pencil, Plus, Trash2 } from "lucide-react";
import type { ContaFinanceira, ContaPagar, ContaReceber, TransferenciaConta } from "@/types/domain";
import { contaFinanceiraService, contaPagarService, contaReceberService } from "@/data/services";
import { transferenciaService } from "@/data/transferencias";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatBRL, formatDate, today } from "@/lib/utils";
import { labelContaFinanceira } from "@/lib/contaFinanceira";
import { canWrite } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RequireEmpresa } from "@/components/RequireEmpresa";
import { useToast } from "@/components/ui/Toast";

type LinhaMarcada = {
  lado: "pagar" | "receber";
  id: string;
  data: string;
  nome: string;
  origem: string;
  destino: string;
  valor: number;
  observacao: string;
  contaFinanceiraId: string | null;
};

type Editor =
  | { modo: "criar" }
  | { modo: "nova"; id: string }
  | { modo: "marcada"; linha: LinhaMarcada };

type Exclusao =
  | { tipo: "nova"; item: TransferenciaConta }
  | { tipo: "marcada"; linha: LinhaMarcada };

/** "Transf. C.Corrente | BB >> MasterCard" vira os dois lados do nome. */
function ladosDoNome(nome: string): { de: string; para: string } | null {
  const i = nome.indexOf(">>");
  if (i < 0) return null;
  const de = nome.slice(0, i).replace(/^transf\.?\s*/i, "").trim();
  const para = nome.slice(i + 2).trim();
  if (!de || !para) return null;
  return { de, para };
}

function Inner({ empresaId }: { empresaId: string }) {
  const { version, bumpData, papel } = useEmpresa();
  const readOnly = !canWrite(papel);
  const { notify } = useToast();
  const { data: itens } = useAsyncData(
    () => transferenciaService.list(empresaId),
    [empresaId, version],
    [] as TransferenciaConta[]
  );
  const { data: pagar } = useAsyncData(
    () => contaPagarService.list(empresaId),
    [empresaId, version],
    [] as ContaPagar[]
  );
  const { data: receber } = useAsyncData(
    () => contaReceberService.list(empresaId),
    [empresaId, version],
    [] as ContaReceber[]
  );
  const { data: contas } = useAsyncData(
    () => contaFinanceiraService.list(empresaId),
    [empresaId, version],
    [] as ContaFinanceira[]
  );

  const [editor, setEditor] = useState<Editor | null>(null);
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [contaId, setContaId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState(today());
  const [valor, setValor] = useState("");
  const [observacao, setObservacao] = useState("");
  const [error, setError] = useState("");
  const [toDelete, setToDelete] = useState<Exclusao | null>(null);

  const opcoes = contas
    .filter((c) => c.ativo !== false)
    .map((c) => ({ value: c.id, label: labelContaFinanceira(c) }));
  const nomeConta = (id: string | null) => {
    if (!id) return "";
    const c = contas.find((x) => x.id === id);
    return c ? labelContaFinanceira(c) : "";
  };

  const marcadas = useMemo<LinhaMarcada[]>(() => {
    const rotulo = (id: string | null) => {
      if (!id) return "";
      const c = contas.find((x) => x.id === id);
      return c ? labelContaFinanceira(c) : "";
    };
    const saidas = pagar
      .filter((c) => c.transferencia && c.status !== "cancelada")
      .map((c) => {
        const lados = ladosDoNome(c.fornecedor);
        const conta = rotulo(c.contaFinanceiraId);
        return {
          lado: "pagar" as const,
          id: c.id,
          data: c.dataPagamento || c.dataVencimento,
          nome: c.fornecedor,
          origem: conta || lados?.de || "—",
          destino: lados?.para || "—",
          valor: c.valor,
          observacao: c.observacao,
          contaFinanceiraId: c.contaFinanceiraId,
        };
      });
    const entradas = receber
      .filter((c) => c.transferencia && c.status !== "cancelada")
      .map((c) => {
        const lados = ladosDoNome(c.cliente);
        const conta = rotulo(c.contaFinanceiraId);
        return {
          lado: "receber" as const,
          id: c.id,
          data: c.dataRecebimento || c.dataVencimento,
          nome: c.cliente,
          origem: lados?.de || "—",
          destino: conta || lados?.para || "—",
          valor: c.valor,
          observacao: c.observacao,
          contaFinanceiraId: c.contaFinanceiraId,
        };
      });
    return [...saidas, ...entradas].sort((a, b) => b.data.localeCompare(a.data));
  }, [pagar, receber, contas]);

  function limparFormulario() {
    setOrigem("");
    setDestino("");
    setContaId("");
    setDescricao("");
    setData(today());
    setValor("");
    setObservacao("");
    setError("");
  }

  function abrir() {
    limparFormulario();
    setEditor({ modo: "criar" });
  }

  function editarNova(t: TransferenciaConta) {
    limparFormulario();
    setOrigem(t.contaOrigemId);
    setDestino(t.contaDestinoId);
    setData(t.data);
    setValor(t.valor.toFixed(2).replace(".", ","));
    setObservacao(t.observacao ?? "");
    setEditor({ modo: "nova", id: t.id });
  }

  function editarMarcada(linha: LinhaMarcada) {
    limparFormulario();
    setDescricao(linha.nome);
    setContaId(linha.contaFinanceiraId ?? "");
    setData(linha.data);
    setValor(linha.valor.toFixed(2).replace(".", ","));
    setObservacao(linha.observacao ?? "");
    setEditor({ modo: "marcada", linha });
  }

  function lerValor(): number | null {
    const raw = String(valor).trim();
    const normalizado = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
    const n = Number(normalizado);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Number(n.toFixed(2));
  }

  async function salvar() {
    if (!editor) return;
    if (!data) {
      setError("Informe a data.");
      return;
    }
    const n = lerValor();
    if (n == null) {
      setError("Informe um valor maior que zero.");
      return;
    }
    if (editor.modo === "marcada") {
      if (!descricao.trim()) {
        setError("Informe a descrição.");
        return;
      }
      try {
        await salvarMarcada(editor.linha, n);
        bumpData();
        setEditor(null);
        notify("Transferência atualizada.");
      } catch (e) {
        notify((e as Error).message, "error");
      }
      return;
    }
    if (!origem || !destino) {
      setError("Escolha a conta de origem e a de destino.");
      return;
    }
    if (origem === destino) {
      setError("A conta de origem e a de destino precisam ser diferentes.");
      return;
    }
    const payload = {
      contaOrigemId: origem,
      contaDestinoId: destino,
      data,
      valor: n,
      observacao,
    };
    try {
      if (editor.modo === "nova") {
        await transferenciaService.update(empresaId, editor.id, payload);
        notify("Transferência atualizada.");
      } else {
        await transferenciaService.create(empresaId, payload);
        notify("Transferência registrada. Ela não entra em contas a pagar nem a receber.");
      }
      bumpData();
      setEditor(null);
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  async function salvarMarcada(linha: LinhaMarcada, n: number) {
    if (linha.lado === "pagar") {
      const atual = pagar.find((c) => c.id === linha.id);
      if (!atual) throw new Error("Lançamento não encontrado.");
      const quitada = atual.valorPago >= atual.valor - 0.001 && atual.valorPago > 0;
      await contaPagarService.update(empresaId, linha.id, {
        fornecedor: descricao.trim(),
        valor: n,
        observacao,
        contaFinanceiraId: contaId || null,
        ...(atual.dataPagamento ? { dataPagamento: data } : { dataVencimento: data }),
        ...(quitada ? { valorPago: n } : {}),
      });
      return;
    }
    const atual = receber.find((c) => c.id === linha.id);
    if (!atual) throw new Error("Lançamento não encontrado.");
    const quitada = atual.valorRecebido >= atual.valor - 0.001 && atual.valorRecebido > 0;
    await contaReceberService.update(empresaId, linha.id, {
      cliente: descricao.trim(),
      valor: n,
      observacao,
      contaFinanceiraId: contaId || null,
      ...(atual.dataRecebimento ? { dataRecebimento: data } : { dataVencimento: data }),
      ...(quitada ? { valorRecebido: n } : {}),
    });
  }

  async function confirmarExclusao() {
    if (!toDelete) return;
    try {
      if (toDelete.tipo === "nova") {
        await transferenciaService.remove(empresaId, toDelete.item.id);
      } else if (toDelete.linha.lado === "pagar") {
        await contaPagarService.remove(empresaId, toDelete.linha.id);
      } else {
        await contaReceberService.remove(empresaId, toDelete.linha.id);
      }
      bumpData();
      notify("Transferência excluída.");
    } catch (e) {
      notify((e as Error).message, "error");
    }
    setToDelete(null);
  }

  async function desmarcar(linha: LinhaMarcada) {
    try {
      if (linha.lado === "pagar") {
        await contaPagarService.update(empresaId, linha.id, { transferencia: false });
      } else {
        await contaReceberService.update(empresaId, linha.id, { transferencia: false });
      }
      bumpData();
      notify("Lançamento voltou a contar nos totais.");
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  return (
    <>
      <PageHeader
        title="Transferência entre contas"
        subtitle="Movimentação entre contas da mesma empresa. O que você marca em pagar ou receber aparece aqui e sai dos totais."
        actions={
          !readOnly ? (
            <button className="btn-primary" onClick={abrir}>
              <Plus className="h-4 w-4" /> Nova transferência
            </button>
          ) : undefined
        }
      />

      {itens.length === 0 && marcadas.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="Nenhuma transferência"
          description="Registre uma saída de uma conta e a entrada em outra, ou marque um lançamento em contas a pagar ou a receber."
          action={
            !readOnly ? (
              <button className="btn-primary" onClick={abrir}>
                <Plus className="h-4 w-4" /> Nova transferência
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Data</th>
                <th className="px-4 py-2.5 font-medium">Descrição</th>
                <th className="px-4 py-2.5 font-medium">Origem</th>
                <th className="px-4 py-2.5 font-medium">Destino</th>
                <th className="px-4 py-2.5 text-right font-medium">Valor</th>
                <th className="px-4 py-2.5 font-medium">Observações</th>
                {!readOnly && <th className="px-4 py-2.5 text-right font-medium">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {marcadas.map((t) => (
                <tr key={`${t.lado}-${t.id}`} className="hover:bg-muted/30">
                  <td className="px-4 py-3">{formatDate(t.data)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{t.nome}</div>
                    <div className="text-xs text-amber-700 dark:text-amber-400">
                      {t.lado === "pagar" ? "Contas a pagar" : "Contas a receber"} — fora dos totais
                    </div>
                  </td>
                  <td className="px-4 py-3">{t.origem}</td>
                  <td className="px-4 py-3">{t.destino}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatBRL(t.valor)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.observacao?.trim() ? t.observacao : "—"}</td>
                  {!readOnly && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button className="btn-ghost btn-sm" title="Editar" onClick={() => editarMarcada(t)}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="btn-ghost btn-sm text-destructive"
                          title="Excluir"
                          onClick={() => setToDelete({ tipo: "marcada", linha: t })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          className="btn-ghost btn-sm text-amber-700"
                          title="Desmarcar transferência"
                          onClick={() => void desmarcar(t)}
                        >
                          <ArrowLeftRight className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {itens.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">{formatDate(t.data)}</td>
                  <td className="px-4 py-3 text-muted-foreground">—</td>
                  <td className="px-4 py-3">{nomeConta(t.contaOrigemId) || "—"}</td>
                  <td className="px-4 py-3">{nomeConta(t.contaDestinoId) || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatBRL(t.valor)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.observacao?.trim() ? t.observacao : "—"}</td>
                  {!readOnly && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button className="btn-ghost btn-sm" title="Editar" onClick={() => editarNova(t)}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="btn-ghost btn-sm text-destructive"
                          title="Excluir"
                          onClick={() => setToDelete({ tipo: "nova", item: t })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!editor}
        title={editor?.modo === "criar" ? "Nova transferência" : "Editar transferência"}
        onClose={() => setEditor(null)}
        footer={
          <>
            <button className="btn-outline" onClick={() => setEditor(null)}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={() => void salvar()}>
              Salvar
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {editor?.modo === "marcada" ? (
            <>
              <Field label="Descrição" required>
                <input className="input" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
              </Field>
              <Field
                label={editor.linha.lado === "pagar" ? "Conta de origem" : "Conta de destino"}
                required
              >
                <Select value={contaId} onChange={setContaId} options={opcoes} placeholder="Selecione" />
              </Field>
            </>
          ) : (
            <>
              <Field label="Conta de origem" required>
                <Select value={origem} onChange={setOrigem} options={opcoes} placeholder="Selecione" />
              </Field>
              <Field label="Conta de destino" required>
                <Select value={destino} onChange={setDestino} options={opcoes} placeholder="Selecione" />
              </Field>
            </>
          )}
          <Field label="Data" required>
            <DatePicker value={data} onChange={setData} />
          </Field>
          <Field label="Valor" required>
            <input
              className="input"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
            />
          </Field>
          <Field label="Observações">
            <textarea
              className="input min-h-[5rem]"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Excluir transferência"
        message={
          toDelete?.tipo === "marcada"
            ? `Excluir permanentemente? O lançamento sai desta lista e de ${
                toDelete.linha.lado === "pagar" ? "Contas a Pagar" : "Contas a Receber"
              }, e não pode ser recuperado.`
            : "Excluir permanentemente? A transferência será apagada e não pode ser recuperada."
        }
        confirmLabel="Excluir"
        destructive
        onConfirm={() => void confirmarExclusao()}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

export function TransferenciasPage() {
  return <RequireEmpresa>{(id) => <Inner empresaId={id} />}</RequireEmpresa>;
}
