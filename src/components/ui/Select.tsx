import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "Selecione…",
  disabled = false,
  className,
  id,
}: SelectProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const listboxId = `${fieldId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const display = selected?.label ?? placeholder;
  const showPlaceholder = !selected;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setHighlight(selectedIndex >= 0 ? selectedIndex : 0);
    }
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-index="${highlight}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [open, highlight]);

  const selectOption = useCallback(
    (opt: SelectOption) => {
      onChange(opt.value);
      setOpen(false);
    },
    [onChange]
  );

  const moveHighlight = (delta: number) => {
    if (options.length === 0) return;
    setHighlight((i) => (i + delta + options.length) % options.length);
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === "Enter") {
      e.preventDefault();
      if (open) {
        const opt = options[highlight];
        if (opt) selectOption(opt);
      } else {
        setOpen(true);
      }
    } else if (e.key === " ") {
      e.preventDefault();
      setOpen((o) => !o);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
      } else {
        moveHighlight(1);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
      } else {
        moveHighlight(-1);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveHighlight(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveHighlight(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = options[highlight];
      if (opt) selectOption(opt);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Home") {
      e.preventDefault();
      setHighlight(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setHighlight(options.length - 1);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        id={fieldId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          "input flex w-full items-center justify-between gap-2 text-left",
          showPlaceholder && "text-muted-foreground"
        )}
      >
        <span className="truncate">{display}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {open && options.length > 0 && (
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-labelledby={fieldId}
          tabIndex={-1}
          onKeyDown={handleListKeyDown}
          className="absolute left-0 top-full z-[60] mt-1 max-h-60 w-full min-w-[8rem] overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg focus:outline-none"
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            const isHighlighted = i === highlight;

            return (
              <button
                key={opt.value === "" ? "__empty__" : opt.value}
                type="button"
                role="option"
                data-index={i}
                aria-selected={isSelected}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => selectOption(opt)}
                className={cn(
                  "flex w-full rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isHighlighted && !isSelected && "bg-accent text-accent-foreground",
                  isSelected && "bg-primary text-primary-foreground",
                  !isHighlighted && !isSelected && "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
