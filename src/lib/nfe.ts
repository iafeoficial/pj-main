// Parser de NF-e (XML). Extrai emitente, data, valor total e itens.
// Tolerante a nfeProc/NFe e variações de namespace (tags sem prefixo).

export interface NFeItem {
  descricao: string;
  quantidade: number;
  valor: number;
}

export interface NFeResultado {
  chave: string;
  emitente: string;
  cnpjEmitente: string;
  data: string | null; // yyyy-MM-dd
  valorTotal: number;
  itens: NFeItem[];
}

function text(el: Element | Document, tag: string): string {
  const node = el.getElementsByTagName(tag)[0];
  return node?.textContent?.trim() ?? "";
}

function num(el: Element | Document, tag: string): number {
  const v = Number(text(el, tag).replace(",", "."));
  return Number.isFinite(v) ? v : 0;
}

function parseData(raw: string): string | null {
  if (!raw) return null;
  // dhEmi: 2024-05-01T10:00:00-03:00 | dEmi: 2024-05-01
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function parseNFe(xml: string): NFeResultado {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("XML inválido.");
  }

  const infNFe = doc.getElementsByTagName("infNFe")[0];
  if (!infNFe) throw new Error("Não parece ser uma NF-e (infNFe ausente).");

  const idAttr = infNFe.getAttribute("Id") ?? "";
  const chave = idAttr.replace(/^NFe/i, "").replace(/\D/g, "");

  const emit = doc.getElementsByTagName("emit")[0];
  const emitente = emit ? text(emit, "xNome") : "";
  const cnpjEmitente = emit ? text(emit, "CNPJ") : "";

  const ide = doc.getElementsByTagName("ide")[0];
  const data = ide ? parseData(text(ide, "dhEmi") || text(ide, "dEmi")) : null;

  // Valor total: total/ICMSTot/vNF
  const valorTotal = num(doc, "vNF");

  const itens: NFeItem[] = [];
  const dets = doc.getElementsByTagName("det");
  for (let i = 0; i < dets.length; i++) {
    const prod = dets[i].getElementsByTagName("prod")[0];
    if (!prod) continue;
    itens.push({
      descricao: text(prod, "xProd"),
      quantidade: num(prod, "qCom"),
      valor: num(prod, "vProd"),
    });
  }

  return { chave, emitente, cnpjEmitente, data, valorTotal, itens };
}
