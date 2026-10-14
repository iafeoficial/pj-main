import { useMemo, useState } from "react";
import { Handshake, Pencil, Truck, Users } from "lucide-react";
import type { Cliente, Fornecedor } from "@/types/domain";
import { clienteService, fornecedorService } from "@/data/cadastros";
import { RequireEmpresa } from "@/components/RequireEmpresa";
import { useEmpresa } from "@/context/EmpresaContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { can } from "@/lib/rbac";
import { combinaBusca } from "@/lib/busca";
import { PageHeader } from "@/components/ui/PageHeader";
import { BuscaCampo, BuscaVazia } from "@/components/ui/BuscaCampo";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ParceiroCrud, type ParceiroCrudConfig } from "@/features/cadastros/ParceiroCrud";
import {
  ParceiroForm,
  emptyParceiroForm,
  parceiroFromEntity,
  parceiroToPayload,
  type ParceiroFormData,
} from "@/features/cadastros/ParceiroForm";
import { cn } from "@/lib/utils";

type Aba = "todos" | "clientes" | "fornecedores";
type Parceiro = Cliente | Fornecedor;

const configCliente: ParceiroCrudConfig = {
  titulo: "Clientes",
  subtitulo: "Cadastro de clientes para vendas e contas a receber.",
  icon: Users,
  singular: "Cliente",
  variant: "cliente",
  service: clienteService as unknown as ParceiroCrudConfig["service"],
};

const configFornecedor: ParceiroCrudConfig = {
  titulo: "Fornecedores",
  subtitulo: "Cadastro de fornecedores para compras e contas a pagar.",
  icon: Truck,
  singular: "Fornecedor",
  variant: "fornecedor",
  service: fornecedorService as unknown as ParceiroCrudConfig["service"],
};

function chaveParceiro(cnpjCpf: string, nome: string): string {
  const alnum = cnpjCpf.replace(/[^0-9a-z]/gi, "").toLowerCase();
  if (alnum.length === 11 || alnum.length === 14) return `doc:${alnum}`;
  return `nome:${nome.trim().toLowerCase()}`;
}

function cidadeUf(row: { cidade: string; uf: string }) {
  const parts = [row.cidade, row.uf].filter(Boolean);
  return parts.length ? parts.join("/") : "—";
}

interface LinhaUnificada {
  chave: string;
  nome: string;
  nomeFantasia: string;
  cnpjCpf: string;
  telefone: string;
  email: string;
  cidade: string;
  uf: string;
  ativo: boolean;
  cliente: Cliente | null;
  fornecedor: Fornecedor | null;
}

function unir(clientes: Cliente[], fornecedores: Fornecedor[]): LinhaUnificada[] {
  const map = new Map<string, LinhaUnificada>();
  const colocar = (row: Parceiro, papel: "cliente" | "fornecedor") => {
    const chave = chaveParceiro(row.cnpjCpf, row.nome);
    const atual = map.get(chave);
    if (!atual) {
      map.set(chave, {
        chave,
        nome: row.nome,
        nomeFantasia: row.nomeFantasia,
        cnpjCpf: row.cnpjCpf,
        telefone: row.telefone,
        email: row.email,
        cidade: row.cidade,
        uf: row.uf,
        ativo: row.ativo,
        cliente: papel === "cliente" ? (row as Cliente) : null,
        fornecedor: papel === "fornecedor" ? (row as Fornecedor) : null,
      });
      return;
    }
    if (papel === "cliente") atual.cliente = row as Cliente;
    else atual.fornecedor = row as Fornecedor;
    if (!atual.cnpjCpf && row.cnpjCpf) atual.cnpjCpf = row.cnpjCpf;
    if (!atual.telefone && row.telefone) atual.telefone = row.telefone;
    if (!atual.email && row.email) atual.email = row.email;
    if (!atual.nomeFantasia && row.nomeFantasia) atual.nomeFantasia = row.nomeFantasia;
    atual.ativo = atual.ativo || row.ativo;
  };
  for (const c of clientes) colocar(c, "cliente");
  for (const f of fornecedores) colocar(f, "fornecedor");
  return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

function ListaTodos({ empresaId, busca }: { empresaId: string; busca: string }) {
  const { version, bumpData } = useEmpresa();
  const { notify } = useToast();
  const { data: clientes } = useAsyncData(
    () => clienteService.list(empresaId),
    [empresaId, version],
    [] as Cliente[]
  );
  const { data: fornecedores } = useAsyncData(
    () => fornecedorService.list(empresaId),
    [empresaId, version],
    [] as Fornecedor[]
  );
  const linhas = useMemo(() => {
    const todas = unir(clientes, fornecedores);
    return todas.filter((row) =>
      combinaBusca(busca, [
        row.nome,
        row.nomeFantasia,
        row.cnpjCpf,
        row.telefone,
        row.email,
        row.cidade,
        row.uf,
        row.cliente ? "Cliente" : "",
        row.fornecedor ? "Fornecedor" : "",
      ])
    );
  }, [clientes, fornecedores, busca]);

  const [editando, setEditando] = useState<{ papel: "cliente" | "fornecedor"; row: Parceiro } | null>(
    null
  );
  const [form, setForm] = useState<ParceiroFormData>(() => emptyParceiroForm());
  const [error, setError] = useState("");

  function abrir(papel: "cliente" | "fornecedor", row: Parceiro) {
    setEditando({ papel, row });
    setForm(parceiroFromEntity(row));
    setError("");
  }

  async function salvar() {
    if (!editando) return;
    if (!form.nome.trim()) {
      setError("Informe o nome.");
      return;
    }
    const payload = parceiroToPayload(form);
    try {
      if (editando.papel === "cliente") {
        await clienteService.update(empresaId, editando.row.id, payload);
      } else {
        await fornecedorService.update(empresaId, editando.row.id, payload);
      }
      bumpData();
      notify(editando.papel === "cliente" ? "Cliente atualizado." : "Fornecedor atualizado.");
      setEditando(null);
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  if (clientes.length === 0 && fornecedores.length === 0) {
    return (
      <EmptyState
        icon={Handshake}
        title="Nenhum parceiro"
        description="Cadastre um cliente ou um fornecedor nas abas ao lado, ou importe uma planilha."
      />
    );
  }

  if (linhas.length === 0) return <BuscaVazia />;

  return (
    <>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Nome</th>
              <th className="px-4 py-2.5 font-medium">Papel</th>
              <th className="px-4 py-2.5 font-medium">CNPJ/CPF</th>
              <th className="px-4 py-2.5 font-medium">Telefone</th>
              <th className="px-4 py-2.5 font-medium">Cidade/UF</th>
              <th className="px-4 py-2.5 font-medium">Situação</th>
              <th className="px-4 py-2.5 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {linhas.map((row) => (
              <tr key={row.chave} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="font-medium">{row.nome}</div>
                  {row.nomeFantasia && (
                    <div className="text-xs text-muted-foreground">{row.nomeFantasia}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {row.cliente && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Cliente</span>
                    )}
                    {row.fornecedor && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Fornecedor</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">{row.cnpjCpf || "—"}</td>
                <td className="px-4 py-3">
                  <div>{row.telefone || "—"}</div>
                  {row.email && <div className="text-xs text-muted-foreground">{row.email}</div>}
                </td>
                <td className="px-4 py-3">{cidadeUf(row)}</td>
                <td className="px-4 py-3">{row.ativo ? "Ativo" : "Inativo"}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {row.cliente && (
                      <button
                        className="btn-ghost btn-sm"
                        title="Editar cliente"
                        onClick={() => abrir("cliente", row.cliente!)}
                      >
                        <Pencil className="h-4 w-4" />
                        {row.fornecedor && <span className="text-xs">Cliente</span>}
                      </button>
                    )}
                    {row.fornecedor && (
                      <button
                        className="btn-ghost btn-sm"
                        title="Editar fornecedor"
                        onClick={() => abrir("fornecedor", row.fornecedor!)}
                      >
                        <Pencil className="h-4 w-4" />
                        {row.cliente && <span className="text-xs">Fornecedor</span>}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!editando}
        title={editando?.papel === "fornecedor" ? "Editar fornecedor" : "Editar cliente"}
        width="max-w-2xl"
        onClose={() => setEditando(null)}
        footer={
          <>
            <button className="btn-outline" onClick={() => setEditando(null)}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={() => void salvar()}>
              Salvar
            </button>
          </>
        }
      >
        {editando && (
          <ParceiroForm
            variant={editando.papel}
            value={form}
            onChange={setForm}
            error={error}
          />
        )}
      </Modal>
    </>
  );
}

export function ParceirosPage() {
  return (
    <RequireEmpresa>
      {(id) => <ParceirosInner empresaId={id} />}
    </RequireEmpresa>
  );
}

function ParceirosInner({ empresaId }: { empresaId: string }) {
  const { papel } = useEmpresa();
  const [busca, setBusca] = useState("");
  const veClientes = !papel || can(papel, "vendas");
  const veFornecedores = !papel || can(papel, "compras");
  const inicial: Aba = veClientes && veFornecedores ? "todos" : veClientes ? "clientes" : "fornecedores";
  const [aba, setAba] = useState<Aba>(inicial);

  const abas: { id: Aba; label: string }[] = [];
  if (veClientes && veFornecedores) abas.push({ id: "todos", label: "Todos" });
  if (veClientes) abas.push({ id: "clientes", label: "Clientes" });
  if (veFornecedores) abas.push({ id: "fornecedores", label: "Fornecedores" });

  const abaAtual = abas.some((a) => a.id === aba) ? aba : abas[0]?.id;

  if (abas.length === 0) {
    return (
      <EmptyState
        icon={Handshake}
        title="Sem acesso"
        description="Seu papel não inclui vendas nem compras."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Parceiros"
        subtitle="Clientes e fornecedores da empresa. A alteração de nome vale nas contas e nos pedidos ligados ao cadastro."
      />
      <div className="mb-4">
        <BuscaCampo value={busca} onChange={setBusca} placeholder="Buscar por nome, CPF ou CNPJ" />
      </div>
      <div className="mb-4 flex gap-1 border-b border-border">
        {abas.map((item) => (
          <button
            key={item.id}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              abaAtual === item.id
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setAba(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {abaAtual === "todos" && <ListaTodos empresaId={empresaId} busca={busca} />}
      {abaAtual === "clientes" && (
        <ParceiroCrud config={configCliente} empresaId={empresaId} embedded busca={busca} />
      )}
      {abaAtual === "fornecedores" && (
        <ParceiroCrud config={configFornecedor} empresaId={empresaId} embedded busca={busca} />
      )}
    </>
  );
}
