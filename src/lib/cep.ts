import { stripDigits } from "@/lib/masks";

export interface CepResult {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
}

interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
}

/** Busca endereço pelo CEP via ViaCEP (API pública, sem dependência npm). */
export async function buscarCep(cep: string): Promise<CepResult> {
  const digits = stripDigits(cep);
  if (digits.length !== 8) {
    throw new Error("CEP inválido. Informe 8 dígitos.");
  }

  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!res.ok) {
    throw new Error("Não foi possível consultar o CEP. Tente novamente.");
  }

  const data = (await res.json()) as ViaCepResponse;
  if (data.erro) {
    throw new Error("CEP não encontrado.");
  }

  return {
    logradouro: data.logradouro ?? "",
    bairro: data.bairro ?? "",
    cidade: data.localidade ?? "",
    uf: data.uf ?? "",
  };
}
