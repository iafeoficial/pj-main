import { useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import type { Endereco } from "@/types/domain";
import { buscarCep } from "@/lib/cep";
import { formatCEP, stripDigits } from "@/lib/masks";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

export const EMPTY_ENDERECO: Endereco = {
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
};

interface EnderecoFieldsProps {
  value: Endereco;
  onChange: (value: Endereco) => void;
  disabled?: boolean;
}

export function EnderecoFields({ value, onChange, disabled }: EnderecoFieldsProps) {
  const { notify } = useToast();
  const [loading, setLoading] = useState(false);
  const lastFetched = useRef("");

  async function fetchCep(cep: string) {
    const digits = stripDigits(cep);
    if (digits.length !== 8 || digits === lastFetched.current) return;
    setLoading(true);
    try {
      const result = await buscarCep(digits);
      lastFetched.current = digits;
      onChange({ ...value, cep: formatCEP(digits), ...result });
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const digits = stripDigits(value.cep);
    if (digits.length === 8) void fetchCep(digits);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-fetch apenas ao completar CEP
  }, [value.cep]);

  function patch(partial: Partial<Endereco>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="CEP">
        <div className="flex gap-2">
          <input
            className="input min-w-0 flex-1"
            inputMode="numeric"
            disabled={disabled}
            value={value.cep}
            placeholder="00000-000"
            onChange={(e) => patch({ cep: formatCEP(e.target.value) })}
          />
          <button
            type="button"
            className="btn-outline shrink-0 px-2.5"
            disabled={disabled || loading || stripDigits(value.cep).length !== 8}
            title="Buscar CEP"
            aria-label="Buscar CEP"
            onClick={() => void fetchCep(value.cep)}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </button>
        </div>
      </Field>
      <Field label="Número">
        <input
          className="input"
          disabled={disabled}
          value={value.numero}
          onChange={(e) => patch({ numero: e.target.value })}
        />
      </Field>
      <Field label="Logradouro" className="sm:col-span-2">
        <input
          className="input"
          disabled={disabled}
          value={value.logradouro}
          onChange={(e) => patch({ logradouro: e.target.value })}
        />
      </Field>
      <Field label="Complemento" className="sm:col-span-2">
        <input
          className="input"
          disabled={disabled}
          value={value.complemento}
          onChange={(e) => patch({ complemento: e.target.value })}
        />
      </Field>
      <Field label="Bairro">
        <input
          className="input"
          disabled={disabled}
          value={value.bairro}
          onChange={(e) => patch({ bairro: e.target.value })}
        />
      </Field>
      <Field label="Cidade">
        <input
          className="input"
          disabled={disabled}
          value={value.cidade}
          onChange={(e) => patch({ cidade: e.target.value })}
        />
      </Field>
      <Field label="UF">
        <Select
          disabled={disabled}
          value={value.uf}
          onChange={(uf) => patch({ uf })}
          options={[
            { value: "", label: "—" },
            ...UFS.map((uf) => ({ value: uf, label: uf })),
          ]}
        />
      </Field>
    </div>
  );
}
