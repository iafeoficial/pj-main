import { STATUS_LABEL } from "@/lib/utils";

const STYLES: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  aberta: "bg-[#F3E6E0] text-[#8A5E52]",
  parcial: "bg-amber-100 text-amber-800",
  paga: "bg-[#E8F4EE] text-success",
  recebida: "bg-[#E8F4EE] text-success",
  vencida: "bg-red-100 text-red-700",
  cancelada: "bg-zinc-200 text-zinc-600 line-through",
  ativa: "bg-[#E8F4EE] text-success",
  inativa: "bg-zinc-200 text-zinc-600",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${STYLES[status] ?? "bg-muted text-muted-foreground"}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
