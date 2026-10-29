// Parser de NFS-e nacional (XML padrão sped.fazenda.gov.br, versao 1.01).
// Extrai emitente, tomador, valores, chave, tributação nacional e retenções.
import type { ImpostosRetidos } from "@/types/domain";
import { normalizeCNPJ } from "@/lib/utils";

export interface NFSeResultado {
  chave: string;
  numero: string;
  cnpjEmitente: string;
  nomeEmitente: string;
  cnpjTomador: string;
  nomeTomador: string;
  valorLiquido: number;
  valorServico: number;
  valorBase: number;
  valorIss: number;
  valorTotalRetido: number;
  dataCompetencia: string | null; // yyyy-MM-dd
  codigoTribNac: string;
  descricaoTribNac: string;
  descricaoServico: string;
  impostos: ImpostosRetidos | null;
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
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function firstChild(parent: Element | Document, tag: string): Element | undefined {
  return parent.getElementsByTagName(tag)[0];
}

function montarImpostos(doc: Document, valorIss: number, valorTotalRet: number): ImpostosRetidos | null {
  const vPis = num(doc, "vPis");
  const vCofins = num(doc, "vCofins");
  const vIr = num(doc, "vRetIRRF");
  const tpRetIss = text(doc, "tpRetISSQN");
  const issRetido = tpRetIss === "1" || tpRetIss === "2";

  const out: ImpostosRetidos = {};
  if (vPis > 0) out.pis = { reter: true, valor: vPis };
  if (vCofins > 0) out.cofins = { reter: true, valor: vCofins };
  if (vIr > 0) out.ir = { reter: true, valor: vIr };
  if (issRetido && valorIss > 0) out.iss = { reter: true, valor: valorIss };

  // Se só houver total retido sem detalhe, não inventa linhas — o valor líquido já desconta.
  void valorTotalRet;
  return Object.keys(out).length > 0 ? out : null;
}

export function parseNFSe(xml: string): NFSeResultado {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("XML inválido.");
  }

  const infNFSe = firstChild(doc, "infNFSe");
  if (!infNFSe) throw new Error("Não parece ser uma NFS-e (infNFSe ausente).");

  const chave = (infNFSe.getAttribute("Id") ?? "").trim();
  if (!chave) throw new Error("Chave da NFS-e ausente (infNFSe@Id).");

  const numero = text(infNFSe, "nNFSe");

  const emit = firstChild(infNFSe, "emit") ?? firstChild(doc, "emit");
  const prest = firstChild(doc, "prest");
  const toma = firstChild(doc, "toma");

  const cnpjEmitente =
    (emit ? text(emit, "CNPJ") : "") || (prest ? text(prest, "CNPJ") : "");
  const nomeEmitente =
    (emit ? text(emit, "xNome") : "") || (prest ? text(prest, "xNome") : "");

  const cnpjTomador = toma ? text(toma, "CNPJ") || text(toma, "CPF") : "";
  const nomeTomador = toma ? text(toma, "xNome") : "";

  if (!cnpjEmitente && !cnpjTomador) {
    throw new Error("NFS-e sem CNPJ de emitente nem de tomador.");
  }

  // Valores principais ficam em infNFSe/valores (vLiq). Fallbacks em DPS.
  const valoresRaiz = firstChild(infNFSe, "valores");
  const valorLiquido =
    (valoresRaiz ? num(valoresRaiz, "vLiq") : 0) ||
    num(doc, "vLiq") ||
    num(doc, "vTotNF") ||
    num(doc, "vServ");
  const valorBase =
    (valoresRaiz ? num(valoresRaiz, "vBC") : 0) || num(doc, "vBC") || num(doc, "vServ");
  const valorIss =
    (valoresRaiz ? num(valoresRaiz, "vISSQN") : 0) || num(doc, "vISSQN");
  const valorTotalRetido =
    (valoresRaiz ? num(valoresRaiz, "vTotalRet") : 0) || num(doc, "vTotalRet");
  const valorServico = num(doc, "vServ") || valorBase || valorLiquido;

  if (!(valorLiquido > 0)) {
    throw new Error("NFS-e sem valor líquido (vLiq) válido.");
  }

  const dataCompetencia =
    parseData(text(doc, "dCompet")) ||
    parseData(text(doc, "dhEmi")) ||
    parseData(text(doc, "dhProc"));

  const codigoTribNac = text(doc, "cTribNac");
  const descricaoTribNac = text(infNFSe, "xTribNac") || text(doc, "xTribNac");
  const descricaoServico = text(doc, "xDescServ");

  return {
    chave,
    numero,
    cnpjEmitente,
    nomeEmitente,
    cnpjTomador,
    nomeTomador,
    valorLiquido,
    valorServico,
    valorBase,
    valorIss,
    valorTotalRetido,
    dataCompetencia,
    codigoTribNac,
    descricaoTribNac,
    descricaoServico,
    impostos: montarImpostos(doc, valorIss, valorTotalRetido),
  };
}

/** Papel fiscal da empresa na nota, conforme a tela de destino. */
export type NFSeLadoEsperado = "emitente" | "tomador";

export function validarCnpjEmpresaNaNfse(
  nfse: NFSeResultado,
  cnpjEmpresa: string,
  lado: NFSeLadoEsperado
): void {
  const emp = normalizeCNPJ(cnpjEmpresa);
  const emit = normalizeCNPJ(nfse.cnpjEmitente);
  const toma = normalizeCNPJ(nfse.cnpjTomador);

  if (!emp) throw new Error("Empresa ativa sem CNPJ cadastrado.");

  if (lado === "emitente") {
    if (emit !== emp) {
      throw new Error(
        "Nesta tela (Contas a Receber) a empresa precisa ser o emitente/prestador da NFS-e."
      );
    }
    return;
  }

  if (toma !== emp) {
    throw new Error(
      "Nesta tela (Contas a Pagar) a empresa precisa ser o tomador da NFS-e."
    );
  }
}
