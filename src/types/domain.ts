// Tipos de domínio — Plataforma Financeira PJ (Fase 1)
// Espelham as entidades definidas em PROJETO_FINANCEIRO_PJ_MASTER.md

export interface BaseEntity {
  id: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

// ---- Endereço BR (cadastros operacionais) ----
export interface Endereco {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export type TipoPessoa = "pf" | "pj";

export type FonteLead = "indicacao" | "site" | "redes" | "evento" | "outro";

// ---- Multiempresa ----
export type EmpresaStatus = "ativa" | "inativa";

export interface Empresa extends BaseEntity, Endereco {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  email: string;
  telefone: string;
  status: EmpresaStatus;
}

// ---- Entidades isoladas por empresa ----
export interface OwnedEntity extends BaseEntity {
  empresaId: string;
}

// ---- Categorias ----
export type CategoriaTipo = "receita" | "despesa";

/** Agrupa categorias-folha na DRE (ex.: Despesas Administrativas). */
export interface CategoriaGrupo extends OwnedEntity {
  nome: string;
  tipo: CategoriaTipo;
  ativo: boolean;
}

export interface Categoria extends OwnedEntity {
  nome: string;
  tipo: CategoriaTipo;
  ativo: boolean;
  /** Grupo pai (nullable). Só categorias-folha entram em lançamentos. */
  grupoId: string | null;
}

// ---- Centro de Custo ----
export interface CentroCusto extends OwnedEntity {
  nome: string;
  codigo: string;
  ativo: boolean;
}

// ---- Contas e Cartões ----
export type ContaFinanceiraTipo = "conta_corrente" | "cartao_credito";

export interface ContaFinanceira extends OwnedEntity {
  tipo: ContaFinanceiraTipo;
  nome: string;
  instituicao: string;
  /** Titular / responsável pelo cartão ou conta. */
  titular: string;
  ativo: boolean;
  observacao: string;
  // conta corrente
  agencia: string;
  numeroConta: string;
  // cartão de crédito
  bandeira: string;
  diaVencimentoFatura: number | null; // 1–28
  // saldo de abertura (opcional)
  saldoInicial: number;
  dataSaldoInicial: string | null; // yyyy-MM-dd
}

// ---- Contas a Pagar ----
export type ContaPagarStatus =
  | "rascunho"
  | "aberta"
  | "parcial"
  | "paga"
  | "vencida"
  | "cancelada";

/** Impostos retidos na fonte (valor + flag "reter"). */
export const IMPOSTOS_RETIDOS = ["pis", "cofins", "csll", "ir", "iss", "inss"] as const;
export type ImpostoRetido = (typeof IMPOSTOS_RETIDOS)[number];

export interface ImpostoLinha {
  reter: boolean;
  valor: number;
}

export type ImpostosRetidos = Partial<Record<ImpostoRetido, ImpostoLinha>>;

export type RecorrenciaTipo =
  | "semanal"
  | "quinzenal"
  | "mensal"
  | "semestral"
  | "anual"
  | "personalizada";

export interface ContaPagar extends OwnedEntity {
  fornecedor: string;
  /** Cadastro de fornecedor, quando o lançamento nasceu de um parceiro. */
  fornecedorId: string | null;
  categoriaId: string | null;
  centroCustoId: string | null;
  contaFinanceiraId: string | null;
  valor: number;
  valorPago: number;
  desconto: number;
  juros: number;
  numeroNf: string;
  impostos: ImpostosRetidos | null;
  // Parcelamento: títulos irmãos compartilham `grupoParcelamento`.
  parcelaNumero: number | null;
  parcelaTotal: number | null;
  grupoParcelamento: string | null;
  // Repetição: títulos gerados em série compartilham `grupoRecorrencia`.
  recorrencia: RecorrenciaTipo | null;
  /** Dias entre ocorrências quando `recorrencia === "personalizada"`. */
  recorrenciaDias: number | null;
  grupoRecorrencia: string | null;
  dataCompetencia: string; // ISO date (yyyy-MM-dd)
  dataVencimento: string;
  dataPagamento: string | null;
  status: ContaPagarStatus;
  observacao: string;
  /** Movimentação interna: não entra em totais, fluxo, DRE nem relatórios. */
  transferencia: boolean;
  createdBy: string;
}

/** Baixa individual de uma conta a pagar (histórico de pagamentos). */
export interface PagamentoConta extends OwnedEntity {
  contaPagarId: string;
  data: string; // yyyy-MM-dd
  valor: number;
  observacao: string;
}

// ---- Contas a Receber ----
export type ContaReceberStatus =
  | "rascunho"
  | "aberta"
  | "parcial"
  | "recebida"
  | "vencida"
  | "cancelada";

export interface ContaReceber extends OwnedEntity {
  cliente: string;
  /** Cadastro de cliente, quando o lançamento nasceu de um parceiro. */
  clienteId: string | null;
  categoriaId: string | null;
  centroCustoId: string | null;
  contaFinanceiraId: string | null;
  valor: number;
  valorRecebido: number;
  dataCompetencia: string;
  dataVencimento: string;
  dataRecebimento: string | null;
  status: ContaReceberStatus;
  observacao: string;
  /** Movimentação interna: não entra em totais, fluxo, DRE nem relatórios. */
  transferencia: boolean;
  createdBy: string;
}

/** Saída de uma conta e entrada em outra, da mesma empresa. Neutra no resultado. */
export interface TransferenciaConta extends OwnedEntity {
  contaOrigemId: string;
  contaDestinoId: string;
  data: string; // yyyy-MM-dd
  valor: number;
  observacao: string;
}

// ---- Fase 2: Conciliação Bancária ----
export type TransacaoTipo = "credito" | "debito";
export type ConciliacaoStatus = "pendente" | "conciliada" | "ignorada";

export interface ExtratoBancario extends OwnedEntity {
  banco: string;
  conta: string;
  dataInicio: string | null;
  dataFim: string | null;
  arquivoNome: string;
}

export interface TransacaoBancaria extends OwnedEntity {
  extratoId: string | null;
  fitid: string;
  data: string; // yyyy-MM-dd
  valor: number; // positivo = crédito, negativo = débito
  tipo: TransacaoTipo;
  descricao: string;
  documento: string;
  statusConciliacao: ConciliacaoStatus;
  contaPagarId: string | null;
  contaReceberId: string | null;
}

export interface RegraConciliacao extends OwnedEntity {
  nome: string;
  palavraChave: string;
  tipo: TransacaoTipo | null; // null = aplica a ambos
  categoriaId: string | null;
  prioridade: number;
  ativo: boolean;
}

// ---- Fase 3: Documentos ----
export type DocumentoTipo = "nfe" | "boleto";

export interface Documento extends OwnedEntity {
  tipo: DocumentoTipo;
  origem: string; // xml | ocr | linha_digitavel
  arquivoNome: string;
  emitente: string;
  documento: string; // chave NF-e ou linha digitável
  valor: number | null;
  dataDocumento: string | null;
  dados: unknown; // payload bruto (itens etc.)
  contaPagarId: string | null;
  status: string; // importado | vinculado
}

// ---- Fase 4: Certificado Digital ----
export type CertificadoTipo = "A1" | "A3";

export interface Certificado extends OwnedEntity {
  titular: string;
  tipo: CertificadoTipo;
  validade: string; // yyyy-MM-dd
  observacao: string;
  ativo: boolean;
}

// ---- Fase 5: Operação ----
export interface Fornecedor extends OwnedEntity, Endereco {
  tipoPessoa: TipoPessoa;
  nome: string;
  nomeFantasia: string;
  cnpjCpf: string;
  contatoNome: string;
  email: string;
  telefone: string;
  observacao: string;
  ativo: boolean;
}

export interface Cliente extends OwnedEntity, Endereco {
  tipoPessoa: TipoPessoa;
  nome: string;
  nomeFantasia: string;
  cnpjCpf: string;
  contatoNome: string;
  email: string;
  telefone: string;
  observacao: string;
  ativo: boolean;
}

export interface Vendedor extends OwnedEntity {
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  comissaoPercent: number;
  observacao: string;
  ativo: boolean;
}

export interface Produto extends OwnedEntity {
  nome: string;
  sku: string;
  unidade: string;
  descricao: string;
  precoVenda: number;
  custoMedio: number;
  estoqueAtual: number;
  controlaEstoque: boolean;
  observacao: string;
  ativo: boolean;
}

export type EstoqueMovTipo = "entrada" | "saida" | "ajuste";
export interface EstoqueMovimento extends OwnedEntity {
  produtoId: string;
  tipo: EstoqueMovTipo;
  quantidade: number;
  custoUnitario: number;
  documento: string;
  observacao: string;
  data: string;
}

export type PedidoCompraStatus = "rascunho" | "aprovado" | "recebido" | "cancelado";
export interface PedidoCompra extends OwnedEntity {
  fornecedorId: string | null;
  fornecedorNome: string;
  status: PedidoCompraStatus;
  data: string;
  valorTotal: number;
  observacao: string;
  contaPagarId: string | null;
}

export interface PedidoItem extends OwnedEntity {
  pedidoId: string;
  produtoId: string | null;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export type PedidoVendaStatus = "orcamento" | "pedido" | "faturado" | "cancelado";
export interface PedidoVenda extends OwnedEntity {
  clienteId: string | null;
  clienteNome: string;
  vendedorId: string | null;
  status: PedidoVendaStatus;
  data: string;
  valorTotal: number;
  comissaoPercent: number;
  comissaoValor: number;
  observacao: string;
  contaReceberId: string | null;
}

export type OportunidadeEstagio = "lead" | "qualificado" | "proposta" | "ganho" | "perdido";
export interface Oportunidade extends OwnedEntity {
  titulo: string;
  clienteId: string | null;
  clienteNome: string;
  vendedorId: string | null;
  pedidoVendaId: string | null;
  contato: string;
  valorEstimado: number;
  estagio: OportunidadeEstagio;
  dataPrevisaoFechamento: string | null;
  fonteLead: FonteLead | null;
  observacao: string;
}

// Item genérico para edição na UI (compra/venda).
export interface ItemEditavel {
  produtoId: string | null;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
}

// ---- Auditoria ----
export type AuditAction =
  | "inclusao"
  | "alteracao"
  | "exclusao"
  | "baixa"
  | "cancelamento";

export interface AuditLog extends BaseEntity {
  empresaId: string;
  entidade: string;
  entidadeId: string;
  acao: AuditAction;
  descricao: string;
  usuario: string;
}
