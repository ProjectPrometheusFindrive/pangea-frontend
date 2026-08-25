import { apiClient } from './api';

export type RevenueGranularity = 'day' | 'week' | 'month';
export type RevenueRentalType = 'short_term' | 'long_term' | 'accident_replacement';
export type RevenuePayerType = 'customer' | 'insurer' | 'corporate' | 'repair_shop';

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
  unpaidAmount: number;
  unpaidCount: number;
  activeVehicleCount: number;
  utilizationRate: number;
  currency: string;
}

export interface RevenueSummaryBucket {
  label: string;
  startDate: string;
  endDate: string;
  grossRevenue: number;
  refundAmount: number;
  netRevenue: number;
  unpaidAmount: number;
  paidCount: number;
  refundCount: number;
  unpaidCount: number;
}

export interface RevenueSummaryResponse {
  period: RevenuePeriod;
  totals: RevenueTotals;
  buckets: RevenueSummaryBucket[];
  paymentMethods: RevenuePaymentMethod[];
  rentalTypes: RevenueRentalTypeBreakdown[];
  payerTypes: RevenuePayerTypeBreakdown[];
  vehicles: RevenueVehicle[];
}

export interface RevenuePaymentMethod {
  method: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface RevenueRentalTypeBreakdown {
  rentalType: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface RevenuePayerTypeBreakdown {
  payerType: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface RevenueVehicle {
  rank: number;
  vehicleId: string;
  vehicleNumber: string;
  model: string;
  revenue: number;
  reservationCount: number;
  utilizationRate: number;
  shareRate: number;
}

export interface RevenueTrendItem {
  date: string;
  grossRevenue: number;
  refundAmount: number;
  netRevenue: number;
  unpaidAmount: number;
  paidCount: number;
  refundCount: number;
  unpaidCount: number;
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
  companyId?: string;
  rentalType?: RevenueRentalType;
  payerType?: RevenuePayerType;
}

export interface RevenueTrendRequestParams extends RevenueRequestOptions {
  from: string;
  to: string;
  companyId?: string;
  rentalType?: RevenueRentalType;
  payerType?: RevenuePayerType;
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
      unpaidAmount: 0,
      unpaidCount: 0,
      activeVehicleCount: 0,
      utilizationRate: 0,
      currency: 'KRW',
    };
  }

  return {
    grossRevenue: toNumber(value.grossRevenue),
    refundAmount: toNumber(value.refundAmount),
    netRevenue: toNumber(value.netRevenue),
    paidCount: toInteger(value.paidCount),
    refundCount: toInteger(value.refundCount),
    unpaidAmount: toNumber(value.unpaidAmount),
    unpaidCount: toInteger(value.unpaidCount),
    activeVehicleCount: toInteger(value.activeVehicleCount),
    utilizationRate: Math.max(0, Math.min(1, toNumber(value.utilizationRate))),
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
      unpaidAmount: 0,
      paidCount: 0,
      refundCount: 0,
      unpaidCount: 0,
    };
  }

  return {
    label: toText(value.label),
    startDate: toText(value.startDate),
    endDate: toText(value.endDate),
    grossRevenue: toNumber(value.grossRevenue),
    refundAmount: toNumber(value.refundAmount),
    netRevenue: toNumber(value.netRevenue),
    unpaidAmount: toNumber(value.unpaidAmount),
    paidCount: toInteger(value.paidCount),
    refundCount: toInteger(value.refundCount),
    unpaidCount: toInteger(value.unpaidCount),
  };
}

function normalizePaymentMethod(value: unknown): RevenuePaymentMethod {
  if (!isRecord(value)) {
    return {
      method: '미지정',
      amount: 0,
      count: 0,
      percentage: 0,
    };
  }

  return {
    method: toText(value.method, '미지정') || '미지정',
    amount: toNumber(value.amount),
    count: toInteger(value.count),
    percentage: Math.max(0, toNumber(value.percentage)),
  };
}

function normalizeRentalTypeBreakdown(value: unknown): RevenueRentalTypeBreakdown {
  const data = isRecord(value) ? value : {};
  return {
    rentalType: String(data.rentalType ?? 'short_term'),
    amount: toNumber(data.amount),
    count: toInteger(data.count),
    percentage: toNumber(data.percentage),
  };
}

function normalizePayerTypeBreakdown(value: unknown): RevenuePayerTypeBreakdown {
  const data = isRecord(value) ? value : {};
  return {
    payerType: String(data.payerType ?? 'customer'),
    amount: toNumber(data.amount),
    count: toInteger(data.count),
    percentage: toNumber(data.percentage),
  };
}

function normalizeRevenueVehicle(value: unknown): RevenueVehicle {
  if (!isRecord(value)) {
    return {
      rank: 0,
      vehicleId: '',
      vehicleNumber: '',
      model: '차종 미확인',
      revenue: 0,
      reservationCount: 0,
      utilizationRate: 0,
      shareRate: 0,
    };
  }

  return {
    rank: toInteger(value.rank),
    vehicleId: toText(value.vehicleId),
    vehicleNumber: toText(value.vehicleNumber),
    model: toText(value.model, '차종 미확인') || '차종 미확인',
    revenue: toNumber(value.revenue),
    reservationCount: toInteger(value.reservationCount),
    utilizationRate: Math.max(0, Math.min(1, toNumber(value.utilizationRate))),
    shareRate: Math.max(0, toNumber(value.shareRate)),
  };
}

function normalizeTrendItem(value: unknown): RevenueTrendItem {
  if (!isRecord(value)) {
    return {
      date: '',
      grossRevenue: 0,
      refundAmount: 0,
      netRevenue: 0,
      unpaidAmount: 0,
      paidCount: 0,
      refundCount: 0,
      unpaidCount: 0,
    };
  }

  return {
    date: toText(value.date),
    grossRevenue: toNumber(value.grossRevenue),
    refundAmount: toNumber(value.refundAmount),
    netRevenue: toNumber(value.netRevenue),
    unpaidAmount: toNumber(value.unpaidAmount),
    paidCount: toInteger(value.paidCount),
    refundCount: toInteger(value.refundCount),
    unpaidCount: toInteger(value.unpaidCount),
  };
}

function normalizeRevenueSummary(
  payload: unknown,
  defaults: { from: string; to: string; granularity: RevenueGranularity },
): RevenueSummaryResponse {
  const data = isRecord(payload) ? payload : {};
  const bucketsRaw = Array.isArray(data.buckets) ? data.buckets : [];
  const paymentMethodsRaw = Array.isArray(data.paymentMethods) ? data.paymentMethods : [];
  const rentalTypesRaw = Array.isArray(data.rentalTypes) ? data.rentalTypes : [];
  const payerTypesRaw = Array.isArray(data.payerTypes) ? data.payerTypes : [];
  const vehiclesRaw = Array.isArray(data.vehicles) ? data.vehicles : [];

  return {
    period: normalizePeriod(data.period, defaults),
    totals: normalizeTotals(data.totals),
    buckets: bucketsRaw.map(normalizeSummaryBucket),
    paymentMethods: paymentMethodsRaw.map(normalizePaymentMethod),
    rentalTypes: rentalTypesRaw.map(normalizeRentalTypeBreakdown),
    payerTypes: payerTypesRaw.map(normalizePayerTypeBreakdown),
    vehicles: vehiclesRaw.map(normalizeRevenueVehicle),
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
  companyId,
  rentalType,
  payerType,
  signal,
}: RevenueSummaryRequestParams): Promise<RevenueSummaryResponse> {
  const payload = await apiClient.requestData<unknown>({
    path: '/api/v2/revenue/summary',
    method: 'GET',
    query: {
      from,
      to,
      granularity,
      companyId,
      rentalType,
      payerType,
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
  companyId,
  rentalType,
  payerType,
  signal,
}: RevenueTrendRequestParams): Promise<RevenueTrendResponse> {
  const payload = await apiClient.requestData<unknown>({
    path: '/api/v2/revenue/trend',
    method: 'GET',
    query: {
      from,
      to,
      companyId,
      rentalType,
      payerType,
    },
    signal,
  });

  return normalizeRevenueTrend(payload, {
    from,
    to,
  });
}
