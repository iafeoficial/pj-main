// Auditoria — princípio 5 do master: "Toda ação relevante gera auditoria".
import type { AuditAction, AuditLog } from "@/types/domain";
import { OwnedTable } from "./db";

const table = new OwnedTable<AuditLog>("audit_logs");

let currentUserEmail = "sistema";
export function setCurrentUser(email: string | null) {
  currentUserEmail = email || "sistema";
}
export function getCurrentUser(): string {
  return currentUserEmail;
}

export async function logAudit(params: {
  empresaId: string;
  entidade: string;
  entidadeId: string | null;
  acao: AuditAction;
  descricao: string;
}): Promise<void> {
  try {
    await table.create(params.empresaId, {
      entidade: params.entidade,
      entidadeId: params.entidadeId,
      acao: params.acao,
      descricao: params.descricao,
      usuario: currentUserEmail,
    } as Omit<AuditLog, "id" | "createdAt" | "updatedAt" | "empresaId">);
  } catch (err) {
    // Auditoria nunca deve quebrar o fluxo principal.
    console.error("[audit] falha ao registrar log:", err);
  }
}

export async function listAudit(empresaId: string): Promise<AuditLog[]> {
  const logs = await table.list(empresaId, { column: "created_at", ascending: false });
  return logs;
}
