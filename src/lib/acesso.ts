import type { Empresa } from "@/types/domain";

/** E-mail de admin da plataforma IAFÉ (painel /admin-plataforma). */
export function isPlataformaAdminEmail(email: string | null | undefined): boolean {
  return !!email && /@iafeoficial\.com$/i.test(email.trim());
}

/** Empresa liberada para uso (não bloqueada e dentro do prazo, se houver). */
export function empresaAcessoOk(empresa: Pick<Empresa, "acessoBloqueado" | "acessoFim"> | null | undefined): boolean {
  if (!empresa) return false;
  if (empresa.acessoBloqueado) return false;
  if (empresa.acessoFim) {
    const fim = new Date(empresa.acessoFim).getTime();
    if (Number.isFinite(fim) && Date.now() > fim) return false;
  }
  return true;
}

export function empresaAcessoMotivo(
  empresa: Pick<Empresa, "acessoBloqueado" | "acessoFim" | "acessoMotivo"> | null | undefined
): string {
  if (!empresa) return "Nenhuma empresa selecionada.";
  if (empresa.acessoBloqueado) {
    return empresa.acessoMotivo?.trim() || "O acesso desta empresa foi bloqueado.";
  }
  if (empresa.acessoFim && Date.now() > new Date(empresa.acessoFim).getTime()) {
    return (
      empresa.acessoMotivo?.trim() ||
      "O período de uso desta empresa encerrou. Fale com o suporte IAFÉ para renovar."
    );
  }
  return "";
}
