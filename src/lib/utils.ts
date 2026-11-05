import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combina classes Tailwind resolvendo conflitos. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Arredonda para centavos e trata -0 / poeira de float como 0. */
export function roundBRL(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const r = Math.round(value * 100) / 100;
  return r === 0 ? 0 : r;
}

/** Formata um número como moeda BRL. */
export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(roundBRL(value));
}

/** Formata data ISO (yyyy-MM-dd ou completa) para dd/MM/yyyy. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

/** Retorna a data de hoje em formato yyyy-MM-dd. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Gera um ID único (uuid quando disponível, com fallback). */
export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Normaliza CNPJ (numérico ou alfanumérico): maiúsculas, só A–Z e 0–9.
 * IN RFB 2.229/2024 — 12 primeiras posições alfanuméricas + 2 DVs numéricos.
 */
export function normalizeCNPJ(value: string): string {
  return (value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14);
}

/** Máscara de CNPJ: XX.XXX.XXX/XXXX-XX (aceita letras nas 12 primeiras posições). */
export function formatCNPJ(value: string): string {
  const c = normalizeCNPJ(value);
  return c
    .replace(/^([A-Z0-9]{2})([A-Z0-9])/, "$1.$2")
    .replace(/^([A-Z0-9]{2})\.([A-Z0-9]{3})([A-Z0-9])/, "$1.$2.$3")
    .replace(/\.([A-Z0-9]{3})([A-Z0-9])/, ".$1/$2")
    .replace(/([A-Z0-9]{4})([A-Z0-9])/, "$1-$2");
}

const CNPJ_PESO1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_PESO2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function cnpjDigito(base: string, pesos: number[]): number {
  let soma = 0;
  for (let i = 0; i < base.length; i++) {
    soma += (base.charCodeAt(i) - 48) * pesos[i];
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** Valida CNPJ numérico clássico e alfanumérico (módulo 11, ASCII−48). */
export function isValidCNPJ(value: string): boolean {
  const c = normalizeCNPJ(value);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(c)) return false;
  if (/^0{12}/.test(c)) return false;
  const d1 = cnpjDigito(c.slice(0, 12), CNPJ_PESO1);
  const d2 = cnpjDigito(c.slice(0, 12) + String(d1), CNPJ_PESO2);
  return c.slice(12) === `${d1}${d2}`;
}

/** Validação de CPF (11 dígitos + DVs). */
export function isValidCPF(value: string): boolean {
  const c = value.replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const calc = (len: number): number => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(c[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(c[9]) && calc(10) === Number(c[10]);
}

/** Primeiro e último dia (yyyy-MM-dd) do mês de uma data de referência. */
export function monthRange(ref = new Date()): { start: string; end: string } {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

/** Rótulos legíveis de status. */
export const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  aberta: "Em aberto",
  parcial: "Parcial",
  paga: "Paga",
  recebida: "Recebida",
  vencida: "Vencida",
  cancelada: "Cancelada",
  ativa: "Ativa",
  inativa: "Inativa",
};
