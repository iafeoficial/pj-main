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

export function DatePicker({
  value,
  onChange,
  disabled = false,
  className,
  placeholder = "Selecione a data",
  id,
}: DatePickerProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = parseIso(value);
  const [viewMonth, setViewMonth] = useState<Date>(() => selected ?? new Date());

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
      setViewMonth(d);
      setOpen(false);
    },
    [onChange]
  );

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart, { locale: ptBR }),
    end: endOfWeek(monthEnd, { locale: ptBR }),
  });

  const display = selected ? format(selected, "dd/MM/yyyy", { locale: ptBR }) : "";
  const monthLabel = format(viewMonth, "MMMM yyyy", { locale: ptBR });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((o) => !o);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        id={fieldId}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={display || placeholder}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
        className={cn(
          "input flex items-center justify-between gap-2 text-left",
          !display && "text-muted-foreground"
        )}
      >
        <span className="truncate">{display || placeholder}</span>
        <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

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
