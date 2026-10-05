import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

type MenuPos = { top: number; left: number; width: number; maxHeight: number };

function measureMenuPos(el: HTMLElement): MenuPos {
  const r = el.getBoundingClientRect();
  const gap = 4;
  const spaceBelow = window.innerHeight - r.bottom - gap;
  const spaceAbove = r.top - gap;
  const preferUp = spaceBelow < 200 && spaceAbove > spaceBelow;
  const maxHeight = Math.min(240, Math.max(120, preferUp ? spaceAbove : spaceBelow));
  return {
    top: preferUp ? Math.max(8, r.top - gap - maxHeight) : r.bottom + gap,
    left: Math.max(8, Math.min(r.left, window.innerWidth - r.width - 8)),
    width: r.width,
    maxHeight,
  };
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
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const display = selected?.label ?? placeholder;
  const showPlaceholder = !selected;

  const openMenu = useCallback(() => {
    if (disabled) return;
    const el = rootRef.current;
    if (el) setMenuPos(measureMenuPos(el));
    setHighlight(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }, [disabled, selectedIndex]);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setMenuPos(null);
  }, []);

  const updateMenuPos = useCallback(() => {
    const el = rootRef.current;
    if (!el || !open) return;
    setMenuPos(measureMenuPos(el));
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPos();
    window.addEventListener("resize", updateMenuPos);
    window.addEventListener("scroll", updateMenuPos, true);
    return () => {
      window.removeEventListener("resize", updateMenuPos);
      window.removeEventListener("scroll", updateMenuPos, true);
    };
  }, [open, updateMenuPos, options.length]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || listRef.current?.contains(t)) return;
      closeMenu();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, closeMenu]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-index="${highlight}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [open, highlight]);

  const selectOption = useCallback(
    (opt: SelectOption) => {
      onChange(opt.value);
      closeMenu();
    },
    [onChange, closeMenu]
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
        openMenu();
      }
    } else if (e.key === " ") {
      e.preventDefault();
      if (open) closeMenu();
      else openMenu();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) openMenu();
      else moveHighlight(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) openMenu();
      else moveHighlight(-1);
    } else if (e.key === "Escape") {
      closeMenu();
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
      closeMenu();
    } else if (e.key === "Home") {
      e.preventDefault();
      setHighlight(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setHighlight(options.length - 1);
    }
  };

  const listbox =
    open && options.length > 0 && menuPos
      ? createPortal(
          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-labelledby={fieldId}
            tabIndex={-1}
            onKeyDown={handleListKeyDown}
            style={{
              position: "fixed",
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              maxHeight: menuPos.maxHeight,
              zIndex: 200,
            }}
            className="overflow-y-auto rounded-lg border border-border bg-card p-1 text-sm shadow-lg focus:outline-none"
          >
            {options.map((opt, i) => {
              const isSelected = opt.value === value;
              const isHighlighted = i === highlight;

              return (
                <button
                  key={opt.value === "" ? `__empty_${i}` : `${opt.value}_${i}`}
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
                    !isHighlighted &&
                      !isSelected &&
                      "hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        id={fieldId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => {
          if (disabled) return;
          if (open) closeMenu();
          else openMenu();
        }}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          "input flex h-9 w-full items-center justify-between gap-2 text-left",
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
      {listbox}
    </div>
  );
}
