import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Cliente, Fornecedor, TipoPessoa } from "@/types/domain";
import { formatCpfCnpj, formatTelefone, TELEFONE_PLACEHOLDER } from "@/lib/masks";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { EnderecoFields, EMPTY_ENDERECO } from "@/components/EnderecoFields";

export interface ParceiroFormData {
  tipoPessoa: TipoPessoa;
  nome: string;
  nomeFantasia: string;
  cnpjCpf: string;
  ativo: boolean;
  contatoNome: string;
  telefone: string;
  email: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  observacao: string;
}

export function emptyParceiroForm(): ParceiroFormData {
  return {
    tipoPessoa: "pj",
    nome: "",
    nomeFantasia: "",
    cnpjCpf: "",
    ativo: true,
    contatoNome: "",
    telefone: "",
    email: "",
    ...EMPTY_ENDERECO,
    observacao: "",
  };
}

export function parceiroFromEntity(e: Cliente | Fornecedor): ParceiroFormData {
  return {
    tipoPessoa: e.tipoPessoa ?? "pj",
    nome: e.nome,
    nomeFantasia: e.nomeFantasia ?? "",
    cnpjCpf: e.cnpjCpf ? formatCpfCnpj(e.cnpjCpf) : "",
    ativo: e.ativo,
    contatoNome: e.contatoNome ?? "",
    telefone: e.telefone ? formatTelefone(e.telefone) : "",
    email: e.email ?? "",
    cep: e.cep ?? "",
    logradouro: e.logradouro ?? "",
    numero: e.numero ?? "",
    complemento: e.complemento ?? "",
    bairro: e.bairro ?? "",
    cidade: e.cidade ?? "",
    uf: e.uf ?? "",
    observacao: e.observacao ?? "",
  };
}

export function parceiroToPayload(form: ParceiroFormData): Omit<Cliente, "id" | "createdAt" | "updatedAt" | "empresaId"> {
  return {
    tipoPessoa: form.tipoPessoa,
    nome: form.nome.trim(),
    nomeFantasia: form.nomeFantasia.trim(),
    cnpjCpf: form.cnpjCpf.trim(),
    ativo: form.ativo,
    contatoNome: form.contatoNome.trim(),
    telefone: form.telefone.trim(),
    email: form.email.trim(),
    cep: form.cep.trim(),
    logradouro: form.logradouro.trim(),
    numero: form.numero.trim(),
    complemento: form.complemento.trim(),
    bairro: form.bairro.trim(),
    cidade: form.cidade.trim(),
    uf: form.uf.trim(),
    observacao: form.observacao.trim(),
  };
}

interface ParceiroFormProps {
  value: ParceiroFormData;
  onChange: (value: ParceiroFormData) => void;
  variant: "cliente" | "fornecedor";
  mode?: "full" | "compact";
  error?: string;
  disabled?: boolean;
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="border-b border-border pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-2">
      {children}
    </h3>
  );
}

export function ParceiroForm({
  value,
  onChange,
  variant,
  mode = "full",
  error,
  disabled,
}: ParceiroFormProps) {
  const [enderecoOpen, setEnderecoOpen] = useState(mode === "full");
  const nomeLabel = value.tipoPessoa === "pj" ? "Razão social" : "Nome completo";
  const entityLabel = variant === "cliente" ? "cliente" : "fornecedor";

  function patch(partial: Partial<ParceiroFormData>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <SectionTitle>Identificação</SectionTitle>

      <Field label="Tipo">
        <Select
          disabled={disabled}
          value={value.tipoPessoa}
          onChange={(tipoPessoa) => patch({ tipoPessoa: tipoPessoa as TipoPessoa })}
          options={[
            { value: "pj", label: "Pessoa jurídica (PJ)" },
            { value: "pf", label: "Pessoa física (PF)" },
          ]}
        />
      </Field>
      <Field label="Situação">
        <label className="flex h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            disabled={disabled}
            checked={value.ativo}
            onChange={(e) => patch({ ativo: e.target.checked })}
          />
          Ativo
        </label>
      </Field>
      <Field label={nomeLabel} required error={error} className="sm:col-span-2">
        <input
          className="input"
          disabled={disabled}
          value={value.nome}
          onChange={(e) => patch({ nome: e.target.value })}
          autoFocus
        />
      </Field>
      {value.tipoPessoa === "pj" && (
        <Field label="Nome fantasia" className="sm:col-span-2">
          <input
            className="input"
            disabled={disabled}
            value={value.nomeFantasia}
            onChange={(e) => patch({ nomeFantasia: e.target.value })}
          />
        </Field>
      )}
      <Field
        label={value.tipoPessoa === "pj" ? "CNPJ" : "CPF"}
        hint="Opcional. Cadastro manual — consulta à Receita Federal em breve."
        className="sm:col-span-2"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            className="input flex-1"
            inputMode="numeric"
            disabled={disabled}
            value={value.cnpjCpf}
            onChange={(e) => patch({ cnpjCpf: formatCpfCnpj(e.target.value) })}
            placeholder={value.tipoPessoa === "pj" ? "00.000.000/0000-00" : "000.000.000-00"}
          />
          <button
            type="button"
            className="btn-outline shrink-0 whitespace-nowrap opacity-60"
            disabled
            title="Integração com a Receita Federal ainda não disponível"
          >
            Buscar na Receita (em breve)
          </button>
        </div>
      </Field>

      <SectionTitle>Contato</SectionTitle>

      <Field label="Contato (nome)" className="sm:col-span-2">
        <input
          className="input"
          disabled={disabled}
          value={value.contatoNome}
          onChange={(e) => patch({ contatoNome: e.target.value })}
          placeholder={`Responsável pelo ${entityLabel}`}
        />
      </Field>
      <Field label="Telefone">
        <input
          className="input"
          inputMode="numeric"
          disabled={disabled}
          placeholder={TELEFONE_PLACEHOLDER}
          value={value.telefone}
          onChange={(e) => patch({ telefone: formatTelefone(e.target.value) })}
        />
      </Field>
      <Field label="E-mail">
        <input
          className="input"
          type="email"
          disabled={disabled}
          value={value.email}
          onChange={(e) => patch({ email: e.target.value })}
        />
      </Field>

      {mode === "compact" ? (
        <>
          <button
            type="button"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground sm:col-span-2"
            onClick={() => setEnderecoOpen((o) => !o)}
          >
            {enderecoOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Endereço (opcional)
          </button>
          {enderecoOpen && (
            <div className="sm:col-span-2">
              <EnderecoFields
                disabled={disabled}
                value={{
                  cep: value.cep,
                  logradouro: value.logradouro,
                  numero: value.numero,
                  complemento: value.complemento,
                  bairro: value.bairro,
                  cidade: value.cidade,
                  uf: value.uf,
                }}
                onChange={(addr) => patch(addr)}
              />
            </div>
          )}
        </>
      ) : (
        <>
          <SectionTitle>Endereço</SectionTitle>
          <div className="sm:col-span-2">
            <EnderecoFields
              disabled={disabled}
              value={{
                cep: value.cep,
                logradouro: value.logradouro,
                numero: value.numero,
                complemento: value.complemento,
                bairro: value.bairro,
                cidade: value.cidade,
                uf: value.uf,
              }}
              onChange={(addr) => patch(addr)}
            />
          </div>
        </>
      )}

      {mode === "full" && (
        <>
          <SectionTitle>Observações</SectionTitle>
          <Field label="Observação" className="sm:col-span-2">
            <textarea
              className="input min-h-[72px] resize-y"
              disabled={disabled}
              value={value.observacao}
              onChange={(e) => patch({ observacao: e.target.value })}
              placeholder="Notas internas sobre o cadastro"
            />
          </Field>
        </>
      )}
    </div>
  );
}
