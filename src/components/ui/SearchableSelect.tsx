import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SelectOption } from "@/components/ui/Select";

export interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  /** Se true, o texto digitado pode ser confirmado mesmo sem match na lista. */
  allowFreeText?: boolean;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Buscar…",
  searchPlaceholder = "Digite para filtrar…",
  disabled = false,
  className,
  id,
  allowFreeText = false,
}: SearchableSelectProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const listboxId = `${fieldId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const selected = options.find((o) => o.value === value);
  const displayValue = open
    ? query
    : selected?.label ?? (allowFreeText ? value : "") ?? "";

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return options;
    return options.filter(
      (o) => normalize(o.label).includes(q) || normalize(o.value).includes(q)
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (allowFreeText && query.trim() && !options.some((o) => o.value === value)) {
          onChange(query.trim());
        }
        setQuery("");
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, allowFreeText, query, options, value, onChange]);

  useEffect(() => {
    if (!open) return;
    setHighlight(0);
    // Com texto livre sem match, mantém o valor atual no campo para editar/filtrar.
    const hasMatch = options.some((o) => o.value === value);
    setQuery(allowFreeText && !hasMatch && value ? value : "");
    requestAnimationFrame(() => inputRef.current?.focus());
    // Só reage à abertura do dropdown (não a cada mudança de value).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open gate
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-index="${highlight}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [open, highlight]);

  const selectOption = useCallback(
    (opt: SelectOption) => {
      onChange(opt.value);
      setOpen(false);
      setQuery("");
    },
    [onChange]
  );

  const commitFreeText = () => {
    if (!allowFreeText) return;
    const text = query.trim();
    if (!text) return;
    const match = options.find(
      (o) => normalize(o.label) === normalize(text) || normalize(o.value) === normalize(text)
    );
    onChange(match ? match.value : text);
    setOpen(false);
    setQuery("");
  };

  const moveHighlight = (delta: number) => {
    if (filtered.length === 0) return;
    setHighlight((i) => (i + delta + filtered.length) % filtered.length);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else moveHighlight(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) setOpen(true);
      else moveHighlight(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && filtered[highlight]) {
        selectOption(filtered[highlight]);
      } else if (allowFreeText) {
        commitFreeText();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery("");
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div
        className={cn(
          "input flex h-9 w-full items-center gap-2 px-2.5",
          disabled && "opacity-50"
        )}
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          ref={inputRef}
          id={fieldId}
          type="text"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder={open ? searchPlaceholder : placeholder}
          value={displayValue}
          onFocus={() => !disabled && setOpen(true)}
          onClick={() => !disabled && setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label="Abrir lista"
          onClick={() => !disabled && setOpen((o) => !o)}
          className="shrink-0 text-muted-foreground"
        >
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
      </div>

      {open && (
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-labelledby={fieldId}
          className="absolute left-0 top-full z-[60] mt-1 max-h-48 w-full min-w-[8rem] overflow-y-auto rounded-lg border border-border bg-card p-1 text-sm shadow-lg sm:max-h-60"
        >
          {filtered.length === 0 ? (
            <p className="px-2.5 py-2 text-xs text-muted-foreground">
              {allowFreeText
                ? "Nenhum cadastro. Enter para usar o texto digitado."
                : "Nenhum resultado."}
            </p>
          ) : (
            filtered.map((opt, i) => {
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
                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
