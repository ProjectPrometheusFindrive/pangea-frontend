const KST_TIMEZONE = 'Asia/Seoul';

const KST_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: KST_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const KST_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: KST_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function toValidDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) {
      return null;
    }
    // Preserve legacy wall-clock fields independently of the browser timezone.
    // Their original timezone is unverified; new API instants must carry an offset.
    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
    const parsed = new Date(hasTimezone || /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : `${normalized}+09:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function getRawStringOrFallback(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized || fallback;
  }
  return fallback;
}

function getPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  const part = parts.find((entry) => entry.type === type);
  return part?.value ?? '';
}

export function formatDateKst(value: unknown, fallback = '-'): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  const parsed = toValidDate(value);
  if (!parsed) {
    return getRawStringOrFallback(value, fallback);
  }

  const parts = KST_DATE_FORMATTER.formatToParts(parsed);
  const year = getPart(parts, 'year');
  const month = getPart(parts, 'month');
  const day = getPart(parts, 'day');
  return `${year}-${month}-${day}`;
}

export function todayDateKst(now = new Date()): string {
  return formatDateKst(now, '');
}

export function formatDateTimeKst(value: unknown, fallback = '-'): string {
  const parsed = toValidDate(value);
  if (!parsed) {
    return getRawStringOrFallback(value, fallback);
  }

  const parts = KST_DATE_TIME_FORMATTER.formatToParts(parsed);
  const year = getPart(parts, 'year');
  const month = getPart(parts, 'month');
  const day = getPart(parts, 'day');
  const hour = getPart(parts, 'hour');
  const minute = getPart(parts, 'minute');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}
