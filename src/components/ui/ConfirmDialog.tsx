import type { ReactNode } from "react";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  destructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button className="btn-outline" onClick={onCancel}>
            Cancelar
          </button>
          <button
            className={destructive ? "btn-destructive" : "btn-primary"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {typeof message === "string" ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : (
        <div className="text-sm text-muted-foreground">{message}</div>
      )}
    </Modal>
  );
}
