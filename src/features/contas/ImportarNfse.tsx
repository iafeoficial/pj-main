import { useRef, useState } from "react";
import { FileCode2, Loader2 } from "lucide-react";
import type { Categoria, CentroCusto, ContaFinanceira } from "@/types/domain";
import { documentoService } from "@/data/documentos";
import { parseNFSe, validarCnpjEmpresaNaNfse, type NFSeResultado } from "@/lib/nfse";
import { formatBRL, formatCNPJ, today } from "@/lib/utils";
import { labelContaFinanceira } from "@/lib/contaFinanceira";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";

export type NfseLadoTela = "pagar" | "receber";

interface RevisaoNfse {
  arquivoNome: string;
  nfse: NFSeResultado;
  pessoa: string;
  valor: number;
  dataCompetencia: string;
  dataVencimento: string;
  categoriaId: string;
  centroCustoId: string;
  contaFinanceiraId: string;
  observacao: string;
}

function montarObservacao(nfse: NFSeResultado): string {
  const parts = [
    `NFS-e ${nfse.numero || "—"}`,
    nfse.chave ? `chave ${nfse.chave}` : "",
    nfse.codigoTribNac ? `cTribNac ${nfse.codigoTribNac}` : "",
    nfse.descricaoTribNac || "",
    nfse.descricaoServico || "",
  ].filter(Boolean);
  return parts.join(" • ").slice(0, 500);
}

export function ImportarNfseButton({
  empresaId,
  cnpjEmpresa,
  lado,
  categorias,
  centros,
  contasFinanceiras,
  onDone,
}: {
  empresaId: string;
  cnpjEmpresa: string;
  lado: NfseLadoTela;
  categorias: Categoria[];
  centros: CentroCusto[];
  contasFinanceiras: ContaFinanceira[];
  onDone: () => void;
}) {
  const { notify } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [revisao, setRevisao] = useState<RevisaoNfse | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function onXml(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const nfse = parseNFSe(await file.text());
      validarCnpjEmpresaNaNfse(
        nfse,
        cnpjEmpresa,
        lado === "receber" ? "emitente" : "tomador"
      );
      if (await documentoService.jaExisteChave(empresaId, nfse.chave)) {
        throw new Error("NFS-e já importada (chave duplicada).");
      }

      const data = nfse.dataCompetencia ?? today();
      const pessoa =
        lado === "pagar"
          ? nfse.nomeEmitente || formatCNPJ(nfse.cnpjEmitente)
          : nfse.nomeTomador || formatCNPJ(nfse.cnpjTomador);

      setRevisao({
        arquivoNome: file.name,
        nfse,
        pessoa,
        valor: nfse.valorLiquido,
        dataCompetencia: data,
        dataVencimento: data,
        categoriaId: "",
        centroCustoId: "",
        contaFinanceiraId: "",
        observacao: montarObservacao(nfse),
      });
    } catch (err) {
      notify((err as Error).message || "Falha ao ler o XML.", "error");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function confirmar() {
    if (!revisao) return;
    setSalvando(true);
    try {
      await documentoService.criarDeNfse(empresaId, {
        lado,
        cnpjEmpresa,
        arquivoNome: revisao.arquivoNome,
        nfse: revisao.nfse,
        pessoa: revisao.pessoa,
        categoriaId: revisao.categoriaId || null,
        centroCustoId: revisao.centroCustoId || null,
        contaFinanceiraId: revisao.contaFinanceiraId || null,
        valor: revisao.valor,
        dataCompetencia: revisao.dataCompetencia,
        dataVencimento: revisao.dataVencimento,
        observacao: revisao.observacao,
        impostos: lado === "pagar" ? revisao.nfse.impostos : null,
      });
      onDone();
      notify(
        lado === "pagar"
          ? "NFS-e importada e conta a pagar criada."
          : "NFS-e importada e conta a receber criada."
      );
      setRevisao(null);
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      setSalvando(false);
    }
  }

  const nfse = revisao?.nfse;

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".xml,text/xml,application/xml"
        className="hidden"
        onChange={(e) => void onXml(e)}
      />
      <button type="button" className="btn-outline" onClick={() => fileRef.current?.click()}>
        <FileCode2 className="h-4 w-4" /> Importar XML
      </button>

      <Modal
        open={!!revisao}
        title="Revisar NFS-e"
        width="max-w-2xl"
        onClose={() => setRevisao(null)}
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setRevisao(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void confirmar()}
              disabled={salvando}
            >
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              {lado === "pagar" ? "Criar conta a pagar" : "Criar conta a receber"}
            </button>
          </>
        }
      >
        {revisao && nfse && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 rounded-md bg-accent/40 px-3 py-2 text-xs text-accent-foreground">
              Dados extraídos do XML. Confirme categoria e vencimento antes de gravar.
            </div>

            <div className="sm:col-span-2 grid grid-cols-1 gap-2 rounded-md border border-border bg-muted/30 p-3 text-sm sm:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground">CNPJ emitente</div>
                <div className="font-medium">
                  {formatCNPJ(nfse.cnpjEmitente) || "—"}
                  {nfse.nomeEmitente ? (
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      {nfse.nomeEmitente}
                    </span>
                  ) : null}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">CNPJ tomador</div>
                <div className="font-medium">
                  {formatCNPJ(nfse.cnpjTomador) || "—"}
                  {nfse.nomeTomador ? (
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      {nfse.nomeTomador}
                    </span>
                  ) : null}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Valores</div>
                <div className="font-medium tabular-nums">
                  Líquido {formatBRL(nfse.valorLiquido)}
                  {nfse.valorServico > 0 && nfse.valorServico !== nfse.valorLiquido ? (
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      Serviço {formatBRL(nfse.valorServico)}
                      {nfse.valorTotalRetido > 0
                        ? ` · Retido ${formatBRL(nfse.valorTotalRetido)}`
                        : ""}
                    </span>
                  ) : null}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Chave</div>
                <div className="break-all font-mono text-xs">{nfse.chave}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-xs text-muted-foreground">Código de Tributação Nacional</div>
                <div className="font-medium">
                  {nfse.codigoTribNac || "—"}
                  {nfse.descricaoTribNac ? (
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      {nfse.descricaoTribNac}
                    </span>
                  ) : null}
                </div>
              </div>
              {nfse.numero ? (
                <div>
                  <div className="text-xs text-muted-foreground">Nº NFS-e</div>
                  <div className="font-medium">{nfse.numero}</div>
                </div>
              ) : null}
            </div>

            <Field
              label={lado === "pagar" ? "Beneficiário" : "Cliente"}
              required
              className="sm:col-span-2"
            >
              <input
                className="input"
                value={revisao.pessoa}
                onChange={(e) => setRevisao({ ...revisao, pessoa: e.target.value })}
              />
            </Field>
            <Field label="Valor (R$)" required>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={revisao.valor || ""}
                onChange={(e) => setRevisao({ ...revisao, valor: Number(e.target.value) })}
              />
            </Field>
            <Field label="Vencimento" required>
              <DatePicker
                value={revisao.dataVencimento}
                onChange={(dataVencimento) => setRevisao({ ...revisao, dataVencimento })}
              />
            </Field>
            <Field label="Competência">
              <DatePicker
                value={revisao.dataCompetencia}
                onChange={(dataCompetencia) => setRevisao({ ...revisao, dataCompetencia })}
              />
            </Field>
            <Field label="Categoria">
              <Select
                value={revisao.categoriaId}
                onChange={(categoriaId) => setRevisao({ ...revisao, categoriaId })}
                options={[
                  { value: "", label: "— sem categoria —" },
                  ...categorias.map((c) => ({ value: c.id, label: c.nome })),
                ]}
              />
            </Field>
            <Field label="Centro de custo">
              <Select
                value={revisao.centroCustoId}
                onChange={(centroCustoId) => setRevisao({ ...revisao, centroCustoId })}
                options={[
                  { value: "", label: "— sem centro —" },
                  ...centros.map((c) => ({ value: c.id, label: c.nome })),
                ]}
              />
            </Field>
            {contasFinanceiras.length > 0 && (
              <Field label="Conta / cartão" className="sm:col-span-2">
                <Select
                  value={revisao.contaFinanceiraId}
                  onChange={(contaFinanceiraId) => setRevisao({ ...revisao, contaFinanceiraId })}
                  options={[
                    { value: "", label: "— sem conta —" },
                    ...contasFinanceiras.map((c) => ({
                      value: c.id,
                      label: labelContaFinanceira(c),
                    })),
                  ]}
                />
              </Field>
            )}
            <Field label="Observação" className="sm:col-span-2">
              <input
                className="input"
                value={revisao.observacao}
                onChange={(e) => setRevisao({ ...revisao, observacao: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}
