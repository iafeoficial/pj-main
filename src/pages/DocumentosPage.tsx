import { useRef, useState } from "react";
import { FileText, FileUp, Loader2, ScanLine, Barcode } from "lucide-react";
import type { Categoria, CentroCusto, Documento, DocumentoTipo } from "@/types/domain";
import { categoriaService, centroCustoService } from "@/data/services";
import { documentoService } from "@/data/documentos";
import { parseNFe } from "@/lib/nfe";
import { parseBoleto, extrairLinhaDigitavel } from "@/lib/boleto";
import { ocrImagem } from "@/lib/ocr";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatBRL, formatDate, today } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { RequireEmpresa } from "@/components/RequireEmpresa";
import { useToast } from "@/components/ui/Toast";

interface Revisao {
  tipo: DocumentoTipo;
  origem: string;
  arquivoNome: string;
  emitente: string;
  documento: string;
  dados: unknown;
  fornecedor: string;
  valor: number;
  dataDocumento: string | null;
  dataVencimento: string;
  categoriaId: string;
  centroCustoId: string;
  observacao: string;
}

function Inner({ empresaId }: { empresaId: string }) {
  const { version, bumpData } = useEmpresa();
  const { notify } = useToast();
  const xmlRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const { data: documentos } = useAsyncData(
    () => documentoService.list(empresaId),
    [empresaId, version],
    [] as Documento[]
  );
  const { data: categorias } = useAsyncData(
    () => categoriaService.listAtivas(empresaId, "despesa"),
    [empresaId, version],
    [] as Categoria[]
  );
  const { data: centros } = useAsyncData(
    () => centroCustoService.listAtivos(empresaId),
    [empresaId, version],
    [] as CentroCusto[]
  );

  const [linha, setLinha] = useState("");
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [revisao, setRevisao] = useState<Revisao | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function onXml(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const nfe = parseNFe(await file.text());
      const itens = nfe.itens
        .map((i) => `${i.quantidade}x ${i.descricao} (${formatBRL(i.valor)})`)
        .join("; ");
      setRevisao({
        tipo: "nfe",
        origem: "xml",
        arquivoNome: file.name,
        emitente: nfe.emitente,
        documento: nfe.chave,
        dados: nfe,
        fornecedor: nfe.emitente,
        valor: nfe.valorTotal,
        dataDocumento: nfe.data,
        dataVencimento: nfe.data ?? today(),
        categoriaId: "",
        centroCustoId: "",
        observacao: itens ? `NF-e: ${itens}`.slice(0, 240) : `NF-e ${nfe.chave}`,
      });
    } catch (err) {
      notify((err as Error).message || "Falha ao ler o XML.", "error");
    } finally {
      if (xmlRef.current) xmlRef.current.value = "";
    }
  }

  function lerLinha(valorLinha: string, origem: string) {
    try {
      const b = parseBoleto(valorLinha);
      setRevisao({
        tipo: "boleto",
        origem,
        arquivoNome: "",
        emitente: "",
        documento: b.linhaDigitavel,
        dados: b,
        fornecedor: "",
        valor: b.valor,
        dataDocumento: b.vencimento,
        dataVencimento: b.vencimento ?? today(),
        categoriaId: "",
        centroCustoId: "",
        observacao: `Boleto ${b.banco} • ${b.linhaDigitavel}`,
      });
    } catch (err) {
      notify((err as Error).message, "error");
    }
  }

  async function onImg(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrProgress(0);
    try {
      const texto = await ocrImagem(file, (p) => setOcrProgress(Math.round(p * 100)));
      const ld = extrairLinhaDigitavel(texto);
      if (!ld) {
        notify("Não foi possível identificar a linha digitável na imagem. Digite manualmente.", "error");
        return;
      }
      setLinha(ld);
      lerLinha(ld, "ocr");
    } catch (err) {
      notify((err as Error).message || "Falha no OCR.", "error");
    } finally {
      setOcrProgress(null);
      if (imgRef.current) imgRef.current.value = "";
    }
  }

  async function confirmar() {
    if (!revisao) return;
    setSalvando(true);
    try {
      await documentoService.criarContaPagar(empresaId, {
        tipo: revisao.tipo,
        origem: revisao.origem,
        arquivoNome: revisao.arquivoNome,
        emitente: revisao.emitente || revisao.fornecedor,
        documento: revisao.documento,
        dados: revisao.dados,
        fornecedor: revisao.fornecedor,
        categoriaId: revisao.categoriaId || null,
        centroCustoId: revisao.centroCustoId || null,
        valor: revisao.valor,
        dataDocumento: revisao.dataDocumento,
        dataVencimento: revisao.dataVencimento,
        observacao: revisao.observacao,
      });
      bumpData();
      notify("Documento importado e conta a pagar criada.");
      setRevisao(null);
      setLinha("");
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Documentos"
        subtitle="Importe NF-e (XML) e boletos. O sistema extrai os dados; a confirmação é sempre manual."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* NF-e */}
        <div className="card p-5">
          <div className="mb-1 flex items-center gap-2 font-medium">
            <FileText className="h-4 w-4 text-primary" /> NF-e (XML)
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Envie o arquivo XML da nota fiscal para extrair fornecedor, valor e itens.
          </p>
          <input ref={xmlRef} type="file" accept=".xml,text/xml" className="hidden" onChange={onXml} />
          <button className="btn-primary" onClick={() => xmlRef.current?.click()}>
            <FileUp className="h-4 w-4" /> Selecionar XML
          </button>
        </div>

        {/* Boleto */}
        <div className="card p-5">
          <div className="mb-1 flex items-center gap-2 font-medium">
            <Barcode className="h-4 w-4 text-primary" /> Boleto
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            Cole a linha digitável (47 dígitos) ou use o OCR de uma imagem.
          </p>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000"
              value={linha}
              onChange={(e) => setLinha(e.target.value)}
            />
            <button className="btn-primary shrink-0" onClick={() => lerLinha(linha, "linha_digitavel")}>
              Ler
            </button>
          </div>
          <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={onImg} />
          <button
            className="btn-outline btn-sm mt-3"
            onClick={() => imgRef.current?.click()}
            disabled={ocrProgress !== null}
          >
            {ocrProgress !== null ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> OCR {ocrProgress}%
              </>
            ) : (
              <>
                <ScanLine className="h-3.5 w-3.5" /> OCR de imagem (assistente)
              </>
            )}
          </button>
        </div>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold">Documentos importados</h2>
      {documentos.length === 0 ? (
        <EmptyState icon={FileText} title="Nenhum documento importado" description="NF-e e boletos importados aparecerão aqui." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Tipo</th>
                <th className="px-4 py-2.5 font-medium">Emitente</th>
                <th className="px-4 py-2.5 font-medium">Documento</th>
                <th className="px-4 py-2.5 text-right font-medium">Valor</th>
                <th className="px-4 py-2.5 font-medium">Data</th>
                <th className="px-4 py-2.5 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {documentos.map((d) => (
                <tr key={d.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <span className="badge bg-accent text-accent-foreground uppercase">{d.tipo}</span>
                  </td>
                  <td className="px-4 py-3">{d.emitente || "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {d.documento ? `${d.documento.slice(0, 16)}…` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{d.valor != null ? formatBRL(d.valor) : "—"}</td>
                  <td className="px-4 py-3">{formatDate(d.dataDocumento)}</td>
                  <td className="px-4 py-3">
                    <span className="badge bg-emerald-100 text-emerald-700">{d.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Revisão / confirmação manual */}
      <Modal
        open={!!revisao}
        title="Revisar e confirmar"
        width="max-w-xl"
        onClose={() => setRevisao(null)}
        footer={
          <>
            <button className="btn-outline" onClick={() => setRevisao(null)}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={confirmar} disabled={salvando}>
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar conta a pagar
            </button>
          </>
        }
      >
        {revisao && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 rounded-md bg-accent/40 px-3 py-2 text-xs text-accent-foreground">
              Dados extraídos automaticamente ({revisao.origem}). Revise antes de confirmar.
            </div>
            <Field label="Fornecedor" required className="sm:col-span-2">
              <input
                className="input"
                value={revisao.fornecedor}
                onChange={(e) => setRevisao({ ...revisao, fornecedor: e.target.value })}
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
              <input
                className="input"
                type="date"
                value={revisao.dataVencimento}
                onChange={(e) => setRevisao({ ...revisao, dataVencimento: e.target.value })}
              />
            </Field>
            <Field label="Categoria">
              <select
                className="input"
                value={revisao.categoriaId}
                onChange={(e) => setRevisao({ ...revisao, categoriaId: e.target.value })}
              >
                <option value="">— sem categoria —</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Centro de custo">
              <select
                className="input"
                value={revisao.centroCustoId}
                onChange={(e) => setRevisao({ ...revisao, centroCustoId: e.target.value })}
              >
                <option value="">— sem centro —</option>
                {centros.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </Field>
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

export function DocumentosPage() {
  return <RequireEmpresa>{(id) => <Inner empresaId={id} />}</RequireEmpresa>;
}
