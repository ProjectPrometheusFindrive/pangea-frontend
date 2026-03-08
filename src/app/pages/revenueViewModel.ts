import type { RevenueSummaryResponse, RevenueTrendResponse } from '../../services/revenue';

const EMPTY_TOTALS = {
  grossRevenue: 0,
  refundAmount: 0,
  netRevenue: 0,
  paidCount: 0,
  refundCount: 0,
  currency: 'KRW',
};

export function isRevenueSummaryEmpty(summary: RevenueSummaryResponse): boolean {
  return !summary.buckets.some((bucket) => (
    bucket.grossRevenue !== 0
    || bucket.refundAmount !== 0
    || bucket.netRevenue !== 0
    || bucket.paidCount > 0
    || bucket.refundCount > 0
  ));
}

export function createEmptyRevenueTrend(
  period: { from: string; to: string },
): RevenueTrendResponse {
  return {
    period: {
      from: period.from,
      to: period.to,
      granularity: 'day',
      timezone: 'Asia/Seoul',
    },
    totals: {
      ...EMPTY_TOTALS,
      points: 0,
    },
    items: [],
  };
}

export function createRevenueSnapshot<TFilters extends { preset: string; granularity: string }>({
  filters,
  summary,
  trend,
  from,
  to,
}: {
  filters: TFilters;
  summary: RevenueSummaryResponse;
  trend?: RevenueTrendResponse;
  from: string;
  to: string;
}): { summary: RevenueSummaryResponse; trend: RevenueTrendResponse; filters: TFilters } {
  return {
    summary,
    trend: trend ?? createEmptyRevenueTrend({ from, to }),
    filters,
  };
}

export function resolveRevenueHydrationResult<TFilters extends { preset: string; granularity: string }>({
  filters,
  from,
  to,
  summaryResult,
  trendResult,
}: {
  filters: TFilters;
  from: string;
  to: string;
  summaryResult: PromiseSettledResult<RevenueSummaryResponse>;
  trendResult: PromiseSettledResult<RevenueTrendResponse>;
}): (
  | {
    kind: 'summary-error';
    snapshot: null;
    isEmpty: false;
    trendError: null;
    summaryError: unknown;
  }
  | {
    kind: 'success' | 'partial';
    snapshot: { summary: RevenueSummaryResponse; trend: RevenueTrendResponse; filters: TFilters };
    isEmpty: boolean;
    trendError: unknown | null;
    summaryError: null;
  }
) {
  if (summaryResult.status === 'rejected') {
    return {
      kind: 'summary-error',
      snapshot: null,
      isEmpty: false,
      trendError: null,
      summaryError: summaryResult.reason,
    };
  }

  const snapshot = createRevenueSnapshot({
    filters,
    summary: summaryResult.value,
    trend: trendResult.status === 'fulfilled' ? trendResult.value : undefined,
    from,
    to,
  });

  return {
    kind: trendResult.status === 'rejected' ? 'partial' : 'success',
    snapshot,
    isEmpty: isRevenueSummaryEmpty(snapshot.summary),
    trendError: trendResult.status === 'rejected' ? trendResult.reason : null,
    summaryError: null,
  };
}

function toSettledResult<T>(promise: Promise<T>): Promise<PromiseSettledResult<T>> {
  return promise.then(
    (value) => ({ status: 'fulfilled', value }),
    (reason) => ({ status: 'rejected', reason }),
  );
}

export async function settleRevenueHydration<TFilters extends { preset: string; granularity: string }>({
  filters,
  from,
  to,
  summaryPromise,
  trendPromise,
  hasPreviousSnapshot,
  previousTrendError,
}: {
  filters: TFilters;
  from: string;
  to: string;
  summaryPromise: Promise<RevenueSummaryResponse>;
  trendPromise: Promise<RevenueTrendResponse>;
  hasPreviousSnapshot: boolean;
  previousTrendError: unknown | null;
}) {
  const trendResultPromise = toSettledResult(trendPromise);

  try {
    const summary = await summaryPromise;
    const trendResult = await trendResultPromise;
    const result = resolveRevenueHydrationResult({
      filters,
      from,
      to,
      summaryResult: {
        status: 'fulfilled',
        value: summary,
      },
      trendResult,
    });

    return {
      ...result,
      displayTrendError: result.trendError,
    };
  } catch (summaryError) {
    return {
      kind: 'summary-error' as const,
      snapshot: null,
      isEmpty: false,
      trendError: null,
      summaryError,
      displayTrendError: hasPreviousSnapshot ? previousTrendError : null,
    };
  }
}
