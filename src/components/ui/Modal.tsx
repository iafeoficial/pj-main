import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
  zIndex?: number;
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  width = "max-w-lg",
  zIndex = 50,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-start justify-center overflow-y-auto bg-black/40 p-3 py-4 sm:items-center sm:p-4 sm:py-6"
      style={{ zIndex }}
      onClick={onClose}
    >
      <div
        className={`card flex w-full ${width} max-h-[min(92vh,900px)] flex-col animate-in`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5 sm:px-5 sm:py-3">
          <h2 className="text-sm font-semibold sm:text-base">{title}</h2>
          <button
            className="btn-ghost btn-sm -mr-2"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-3 text-sm sm:px-5 sm:py-4">
          {children}
        </div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-2.5 sm:px-5 sm:py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
