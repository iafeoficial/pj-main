import { useState } from "react";
import { CreditCard, Landmark, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import type { ContaFinanceira, ContaFinanceiraTipo } from "@/types/domain";
import { contaFinanceiraService } from "@/data/services";
import { labelContaFinanceira } from "@/lib/contaFinanceira";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatBRL } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { DatePicker } from "@/components/ui/DatePicker";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RequireEmpresa } from "@/components/RequireEmpresa";
import { useToast } from "@/components/ui/Toast";

const TIPO_LABEL: Record<ContaFinanceiraTipo, string> = {
  conta_corrente: "Conta corrente",
  cartao_credito: "Cartão de crédito",
};

interface FormState {
  tipo: ContaFinanceiraTipo;
  nome: string;
  instituicao: string;
  titular: string;
  ativo: boolean;
  observacao: string;
  agencia: string;
  numeroConta: string;
  bandeira: string;
  diaVencimentoFatura: string;
  saldoInicial: string;
  dataSaldoInicial: string;
}

const EMPTY_FORM = (tipo: ContaFinanceiraTipo = "conta_corrente"): FormState => ({
  tipo,
  nome: "",
  instituicao: "",
  titular: "",
  ativo: true,
  observacao: "",
  agencia: "",
  numeroConta: "",
  bandeira: "",
  diaVencimentoFatura: "",
  saldoInicial: "",
  dataSaldoInicial: "",
});

/** Detalhe resumido na tabela (agência+conta ou bandeira+fatura+titular). */
function detalhe(c: ContaFinanceira): string {
  if (c.tipo === "cartao_credito") {
    const partes = [
      c.bandeira,
      c.diaVencimentoFatura ? `fatura dia ${c.diaVencimentoFatura}` : "",
    ];
    return partes.filter(Boolean).join(" · ") || "—";
  }
  const partes = [c.agencia ? `Ag. ${c.agencia}` : "", c.numeroConta ? `C/C ${c.numeroConta}` : ""];
  return partes.filter(Boolean).join(" · ") || "—";
}

function Inner({ empresaId }: { empresaId: string }) {
  const { version, bumpData } = useEmpresa();
  const { notify } = useToast();
  const { data: contas } = useAsyncData(
    () => contaFinanceiraService.list(empresaId),
    [empresaId, version],
    [] as ContaFinanceira[]
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ContaFinanceira | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toDelete, setToDelete] = useState<ContaFinanceira | null>(null);

  const isCartao = form.tipo === "cartao_credito";
  const contasCorrentes = contas.filter((c) => c.tipo === "conta_corrente");
  const cartoes = contas.filter((c) => c.tipo === "cartao_credito");

  function openCreate(tipo: ContaFinanceiraTipo = "conta_corrente") {
    setEditing(null);
    setForm(EMPTY_FORM(tipo));
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(c: ContaFinanceira) {
    setEditing(c);
    setForm({
      tipo: c.tipo,
      nome: c.nome,
      instituicao: c.instituicao,
      titular: c.titular ?? "",
      ativo: c.ativo,
      observacao: c.observacao,
      agencia: c.agencia,
      numeroConta: c.numeroConta,
      bandeira: c.bandeira,
      diaVencimentoFatura: c.diaVencimentoFatura ? String(c.diaVencimentoFatura) : "",
      saldoInicial: c.saldoInicial ? String(c.saldoInicial) : "",
      dataSaldoInicial: c.dataSaldoInicial ?? "",
    });
    setErrors({});
    setModalOpen(true);
  }

  function validate(): boolean {
    const err: Record<string, string> = {};
    if (!form.nome.trim()) err.nome = "Informe o nome.";
    if (isCartao && !form.titular.trim()) {
      err.titular = "Informe o titular / responsável do cartão.";
    }
    if (isCartao && !form.bandeira.trim()) {
      err.bandeira = "Informe a bandeira.";
    }
    if (isCartao && !form.diaVencimentoFatura) {
      err.diaVencimentoFatura = "Informe o dia de vencimento da fatura.";
    } else if (isCartao && form.diaVencimentoFatura) {
      const dia = Number(form.diaVencimentoFatura);
      if (!Number.isInteger(dia) || dia < 1 || dia > 28) {
        err.diaVencimentoFatura = "Informe um dia entre 1 e 28.";
      }
    }
    setErrors(err);
    return Object.keys(err).length === 0;
  }

  async function save() {
    if (!validate()) return;
    const cartao = form.tipo === "cartao_credito";
    const payload = {
      tipo: form.tipo,
      nome: form.nome.trim(),
      instituicao: form.instituicao.trim(),
      titular: form.titular.trim(),
      ativo: form.ativo,
      observacao: form.observacao.trim(),
      agencia: cartao ? "" : form.agencia.trim(),
      numeroConta: cartao ? "" : form.numeroConta.trim(),
      bandeira: cartao ? form.bandeira.trim() : "",
      diaVencimentoFatura:
        cartao && form.diaVencimentoFatura ? Number(form.diaVencimentoFatura) : null,
      saldoInicial: Number(form.saldoInicial) || 0,
      dataSaldoInicial: form.dataSaldoInicial || null,
    };
    try {
      if (editing) {
        await contaFinanceiraService.update(empresaId, editing.id, payload);
        notify(cartao ? "Cartão atualizado." : "Conta atualizada.");
      } else {
        await contaFinanceiraService.create(empresaId, payload);
        notify(cartao ? "Cartão cadastrado." : "Conta cadastrada.");
      }
      bumpData();
      setModalOpen(false);
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await contaFinanceiraService.remove(empresaId, toDelete.id);
      bumpData();
      notify("Conta/cartão excluído.");
    } catch (e) {
      notify((e as Error).message, "error");
    }
    setToDelete(null);
  }

  function renderTabela(items: ContaFinanceira[], emptyLabel: string) {
    if (items.length === 0) {
      return (
        <p className="px-4 py-6 text-sm text-muted-foreground">{emptyLabel}</p>
      );
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Nome</th>
              <th className="px-4 py-2.5 font-medium">Instituição</th>
              <th className="px-4 py-2.5 font-medium">Titular / responsável</th>
              <th className="px-4 py-2.5 font-medium">Detalhes</th>
              <th className="px-4 py-2.5 text-right font-medium">Saldo inicial</th>
              <th className="px-4 py-2.5 font-medium">Situação</th>
              <th className="px-4 py-2.5 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((c) => (
              <tr key={c.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 font-medium">
                    {c.tipo === "cartao_credito" ? (
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Landmark className="h-4 w-4 text-muted-foreground" />
                    )}
                    {c.nome}
                  </div>
                  {c.observacao && (
                    <div className="text-xs text-muted-foreground">{c.observacao}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{c.instituicao || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.titular?.trim() || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{detalhe(c)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatBRL(c.saldoInicial ?? 0)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {c.ativo ? "Ativa" : "Inativa"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button className="btn-ghost btn-sm" onClick={() => openEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      className="btn-ghost btn-sm text-destructive"
                      onClick={() => setToDelete(c)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Contas e Cartões"
        subtitle="Cadastre contas correntes e cartões de crédito (com titular) para vincular aos lançamentos."
        actions={
          <div className="flex flex-wrap gap-2">
            <button className="btn-outline" onClick={() => openCreate("conta_corrente")}>
              <Landmark className="h-4 w-4" /> Nova conta
            </button>
            <button className="btn-primary" onClick={() => openCreate("cartao_credito")}>
              <CreditCard className="h-4 w-4" /> Novo cartão
            </button>
          </div>
        }
      />

      {contas.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nenhuma conta ou cartão"
          description="Cadastre contas bancárias e cartões com titular/responsável para usar em Contas a Pagar."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <button className="btn-outline" onClick={() => openCreate("conta_corrente")}>
                <Landmark className="h-4 w-4" /> Nova conta
              </button>
              <button className="btn-primary" onClick={() => openCreate("cartao_credito")}>
                <CreditCard className="h-4 w-4" /> Novo cartão
              </button>
            </div>
          }
        />
      ) : (
        <div className="space-y-6">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2 font-medium">
                <Landmark className="h-4 w-4 text-muted-foreground" />
                Contas correntes
                <span className="text-xs font-normal text-muted-foreground">
                  ({contasCorrentes.length})
                </span>
              </div>
              <button className="btn-ghost btn-sm" onClick={() => openCreate("conta_corrente")}>
                <Plus className="h-4 w-4" /> Conta
              </button>
            </div>
            {renderTabela(contasCorrentes, "Nenhuma conta corrente cadastrada.")}
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2 font-medium">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                Cartões de crédito
                <span className="text-xs font-normal text-muted-foreground">
                  ({cartoes.length})
                </span>
              </div>
              <button className="btn-ghost btn-sm" onClick={() => openCreate("cartao_credito")}>
                <Plus className="h-4 w-4" /> Cartão
              </button>
            </div>
            {renderTabela(
              cartoes,
              "Nenhum cartão cadastrado. Use “Novo cartão” para registrar bandeira, fatura e titular."
            )}
          </section>
        </div>
      )}

      <Modal
        open={modalOpen}
        title={
          editing
            ? isCartao
              ? "Editar cartão"
              : "Editar conta"
            : isCartao
              ? "Novo cartão de crédito"
              : "Nova conta corrente"
        }
        onClose={() => setModalOpen(false)}
        width="max-w-xl"
        footer={
          <>
            <button className="btn-outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={save}>
              Salvar
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Tipo" required>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(TIPO_LABEL) as ContaFinanceiraTipo[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, tipo: t })}
                  className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                    form.tipo === t
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  {t === "cartao_credito" ? (
                    <CreditCard className="h-4 w-4" />
                  ) : (
                    <Landmark className="h-4 w-4" />
                  )}
                  {TIPO_LABEL[t]}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome" required error={errors.nome} className="sm:col-span-2">
              <input
                className="input"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder={isCartao ? "Ex.: Cartão Corporativo Visa" : "Ex.: Conta Movimento"}
                autoFocus
              />
            </Field>
            <Field label={isCartao ? "Emissor / banco" : "Banco"} className="sm:col-span-2">
              <input
                className="input"
                value={form.instituicao}
                onChange={(e) => setForm({ ...form, instituicao: e.target.value })}
                placeholder="Ex.: Banco do Brasil"
              />
            </Field>

            {isCartao ? (
              <div className="sm:col-span-2 space-y-4 rounded-md border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Dados do cartão
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="Titular / responsável"
                    required
                    error={errors.titular}
                    hint="Quem responde pelo cartão (pessoa física ou departamento)."
                    className="sm:col-span-2"
                  >
                    <input
                      className="input"
                      value={form.titular}
                      onChange={(e) => setForm({ ...form, titular: e.target.value })}
                      placeholder="Ex.: Maria Silva"
                    />
                  </Field>
                  <Field label="Bandeira" required error={errors.bandeira}>
                    <input
                      className="input"
                      value={form.bandeira}
                      onChange={(e) => setForm({ ...form, bandeira: e.target.value })}
                      placeholder="Visa, Mastercard…"
                    />
                  </Field>
                  <Field
                    label="Dia de vencimento da fatura"
                    required
                    error={errors.diaVencimentoFatura}
                    hint="1 a 28. Usado para sugerir o vencimento das despesas no cartão."
                  >
                    <input
                      className="input"
                      type="number"
                      min="1"
                      max="28"
                      value={form.diaVencimentoFatura}
                      onChange={(e) => setForm({ ...form, diaVencimentoFatura: e.target.value })}
                    />
                  </Field>
                </div>
                {form.bandeira.trim() && (
                  <p className="text-xs text-muted-foreground">
                    No Contas a Pagar aparecerá como:{" "}
                    <span className="font-medium text-foreground">
                      {labelContaFinanceira({
                        tipo: "cartao_credito",
                        nome: form.nome.trim() || form.bandeira.trim(),
                        bandeira: form.bandeira.trim(),
                        titular: form.titular.trim() || "…",
                      })}
                    </span>
                  </p>
                )}
              </div>
            ) : (
              <>
                <Field
                  label="Titular / responsável"
                  hint="Opcional. Quem responde pela conta."
                  className="sm:col-span-2"
                >
                  <input
                    className="input"
                    value={form.titular}
                    onChange={(e) => setForm({ ...form, titular: e.target.value })}
                    placeholder="Ex.: Financeiro / João"
                  />
                </Field>
                <Field label="Agência">
                  <input
                    className="input"
                    value={form.agencia}
                    onChange={(e) => setForm({ ...form, agencia: e.target.value })}
                    placeholder="0000"
                  />
                </Field>
                <Field label="Conta">
                  <input
                    className="input"
                    value={form.numeroConta}
                    onChange={(e) => setForm({ ...form, numeroConta: e.target.value })}
                    placeholder="00000-0"
                  />
                </Field>
              </>
            )}

            <Field label="Saldo inicial (R$)">
              <input
                className="input"
                type="number"
                step="0.01"
                value={form.saldoInicial}
                onChange={(e) => setForm({ ...form, saldoInicial: e.target.value })}
              />
            </Field>
            <Field label="Data do saldo inicial">
              <DatePicker
                value={form.dataSaldoInicial}
                onChange={(dataSaldoInicial) => setForm({ ...form, dataSaldoInicial })}
              />
            </Field>

            <Field label="Observação" className="sm:col-span-2">
              <input
                className="input"
                value={form.observacao}
                onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
            />
            {isCartao ? "Cartão ativo" : "Conta ativa"}
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Excluir conta/cartão"
        message={`Excluir "${toDelete?.nome}"? Os lançamentos vinculados ficam sem conta.`}
        confirmLabel="Excluir"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

export function ContasCartoesPage() {
  return <RequireEmpresa>{(id) => <Inner empresaId={id} />}</RequireEmpresa>;
}
