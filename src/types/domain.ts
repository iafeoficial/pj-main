// Tipos de domínio — Plataforma Financeira PJ (Fase 1)
// Espelham as entidades definidas em PROJETO_FINANCEIRO_PJ_MASTER.md

export interface BaseEntity {
  id: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

// ---- Multiempresa ----
export type EmpresaStatus = "ativa" | "inativa";

export interface Empresa extends BaseEntity {
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

export interface Categoria extends OwnedEntity {
  nome: string;
  tipo: CategoriaTipo;
  ativo: boolean;
}

// ---- Centro de Custo ----
export interface CentroCusto extends OwnedEntity {
  nome: string;
  codigo: string;
  ativo: boolean;
}

// ---- Contas a Pagar ----
export type ContaPagarStatus =
  | "rascunho"
  | "aberta"
  | "parcial"
  | "paga"
  | "vencida"
  | "cancelada";

export interface ContaPagar extends OwnedEntity {
  fornecedor: string;
  categoriaId: string | null;
  centroCustoId: string | null;
  valor: number;
  valorPago: number;
  dataCompetencia: string; // ISO date (yyyy-MM-dd)
  dataVencimento: string;
  dataPagamento: string | null;
  status: ContaPagarStatus;
  observacao: string;
  createdBy: string;
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
  categoriaId: string | null;
  centroCustoId: string | null;
  valor: number;
  valorRecebido: number;
  dataCompetencia: string;
  dataVencimento: string;
  dataRecebimento: string | null;
  status: ContaReceberStatus;
  observacao: string;
  createdBy: string;
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
export interface Fornecedor extends OwnedEntity {
  nome: string;
  cnpjCpf: string;
  email: string;
  telefone: string;
  ativo: boolean;
}

export interface Cliente extends OwnedEntity {
  nome: string;
  cnpjCpf: string;
  email: string;
  telefone: string;
  ativo: boolean;
}

export interface Vendedor extends OwnedEntity {
  nome: string;
  email: string;
  comissaoPercent: number;
  ativo: boolean;
}

export interface Produto extends OwnedEntity {
  nome: string;
  sku: string;
  unidade: string;
  precoVenda: number;
  custoMedio: number;
  estoqueAtual: number;
  controlaEstoque: boolean;
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
  contato: string;
  valorEstimado: number;
  estagio: OportunidadeEstagio;
  observacao: string;
  pedidoVendaId: string | null;
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
