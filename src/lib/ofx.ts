// Parser de arquivos OFX (Open Financial Exchange) — formato SGML 1.x e XML 2.x.
// Extrai transações (STMTTRN) e metadados de conta. Suficiente para conciliação manual.

export interface OfxTransacao {
  fitid: string;
  data: string; // yyyy-MM-dd
  valor: number; // sinal preservado (+crédito / -débito)
  tipo: "credito" | "debito";
  descricao: string;
  documento: string;
}

export interface OfxResultado {
  banco: string;
  conta: string;
  dataInicio: string | null;
  dataFim: string | null;
  transacoes: OfxTransacao[];
}

/** Extrai o valor de um tag OFX (tolerante a SGML sem fechamento). */
function tag(block: string, name: string): string {
  const re = new RegExp(`<${name}>([^<\r\n]*)`, "i");
  const m = block.match(re);
  return m ? m[1].trim() : "";
}

/** Converte data OFX (YYYYMMDD[HHMMSS][.xxx][tz]) para yyyy-MM-dd. */
function parseOfxDate(raw: string): string {
  const d = raw.replace(/[^0-9]/g, "").slice(0, 8);
  if (d.length < 8) return "";
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

export function parseOFX(content: string): OfxResultado {
  // Remove o cabeçalho SGML antes do <OFX>.
  const ofxStart = content.search(/<OFX>/i);
  const body = ofxStart >= 0 ? content.slice(ofxStart) : content;

  const banco = tag(body, "BANKID") || tag(body, "ORG");
  const conta = tag(body, "ACCTID");

  const dtStart = parseOfxDate(tag(body, "DTSTART"));
  const dtEnd = parseOfxDate(tag(body, "DTEND"));

  const transacoes: OfxTransacao[] = [];
  const blocks = body.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi);
  if (blocks) {
    for (const block of blocks) {
      const fitid = tag(block, "FITID");
      const data = parseOfxDate(tag(block, "DTPOSTED"));
      const valor = Number(tag(block, "TRNAMT").replace(",", "."));
      if (!data || Number.isNaN(valor)) continue;
      const memo = tag(block, "MEMO") || tag(block, "NAME");
      transacoes.push({
        fitid: fitid || `${data}-${valor}-${memo}`.slice(0, 64),
        data,
        valor,
        tipo: valor >= 0 ? "credito" : "debito",
        descricao: memo,
        documento: tag(block, "CHECKNUM") || tag(block, "REFNUM"),
      });
    }
  }

  return {
    banco,
    conta,
    dataInicio: dtStart || null,
    dataFim: dtEnd || null,
    transacoes,
  };
}
