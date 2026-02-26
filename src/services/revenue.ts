import { apiClient } from './api';

export type RevenueGranularity = 'day' | 'week' | 'month';

export interface RevenuePeriod {
  from: string;
  to: string;
  granularity: RevenueGranularity;
  timezone: string;
}

export interface RevenueTotals {
  grossRevenue: number;
  refundAmount: number;
  netRevenue: number;
  paidCount: number;
  refundCount: number;
  currency: string;
}

export interface RevenueSummaryBucket {
  label: string;
  startDate: string;
  endDate: string;
  grossRevenue: number;
  refundAmount: number;
  netRevenue: number;
  paidCount: number;
  refundCount: number;
}

export interface RevenueSummaryResponse {
  period: RevenuePeriod;
  totals: RevenueTotals;
  buckets: RevenueSummaryBucket[];
}

export interface RevenueTrendItem {
  date: string;
  grossRevenue: number;
  refundAmount: number;
  netRevenue: number;
  paidCount: number;
  refundCount: number;
}

export interface RevenueTrendResponse {
  period: RevenuePeriod;
  totals: RevenueTotals & {
    points: number;
  };
  items: RevenueTrendItem[];
}

export interface RevenueRequestOptions {
  signal?: AbortSignal;
}

export interface RevenueSummaryRequestParams extends RevenueRequestOptions {
  from: string;
  to: string;
  granularity: RevenueGranularity;
}

export interface RevenueTrendRequestParams extends RevenueRequestOptions {
  from: string;
  to: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsedValue = Number(value);
    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }
  return 0;
}

function toInteger(value: unknown): number {
  return Math.max(0, Math.trunc(toNumber(value)));
}

function toText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return fallback;
}

function toGranularity(value: unknown, fallback: RevenueGranularity): RevenueGranularity {
  if (value === 'day' || value === 'week' || value === 'month') {
    return value;
  }
  return fallback;
}

function normalizePeriod(
  value: unknown,
  defaults: { from: string; to: string; granularity: RevenueGranularity },
): RevenuePeriod {
  if (!isRecord(value)) {
    return {
      from: defaults.from,
      to: defaults.to,
      granularity: defaults.granularity,
      timezone: 'Asia/Seoul',
    };
  }

  return {
    from: toText(value.from, defaults.from),
    to: toText(value.to, defaults.to),
    granularity: toGranularity(value.granularity, defaults.granularity),
    timezone: toText(value.timezone, 'Asia/Seoul'),
  };
}

function normalizeTotals(value: unknown): RevenueTotals {
  if (!isRecord(value)) {
    return {
      grossRevenue: 0,
      refundAmount: 0,
      netRevenue: 0,
      paidCount: 0,
      refundCount: 0,
      currency: 'KRW',
    };
  }

  return {
    grossRevenue: toNumber(value.grossRevenue),
    refundAmount: toNumber(value.refundAmount),
    netRevenue: toNumber(value.netRevenue),
    paidCount: toInteger(value.paidCount),
    refundCount: toInteger(value.refundCount),
    currency: toText(value.currency, 'KRW'),
  };
}

function normalizeSummaryBucket(value: unknown): RevenueSummaryBucket {
  if (!isRecord(value)) {
    return {
      label: '',
      startDate: '',
      endDate: '',
      grossRevenue: 0,
      refundAmount: 0,
      netRevenue: 0,
      paidCount: 0,
      refundCount: 0,
    };
  }

  return {
    label: toText(value.label),
    startDate: toText(value.startDate),
    endDate: toText(value.endDate),
    grossRevenue: toNumber(value.grossRevenue),
    refundAmount: toNumber(value.refundAmount),
    netRevenue: toNumber(value.netRevenue),
    paidCount: toInteger(value.paidCount),
    refundCount: toInteger(value.refundCount),
  };
}

function normalizeTrendItem(value: unknown): RevenueTrendItem {
  if (!isRecord(value)) {
    return {
      date: '',
      grossRevenue: 0,
      refundAmount: 0,
      netRevenue: 0,
      paidCount: 0,
      refundCount: 0,
    };
  }

  return {
    date: toText(value.date),
    grossRevenue: toNumber(value.grossRevenue),
    refundAmount: toNumber(value.refundAmount),
    netRevenue: toNumber(value.netRevenue),
    paidCount: toInteger(value.paidCount),
    refundCount: toInteger(value.refundCount),
  };
}

function normalizeRevenueSummary(
  payload: unknown,
  defaults: { from: string; to: string; granularity: RevenueGranularity },
): RevenueSummaryResponse {
  const data = isRecord(payload) ? payload : {};
  const bucketsRaw = Array.isArray(data.buckets) ? data.buckets : [];

  return {
    period: normalizePeriod(data.period, defaults),
    totals: normalizeTotals(data.totals),
    buckets: bucketsRaw.map(normalizeSummaryBucket),
  };
}

function normalizeRevenueTrend(
  payload: unknown,
  defaults: { from: string; to: string },
): RevenueTrendResponse {
  const data = isRecord(payload) ? payload : {};
  const itemsRaw = Array.isArray(data.items) ? data.items : [];
  const totals = normalizeTotals(data.totals);

  return {
    period: normalizePeriod(data.period, {
      from: defaults.from,
      to: defaults.to,
      granularity: 'day',
    }),
    totals: {
      ...totals,
      points: toInteger(isRecord(data.totals) ? data.totals.points : undefined),
    },
    items: itemsRaw.map(normalizeTrendItem),
  };
}

export async function getRevenueSummary({
  from,
  to,
  granularity,
  signal,
}: RevenueSummaryRequestParams): Promise<RevenueSummaryResponse> {
  const payload = await apiClient.requestData<unknown>({
    path: '/api/v2/revenue/summary',
    method: 'GET',
    query: {
      from,
      to,
      granularity,
    },
    signal,
  });

  return normalizeRevenueSummary(payload, {
    from,
    to,
    granularity,
  });
}

export async function getRevenueTrend({
  from,
  to,
  signal,
}: RevenueTrendRequestParams): Promise<RevenueTrendResponse> {
  const payload = await apiClient.requestData<unknown>({
    path: '/api/v2/revenue/trend',
    method: 'GET',
    query: {
      from,
      to,
    },
    signal,
  });

  return normalizeRevenueTrend(payload, {
    from,
    to,
  });
}
