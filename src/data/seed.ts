// Seed de demonstração — cria uma empresa exemplo com cadastros e lançamentos (C3, async).
import {
  empresaService,
  categoriaService,
  centroCustoService,
  contaPagarService,
  contaReceberService,
} from "./services";
import { conciliacaoService, regraService } from "./conciliacao";
import { clienteService, fornecedorService, vendedorService } from "./cadastros";
import { produtoService } from "./estoque";
import { oportunidadeService } from "./operacao";

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function seedDemo(): Promise<string> {
  const empresa = await empresaService.create({
    cnpj: "11222333000181",
    razaoSocial: "Acme Serviços e Consultoria LTDA",
    nomeFantasia: "Acme Consultoria",
    email: "financeiro@acme.com.br",
    telefone: "(11) 4000-0000",
    status: "ativa",
  });
  const id = empresa.id;

  const [recServicos, recProdutos, despFolha, despFornec, despImpostos, despTarifas] = await Promise.all([
    categoriaService.create(id, { nome: "Receita de Serviços", tipo: "receita", ativo: true }),
    categoriaService.create(id, { nome: "Venda de Produtos", tipo: "receita", ativo: true }),
    categoriaService.create(id, { nome: "Folha de Pagamento", tipo: "despesa", ativo: true }),
    categoriaService.create(id, { nome: "Fornecedores", tipo: "despesa", ativo: true }),
    categoriaService.create(id, { nome: "Impostos", tipo: "despesa", ativo: true }),
    categoriaService.create(id, { nome: "Tarifas Bancárias", tipo: "despesa", ativo: true }),
  ]);

  const [ccAdm, ccCom] = await Promise.all([
    centroCustoService.create(id, { nome: "Administrativo", codigo: "CC-001", ativo: true }),
    centroCustoService.create(id, { nome: "Comercial", codigo: "CC-002", ativo: true }),
  ]);

  // Contas a receber
  await contaReceberService.create(id, {
    cliente: "Cliente Alpha LTDA",
    categoriaId: recServicos.id,
    centroCustoId: ccCom.id,
    valor: 12000,
    dataCompetencia: dateOffset(-10),
    dataVencimento: dateOffset(5),
    status: "aberta",
    observacao: "Projeto de consultoria — parcela 1",
  });
  await contaReceberService.create(id, {
    cliente: "Beta Comércio",
    categoriaId: recProdutos.id,
    centroCustoId: ccCom.id,
    valor: 4500,
    dataCompetencia: dateOffset(-40),
    dataVencimento: dateOffset(-8),
    status: "aberta",
    observacao: "Pedido #1043",
  });
  const recPaga = await contaReceberService.create(id, {
    cliente: "Gamma Tech",
    categoriaId: recServicos.id,
    centroCustoId: ccCom.id,
    valor: 8000,
    dataCompetencia: dateOffset(-25),
    dataVencimento: dateOffset(-15),
    status: "aberta",
    observacao: "Mensalidade de suporte",
  });
  await contaReceberService.registrarRecebimento(id, recPaga.id, 8000, dateOffset(-14));

  // Contas a pagar
  await contaPagarService.create(id, {
    fornecedor: "Distribuidora Central",
    categoriaId: despFornec.id,
    centroCustoId: ccAdm.id,
    valor: 3200,
    dataCompetencia: dateOffset(-5),
    dataVencimento: dateOffset(7),
    status: "aberta",
    observacao: "Insumos de escritório",
  });
  const folha = await contaPagarService.create(id, {
    fornecedor: "Folha — Mensal",
    categoriaId: despFolha.id,
    centroCustoId: ccAdm.id,
    valor: 15000,
    dataCompetencia: dateOffset(-2),
    dataVencimento: dateOffset(4),
    status: "aberta",
    observacao: "Salários da equipe",
  });
  await contaPagarService.registrarPagamento(id, folha.id, 7500, dateOffset(-1));
  await contaPagarService.create(id, {
    fornecedor: "Receita Federal — DAS",
    categoriaId: despImpostos.id,
    centroCustoId: ccAdm.id,
    valor: 1800,
    dataCompetencia: dateOffset(-35),
    dataVencimento: dateOffset(-6),
    status: "aberta",
    observacao: "Simples Nacional",
  });

  // Fase 2 — regra e extrato de demonstração para a conciliação.
  await regraService.create(id, {
    nome: "Tarifas bancárias",
    palavraChave: "TARIFA",
    tipo: "debito",
    categoriaId: despTarifas.id,
    prioridade: 10,
    ativo: true,
  });

  // Fase 5 — cadastros e produto de demonstração.
  const [, clienteAlpha, vendedorJoao] = await Promise.all([
    fornecedorService.create(id, { nome: "Distribuidora Central", cnpjCpf: "", email: "", telefone: "", ativo: true }),
    clienteService.create(id, { nome: "Cliente Alpha LTDA", cnpjCpf: "", email: "contato@alpha.com.br", telefone: "(11) 99999-0001", ativo: true }),
    vendedorService.create(id, { nome: "João Vendas", email: "", comissaoPercent: 5, ativo: true }),
    produtoService.create(id, {
      nome: "Serviço de Consultoria (hora)",
      sku: "SVC-001",
      unidade: "h",
      precoVenda: 250,
      custoMedio: 0,
      estoqueAtual: 0,
      controlaEstoque: false,
      ativo: true,
    }),
  ]);

  await Promise.all([
    oportunidadeService.create(id, {
      titulo: "Projeto consultoria Q3",
      clienteId: clienteAlpha.id,
      clienteNome: clienteAlpha.nome,
      vendedorId: vendedorJoao.id,
      contato: clienteAlpha.telefone,
      valorEstimado: 18000,
      estagio: "proposta",
      observacao: "Escopo de 3 meses — aguardando PO",
      pedidoVendaId: null,
    }),
    oportunidadeService.create(id, {
      titulo: "Suporte mensal Alpha",
      clienteId: clienteAlpha.id,
      clienteNome: clienteAlpha.nome,
      vendedorId: vendedorJoao.id,
      contato: clienteAlpha.email,
      valorEstimado: 4500,
      estagio: "lead",
      observacao: "Renovação anual",
      pedidoVendaId: null,
    }),
  ]);

  await conciliacaoService.importarOFX(id, {
    banco: "001",
    conta: "12345-6",
    dataInicio: dateOffset(-12),
    dataFim: dateOffset(0),
    transacoes: [
      { fitid: "DEMO-0001", data: dateOffset(-14), valor: 8000, tipo: "credito", descricao: "TED RECEBIDA GAMMA TECH", documento: "" },
      { fitid: "DEMO-0002", data: dateOffset(-1), valor: -7500, tipo: "debito", descricao: "PAGAMENTO FOLHA", documento: "" },
      { fitid: "DEMO-0003", data: dateOffset(-3), valor: -39.9, tipo: "debito", descricao: "TARIFA PACOTE SERVICOS", documento: "" },
      { fitid: "DEMO-0004", data: dateOffset(-2), valor: 4500, tipo: "credito", descricao: "PIX BETA COMERCIO", documento: "" },
    ],
  });

  return id;
}
