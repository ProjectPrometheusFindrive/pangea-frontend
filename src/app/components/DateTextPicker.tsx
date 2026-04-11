import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from './ui/calendar';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toDateInputValue } from '../utils/dateInputValue';

interface DateTextPickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  inputTestId?: string;
  ariaLabel?: string;
  className?: string;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDateToYmd(value: Date): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function parseDateFromText(value: string): Date | undefined {
  const normalized = toDateInputValue(value);
  if (!normalized) {
    return undefined;
  }
  const parts = normalized.split('-');
  if (parts.length !== 3) {
    return undefined;
  }
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return undefined;
  }
  const candidate = new Date(year, month - 1, day);
  if (
    candidate.getFullYear() !== year
    || candidate.getMonth() !== month - 1
    || candidate.getDate() !== day
  ) {
    return undefined;
  }
  return candidate;
}

function normalizeDateDraft(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (/^\d{8}$/.test(trimmed)) {
    const digitsAsYmd = `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
    const normalizedFromDigits = toDateInputValue(digitsAsYmd);
    return normalizedFromDigits || trimmed;
  }

  const normalized = toDateInputValue(trimmed);
  return normalized || trimmed;
}

function toDisplayValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  if (/^\d{4}-\d{1,2}(-\d{1,2})?$/.test(trimmed)) {
    return trimmed;
  }
  return toDateInputValue(trimmed) || trimmed;
}

export function DateTextPicker({
  value,
  onChange,
  disabled = false,
  placeholder = 'YYYY-MM-DD',
  inputTestId,
  ariaLabel,
  className,
}: DateTextPickerProps) {
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedDate = useMemo(() => parseDateFromText(value), [value]);
  const displayValue = isEditing ? value : toDisplayValue(value);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const targetNode = event.target as Node | null;
      if (targetNode && rootRef.current?.contains(targetNode)) {
        return;
      }
      setOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={className ?? 'relative flex items-center gap-2'}>
      <Input
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={displayValue}
        onFocus={() => setIsEditing(true)}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => {
          const nextFocusedTarget = event.relatedTarget as Node | null;
          if (nextFocusedTarget && rootRef.current?.contains(nextFocusedTarget)) {
            return;
          }
          setIsEditing(false);
          onChange(normalizeDateDraft(value));
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            onChange(normalizeDateDraft(value));
          }
        }}
        disabled={disabled}
        aria-label={ariaLabel}
        data-testid={inputTestId}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={disabled}
        onClick={() => {
          if (disabled) {
            return;
          }
          setOpen((previousOpen) => !previousOpen);
        }}
        aria-label={`${ariaLabel ?? '날짜'} 캘린더 열기`}
      >
        <CalendarIcon className="h-4 w-4" />
      </Button>
      {open && !disabled && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-[120] w-auto rounded-md border bg-popover p-0 shadow-md">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(nextDate) => {
              if (!nextDate) {
                return;
              }
              onChange(formatDateToYmd(nextDate));
              setOpen(false);
            }}
            initialFocus
          />
        </div>
      )}
    </div>
  );
}
