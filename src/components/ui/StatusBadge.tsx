import { STATUS_LABEL } from "@/lib/utils";

const STYLES: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  aberta: "bg-blue-100 text-blue-700",
  parcial: "bg-amber-100 text-amber-700",
  paga: "bg-emerald-100 text-emerald-700",
  recebida: "bg-emerald-100 text-emerald-700",
  vencida: "bg-red-100 text-red-700",
  cancelada: "bg-zinc-200 text-zinc-600 line-through",
  ativa: "bg-emerald-100 text-emerald-700",
  inativa: "bg-zinc-200 text-zinc-600",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${STYLES[status] ?? "bg-muted text-muted-foreground"}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
