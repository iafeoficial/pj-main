import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  isValid,
  parse,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  id?: string;
}

function parseIso(iso: string): Date | null {
  if (!iso) return null;
  const d = parse(iso, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : null;
}

function toIso(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function maskData(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseBr(text: string): Date | null {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(text)) return null;
  const d = parse(text, "dd/MM/yyyy", new Date());
  if (!isValid(d) || format(d, "dd/MM/yyyy") !== text) return null;
  return d;
}

export function DatePicker({
  value,
  onChange,
  disabled = false,
  className,
  placeholder = "dd/mm/aaaa",
  id,
}: DatePickerProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const focused = useRef(false);
  const [open, setOpen] = useState(false);
  const selected = parseIso(value);
  const display = selected ? format(selected, "dd/MM/yyyy", { locale: ptBR }) : "";
  const [text, setText] = useState(display);
  const [viewMonth, setViewMonth] = useState<Date>(() => selected ?? new Date());

  useEffect(() => {
    if (!focused.current) setText(display);
  }, [display]);

  useEffect(() => {
    const parsed = parseIso(value);
    if (parsed) setViewMonth(parsed);
  }, [value]);

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

  const selectDate = useCallback(
    (d: Date) => {
      onChange(toIso(d));
      setText(format(d, "dd/MM/yyyy"));
      setViewMonth(d);
      setOpen(false);
    },
    [onChange]
  );

  function commit(raw: string) {
    const masked = maskData(raw);
    if (!masked) {
      setText(display);
      return;
    }
    const parsed = parseBr(masked);
    if (!parsed) {
      setText(display);
      return;
    }
    const iso = toIso(parsed);
    setText(format(parsed, "dd/MM/yyyy"));
    setViewMonth(parsed);
    if (iso !== value) onChange(iso);
  }

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart, { locale: ptBR }),
    end: endOfWeek(monthEnd, { locale: ptBR }),
  });
  const monthLabel = format(viewMonth, "MMMM yyyy", { locale: ptBR });

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div
        className={cn(
          "input flex items-center gap-1 pr-1",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <input
          id={fieldId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={text}
          aria-label={display || placeholder}
          onChange={(e) => setText(maskData(e.target.value))}
          onFocus={() => {
            focused.current = true;
          }}
          onBlur={() => {
            focused.current = false;
            commit(text);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(text);
              setOpen(false);
            } else if (e.key === "Escape") {
              setText(display);
              setOpen(false);
            }
          }}
          className="min-w-0 flex-1 bg-transparent py-1 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Abrir calendário"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((o) => !o)}
          className="btn-ghost h-7 w-7 shrink-0 p-0"
        >
          <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden />
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-label="Calendário"
          className="absolute left-0 top-full z-[60] mt-1 w-[280px] rounded-lg border border-border bg-card p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className="btn-ghost btn-sm h-8 w-8 p-0"
              aria-label="Mês anterior"
              onClick={() => setViewMonth((m) => subMonths(m, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium capitalize">{monthLabel}</span>
            <button
              type="button"
              className="btn-ghost btn-sm h-8 w-8 p-0"
              aria-label="Próximo mês"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="py-1 text-center text-[11px] font-medium text-muted-foreground"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5" role="grid">
            {days.map((day) => {
              const outside = !isSameMonth(day, viewMonth);
              const selectedDay = selected && isSameDay(day, selected);
              const today = isToday(day);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  role="gridcell"
                  aria-selected={selectedDay || undefined}
                  aria-current={today ? "date" : undefined}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectDate(day)}
                  className={cn(
                    "h-8 rounded-md text-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    outside && "text-muted-foreground/40",
                    !outside && !selectedDay && "hover:bg-accent hover:text-accent-foreground",
                    selectedDay && "bg-primary text-primary-foreground hover:bg-primary/90",
                    today && !selectedDay && "font-semibold text-primary"
                  )}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>

          <div className="mt-2 border-t border-border pt-2">
            <button
              type="button"
              className="btn-ghost btn-sm h-7 w-full text-xs"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectDate(new Date())}
            >
              Hoje
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
