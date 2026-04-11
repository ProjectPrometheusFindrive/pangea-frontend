function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toValidatedYmd(yearText: string, monthText: string, dayText: string): string {
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return '';
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return '';
  }
  const candidate = new Date(year, month - 1, day);
  if (
    candidate.getFullYear() !== year
    || candidate.getMonth() !== month - 1
    || candidate.getDate() !== day
  ) {
    return '';
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function toDateInputValue(value: string | null | undefined): string {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '-') {
    return '';
  }

  const isoPrefix = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoPrefix) {
    return toValidatedYmd(isoPrefix[1], isoPrefix[2], isoPrefix[3]);
  }

  const normalizedPrefix = raw.match(/^(\d{4})[./\s년-](\d{1,2})[./\s월-](\d{1,2})/);
  if (normalizedPrefix) {
    return toValidatedYmd(normalizedPrefix[1], normalizedPrefix[2], normalizedPrefix[3]);
  }
  return '';
}
