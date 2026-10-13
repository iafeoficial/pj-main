import { clienteService, fornecedorService } from "@/data/cadastros";
import {
  categoriaGrupoService,
  categoriaService,
  contaFinanceiraService,
  contaPagarService,
  contaReceberService,
} from "@/data/services";
import {
  lerMovimentacao,
  montarPreviewMovimentacao,
  type MovimentoPlanilha,
  type PreviewMovimentacao,
  type TituloExistenteChave,
} from "@/lib/movimentacaoPlanilha";
import type { Categoria, CategoriaGrupo, CategoriaTipo, ContaFinanceira } from "@/types/domain";

function semAcento(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export async function previewMovimentacao(
  empresaId: string,
  data: ArrayBuffer
): Promise<PreviewMovimentacao> {
  const linhas = await lerMovimentacao(data);
  const [pagar, receber, categorias, contas] = await Promise.all([
    contaPagarService.list(empresaId),
    contaReceberService.list(empresaId),
    categoriaService.list(empresaId),
    contaFinanceiraService.list(empresaId),
  ]);
  const catNome = new Map(categorias.map((c) => [c.id, c.nome]));
  const contaNome = new Map(contas.map((c) => [c.id, c.nome]));
  const existentes: TituloExistenteChave[] = [
    ...pagar.map((c) => ({
      lado: "pagar" as const,
      data: c.dataVencimento,
      pessoa: c.fornecedor,
      valor: c.valor,
      conta: c.contaFinanceiraId ? (contaNome.get(c.contaFinanceiraId) ?? "") : "",
      categoria: c.categoriaId ? (catNome.get(c.categoriaId) ?? "") : "",
    })),
    ...receber.map((c) => ({
      lado: "receber" as const,
      data: c.dataVencimento,
      pessoa: c.cliente,
      valor: c.valor,
      conta: c.contaFinanceiraId ? (contaNome.get(c.contaFinanceiraId) ?? "") : "",
      categoria: c.categoriaId ? (catNome.get(c.categoriaId) ?? "") : "",
    })),
  ];
  return montarPreviewMovimentacao(linhas, existentes);
}

async function garantirConta(
  empresaId: string,
  nome: string,
  instituicao: string,
  cache: ContaFinanceira[]
): Promise<string | null> {
  const nomeTrim = nome.trim();
  if (!nomeTrim) return null;
  const chave = semAcento(nomeTrim);
  const existente = cache.find((c) => semAcento(c.nome) === chave);
  if (existente) return existente.id;
  const criada = await contaFinanceiraService.create(empresaId, {
    tipo: "conta_corrente",
    nome: nomeTrim,
    instituicao: instituicao.trim(),
    titular: "",
    ativo: true,
    observacao: "",
    agencia: "",
    numeroConta: "",
    bandeira: "",
    diaVencimentoFatura: null,
    saldoInicial: 0,
    dataSaldoInicial: null,
  });
  cache.push(criada);
  return criada.id;
}

async function garantirGrupo(
  empresaId: string,
  nome: string,
  tipo: CategoriaTipo,
  cache: CategoriaGrupo[]
): Promise<string | null> {
  const nomeTrim = nome.trim();
  if (!nomeTrim) return null;
  const chave = semAcento(nomeTrim);
  const existente = cache.find((g) => g.tipo === tipo && semAcento(g.nome) === chave);
  if (existente) return existente.id;
  const criado = await categoriaGrupoService.create(empresaId, { nome: nomeTrim, tipo, ativo: true });
  cache.push(criado);
  return criado.id;
}

async function garantirCategoria(
  empresaId: string,
  nome: string,
  tipo: CategoriaTipo,
  grupoId: string | null,
  cache: Categoria[]
): Promise<string | null> {
  const nomeTrim = nome.trim();
  if (!nomeTrim) return null;
  const chave = semAcento(nomeTrim);
  const existente = cache.find(
    (c) => c.tipo === tipo && semAcento(c.nome) === chave && (c.grupoId ?? null) === grupoId
  );
  if (existente) return existente.id;
  const criada = await categoriaService.create(empresaId, {
    nome: nomeTrim,
    tipo,
    ativo: true,
    grupoId,
  });
  cache.push(criada);
  return criada.id;
}

async function garantirParceiro(
  empresaId: string,
  nome: string,
  lado: MovimentoPlanilha["lado"],
  vistos: Set<string>
): Promise<void> {
  const nomeTrim = nome.trim();
  if (!nomeTrim) return;
  const chave = `${lado}:${semAcento(nomeTrim)}`;
  if (vistos.has(chave)) return;
  vistos.add(chave);
  const data = {
    tipoPessoa: "pj" as const,
    nome: nomeTrim,
    nomeFantasia: "",
    cnpjCpf: "",
    ativo: true,
    contatoNome: "",
    telefone: "",
    email: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    observacao: "",
  };
  if (lado === "pagar") await fornecedorService.create(empresaId, data);
  else await clienteService.create(empresaId, data);
}

/** Grava os itens já confirmados no preview. Cria conta, grupo, categoria e parceiro que faltarem. */
export async function confirmarMovimentacao(
  empresaId: string,
  itens: MovimentoPlanilha[]
): Promise<number> {
  const [contas, grupos, categorias, fornecedores, clientes] = await Promise.all([
    contaFinanceiraService.list(empresaId),
    categoriaGrupoService.list(empresaId),
    categoriaService.list(empresaId),
    fornecedorService.list(empresaId),
    clienteService.list(empresaId),
  ]);
  const cacheContas = [...contas];
  const cacheGrupos = [...grupos];
  const cacheCategorias = [...categorias];
  const parceiros = new Set<string>([
    ...fornecedores.map((f) => `pagar:${semAcento(f.nome)}`),
    ...clientes.map((c) => `receber:${semAcento(c.nome)}`),
  ]);

  let gravados = 0;
  for (const item of itens) {
    const tipo = item.lado === "pagar" ? "despesa" : "receita";
    const contaFinanceiraId = await garantirConta(
      empresaId,
      item.contaCorrente,
      item.instituicao,
      cacheContas
    );
    const grupoId = await garantirGrupo(empresaId, item.grupo, tipo, cacheGrupos);
    const categoriaId = await garantirCategoria(empresaId, item.categoria, tipo, grupoId, cacheCategorias);
    await garantirParceiro(empresaId, item.pessoa, item.lado, parceiros);

    const quitado = item.situacao === "quitado";
    const cancelado = item.situacao === "cancelado";
    if (item.lado === "pagar") {
      await contaPagarService.create(empresaId, {
        fornecedor: item.pessoa,
        categoriaId,
        centroCustoId: null,
        contaFinanceiraId,
        valor: item.valor,
        valorPago: quitado ? item.valor : 0,
        dataPagamento: quitado ? item.data : null,
        dataCompetencia: item.data,
        dataVencimento: item.data,
        status: cancelado ? "cancelada" : quitado ? "paga" : "aberta",
        observacao: item.observacao,
      });
    } else {
      await contaReceberService.create(empresaId, {
        cliente: item.pessoa,
        categoriaId,
        centroCustoId: null,
        contaFinanceiraId,
        valor: item.valor,
        valorRecebido: quitado ? item.valor : 0,
        dataRecebimento: quitado ? item.data : null,
        dataCompetencia: item.data,
        dataVencimento: item.data,
        status: cancelado ? "cancelada" : quitado ? "recebida" : "aberta",
        observacao: item.observacao,
      });
    }
    gravados += 1;
  }
  return gravados;
}
