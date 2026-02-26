import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AlertCircle, ArrowDown, ArrowUp, DollarSign, RefreshCw, RotateCcw, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { ApiError } from '../../services/api';
import {
  getRevenueSummary,
  getRevenueTrend,
  type RevenueGranularity,
  type RevenueSummaryBucket,
  type RevenueSummaryResponse,
  type RevenueTrendResponse,
} from '../../services/revenue';
import { Layout } from '../components/Layout';
import { PageStateBoundary } from '../components/PageStateBoundary';
import {
  getPageErrorActionLabel,
  handlePageErrorAction,
  type PageErrorKind,
} from '../hooks/usePageEndpointState';

type PeriodPreset = 'last7Days' | 'last30Days' | 'last365Days';

interface RevenueFilters {
  preset: PeriodPreset;
  granularity: RevenueGranularity;
}

interface RevenueSnapshot {
  summary: RevenueSummaryResponse;
  trend: RevenueTrendResponse;
  filters: RevenueFilters;
}

interface RevenuePageError {
  kind: PageErrorKind;
  message: string;
}

const PERIOD_OPTIONS: Array<{ value: PeriodPreset; label: string; days: number }> = [
  { value: 'last7Days', label: '최근 7일', days: 7 },
  { value: 'last30Days', label: '최근 30일', days: 30 },
  { value: 'last365Days', label: '최근 1년', days: 365 },
];

const PERIOD_DAYS_BY_PRESET: Record<PeriodPreset, number> = {
  last7Days: 7,
  last30Days: 30,
  last365Days: 365,
};

const GRANULARITY_OPTIONS: Array<{ value: RevenueGranularity; label: string }> = [
  { value: 'day', label: '일별' },
  { value: 'week', label: '주별' },
  { value: 'month', label: '월별' },
];

const EMPTY_TOTALS = {
  grossRevenue: 0,
  refundAmount: 0,
  netRevenue: 0,
  paidCount: 0,
  refundCount: 0,
  currency: 'KRW',
};

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resolveDateRange(preset: PeriodPreset): { from: string; to: string } {
  const days = PERIOD_DAYS_BY_PRESET[preset];
  const toDate = new Date();
  toDate.setHours(0, 0, 0, 0);

  const fromDate = new Date(toDate);
  fromDate.setDate(fromDate.getDate() - (days - 1));

  return {
    from: toIsoDate(fromDate),
    to: toIsoDate(toDate),
  };
}

function normalizeCurrencyCode(currency: string): string {
  const normalized = currency.trim().toUpperCase();
  return normalized.length === 3 ? normalized : 'KRW';
}

function formatCurrency(value: number, currency: string): string {
  const normalizedCurrency = normalizeCurrencyCode(currency);
  try {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: normalizedCurrency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return new Intl.NumberFormat('ko-KR', {
      maximumFractionDigits: 0,
    }).format(value);
  }
}

function formatAxisCurrency(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }

  const absValue = Math.abs(value);
  if (absValue >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(1)}억`;
  }

  if (absValue >= 10_000) {
    return `${Math.round(value / 10_000).toLocaleString()}만`;
  }

  return Math.round(value).toLocaleString();
}

function formatTrendDateLabel(value: string): string {
  if (value.length >= 10) {
    return `${value.slice(5, 7)}/${value.slice(8, 10)}`;
  }
  return value;
}

function calculateGrowthRate(buckets: RevenueSummaryBucket[]): number {
  if (buckets.length < 2) {
    return 0;
  }

  const midpoint = Math.floor(buckets.length / 2);
  const previousTotal = buckets.slice(0, midpoint).reduce((sum, bucket) => sum + bucket.netRevenue, 0);
  const currentTotal = buckets.slice(midpoint).reduce((sum, bucket) => sum + bucket.netRevenue, 0);

  if (previousTotal === 0) {
    return currentTotal > 0 ? 100 : 0;
  }

  return Math.round(((currentTotal - previousTotal) / previousTotal) * 100);
}

function isSnapshotEmpty(snapshot: RevenueSnapshot): boolean {
  const hasSummaryData = snapshot.summary.buckets.some((bucket) => (
    bucket.grossRevenue !== 0
    || bucket.refundAmount !== 0
    || bucket.netRevenue !== 0
    || bucket.paidCount > 0
    || bucket.refundCount > 0
  ));

  if (hasSummaryData) {
    return false;
  }

  return !snapshot.trend.items.some((item) => (
    item.grossRevenue !== 0
    || item.refundAmount !== 0
    || item.netRevenue !== 0
    || item.paidCount > 0
    || item.refundCount > 0
  ));
}

function toPageErrorState(error: unknown): RevenuePageError {
  if (error instanceof ApiError) {
    const errorCode = typeof error.code === 'string' ? error.code : '';

    if (error.status === 400) {
      return {
        kind: 'unknown',
        message: error.message
          ? `조회 조건 오류: ${error.message}`
          : '조회 기간/단위를 확인해 주세요.',
      };
    }

    if (error.status === 401 || errorCode === 'UNAUTHORIZED') {
      return {
        kind: 'unauthorized',
        message: '세션이 만료되었습니다. 로그인 후 다시 시도해 주세요.',
      };
    }

    if (error.status === 403 || errorCode === 'FORBIDDEN') {
      return {
        kind: 'forbidden',
        message: '매출 데이터 조회 권한이 없습니다. 관리자에게 권한을 요청해 주세요.',
      };
    }

    if (
      (typeof error.status === 'number' && error.status >= 500)
      || errorCode === 'TIMEOUT'
      || errorCode === 'NETWORK_ERROR'
      || errorCode === 'SERVER_ERROR'
      || errorCode === 'ABORTED'
    ) {
      return {
        kind: 'retryable',
        message: '일시적인 오류가 발생했습니다. 재시도해 주세요.',
      };
    }

    return {
      kind: 'unknown',
      message: error.message || '요청을 처리하는 중 오류가 발생했습니다.',
    };
  }

  if (error instanceof Error && error.message) {
    return {
      kind: 'unknown',
      message: error.message,
    };
  }

  return {
    kind: 'unknown',
    message: '요청을 처리하는 중 오류가 발생했습니다.',
  };
}

export default function Revenue() {
  const navigate = useNavigate();
  const [selectedPreset, setSelectedPreset] = useState<PeriodPreset>('last30Days');
  const [selectedGranularity, setSelectedGranularity] = useState<RevenueGranularity>('week');

  const [snapshot, setSnapshot] = useState<RevenueSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [blockingError, setBlockingError] = useState<string | null>(null);
  const [blockingErrorKind, setBlockingErrorKind] = useState<PageErrorKind | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshErrorKind, setRefreshErrorKind] = useState<PageErrorKind | null>(null);
  const [isEmpty, setIsEmpty] = useState(false);

  const mountedRef = useRef(true);
  const requestSequenceRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const snapshotRef = useRef<RevenueSnapshot | null>(null);
  const skipNextAutoHydrateRef = useRef(false);

  useEffect(() => () => {
    mountedRef.current = false;
    controllerRef.current?.abort();
  }, []);

  const hydrateRevenue = useCallback(async (filters: RevenueFilters) => {
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    const hasSnapshot = snapshotRef.current !== null;
    if (hasSnapshot) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setBlockingError(null);
    setBlockingErrorKind(null);
    setRefreshError(null);
    setRefreshErrorKind(null);

    const { from, to } = resolveDateRange(filters.preset);

    try {
      const [summary, trend] = await Promise.all([
        getRevenueSummary({
          from,
          to,
          granularity: filters.granularity,
          signal: controller.signal,
        }),
        getRevenueTrend({
          from,
          to,
          signal: controller.signal,
        }),
      ]);

      if (
        !mountedRef.current
        || requestSequenceRef.current !== requestSequence
        || controller.signal.aborted
      ) {
        return;
      }

      const nextSnapshot: RevenueSnapshot = {
        summary,
        trend,
        filters,
      };

      snapshotRef.current = nextSnapshot;
      setSnapshot(nextSnapshot);
      setIsEmpty(isSnapshotEmpty(nextSnapshot));
    } catch (requestError) {
      if (
        !mountedRef.current
        || requestSequenceRef.current !== requestSequence
        || controller.signal.aborted
      ) {
        return;
      }

      const pageError = toPageErrorState(requestError);
      const previousSnapshot = snapshotRef.current;

      if (previousSnapshot) {
        setRefreshError(pageError.message);
        setRefreshErrorKind(pageError.kind);

        if (
          previousSnapshot.filters.preset !== filters.preset
          || previousSnapshot.filters.granularity !== filters.granularity
        ) {
          skipNextAutoHydrateRef.current = true;
          setSelectedPreset(previousSnapshot.filters.preset);
          setSelectedGranularity(previousSnapshot.filters.granularity);
        }
      } else {
        setBlockingError(pageError.message);
        setBlockingErrorKind(pageError.kind);
        setIsEmpty(false);
      }
    } finally {
      if (!mountedRef.current || requestSequenceRef.current !== requestSequence) {
        return;
      }

      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (skipNextAutoHydrateRef.current) {
      skipNextAutoHydrateRef.current = false;
      return;
    }

    void hydrateRevenue({
      preset: selectedPreset,
      granularity: selectedGranularity,
    });
  }, [hydrateRevenue, selectedGranularity, selectedPreset]);

  const handleRetry = useCallback(() => {
    void hydrateRevenue({
      preset: selectedPreset,
      granularity: selectedGranularity,
    });
  }, [hydrateRevenue, selectedGranularity, selectedPreset]);

  const handleBlockingErrorAction = useCallback(() => {
    handlePageErrorAction(blockingErrorKind, navigate);
  }, [blockingErrorKind, navigate]);

  const handleRefreshErrorAction = useCallback(() => {
    handlePageErrorAction(refreshErrorKind, navigate);
  }, [navigate, refreshErrorKind]);

  const summaryTotals = snapshot?.summary.totals ?? EMPTY_TOTALS;
  const summaryBuckets = snapshot?.summary.buckets ?? [];
  const trendItems = snapshot?.trend.items ?? [];
  const growthRate = useMemo(() => calculateGrowthRate(summaryBuckets), [summaryBuckets]);

  const selectedPeriodLabel = useMemo(
    () => PERIOD_OPTIONS.find((option) => option.value === selectedPreset)?.label ?? '',
    [selectedPreset],
  );

  const selectedGranularityLabel = useMemo(
    () => GRANULARITY_OPTIONS.find((option) => option.value === selectedGranularity)?.label ?? '',
    [selectedGranularity],
  );

  const summaryChartData = useMemo(
    () => summaryBuckets.map((bucket) => ({
      label: bucket.label,
      grossRevenue: bucket.grossRevenue,
      refundAmount: bucket.refundAmount,
      netRevenue: bucket.netRevenue,
    })),
    [summaryBuckets],
  );

  const trendChartData = useMemo(
    () => trendItems.map((item) => ({
      label: formatTrendDateLabel(item.date),
      netRevenue: item.netRevenue,
      grossRevenue: item.grossRevenue,
      refundAmount: item.refundAmount,
    })),
    [trendItems],
  );

  const refreshErrorActionLabel = getPageErrorActionLabel(refreshErrorKind);

  return (
    <Layout title="매출 요약">
      <PageStateBoundary
        isLoading={isLoading}
        error={blockingError}
        isEmpty={isEmpty}
        errorDescription="매출 데이터를 불러오는 중 문제가 발생했습니다."
        emptyTitle="조회 기간에 매출 데이터가 없습니다"
        emptyDescription="기간 또는 집계 단위를 변경해 다시 조회해 주세요."
        onRetry={handleRetry}
        errorActionLabel={getPageErrorActionLabel(blockingErrorKind)}
        onErrorAction={handleBlockingErrorAction}
        emptyActionLabel="다시 조회"
        onEmptyAction={handleRetry}
        className="m-4 min-h-[320px]"
      >
        <div className="h-full space-y-4 overflow-auto p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-gray-600">조회 기간</span>
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedPreset(option.value)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    selectedPreset === option.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-gray-600">집계 단위</span>
              {GRANULARITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedGranularity(option.value)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    selectedGranularity === option.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
              >
                <RotateCcw className="h-4 w-4" />
                재조회
              </button>
            </div>
          </div>

          {snapshot && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
              <span>
                {snapshot.summary.period.from} ~ {snapshot.summary.period.to}
                {' · '}
                {selectedPeriodLabel}
                {' · '}
                {selectedGranularityLabel}
              </span>
              <span>{snapshot.summary.period.timezone}</span>
            </div>
          )}

          {isRefreshing && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
              <RefreshCw className="h-4 w-4 animate-spin" />
              선택한 조건으로 데이터를 다시 불러오는 중입니다.
            </div>
          )}

          {refreshError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900">{refreshError}</p>
                  <p className="mt-1 text-xs text-amber-700">이전 조회 결과를 유지했습니다.</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700"
                    >
                      재시도
                    </button>
                    {refreshErrorActionLabel && (
                      <button
                        type="button"
                        onClick={handleRefreshErrorAction}
                        className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100"
                      >
                        {refreshErrorActionLabel}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-600">순매출</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <div className="mb-1 text-xl font-bold text-gray-900">
                {formatCurrency(summaryTotals.netRevenue, summaryTotals.currency)}
              </div>
              <div className="flex items-center gap-1 text-sm">
                {growthRate >= 0 ? (
                  <ArrowUp className="h-4 w-4 text-green-600" />
                ) : (
                  <ArrowDown className="h-4 w-4 text-red-600" />
                )}
                <span className={growthRate >= 0 ? 'font-medium text-green-600' : 'font-medium text-red-600'}>
                  {Math.abs(growthRate)}%
                </span>
                <span className="text-gray-500">구간 전반 대비</span>
              </div>
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-600">총 결제 금액</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
                  <TrendingUp className="h-5 w-5 text-indigo-600" />
                </div>
              </div>
              <div className="text-xl font-bold text-gray-900">
                {formatCurrency(summaryTotals.grossRevenue, summaryTotals.currency)}
              </div>
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-600">환불 금액</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
              </div>
              <div className="text-xl font-bold text-red-600">
                {formatCurrency(summaryTotals.refundAmount, summaryTotals.currency)}
              </div>
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-600">결제 건수</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
              <div className="text-xl font-bold text-gray-900">
                {summaryTotals.paidCount.toLocaleString()}건
              </div>
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-600">환불 건수</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
              </div>
              <div className="text-xl font-bold text-gray-900">
                {summaryTotals.refundCount.toLocaleString()}건
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="rounded-xl bg-white p-5 shadow-sm xl:col-span-2">
              <h3 className="mb-4 text-base font-bold text-gray-900">집계 버킷 매출</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={summaryChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" tickFormatter={formatAxisCurrency} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formatCurrency(value, summaryTotals.currency),
                      name,
                    ]}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend />
                  <Bar name="순매출" dataKey="netRevenue" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  <Bar name="환불액" dataKey="refundAmount" fill="#f97316" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-base font-bold text-gray-900">일별 순매출 추이</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" tickFormatter={formatAxisCurrency} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value, summaryTotals.currency), '순매출']}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="netRevenue"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-base font-bold text-gray-900">버킷별 상세</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-2 text-left text-sm font-semibold text-gray-600">기간</th>
                    <th className="px-3 py-2 text-right text-sm font-semibold text-gray-600">결제 건수</th>
                    <th className="px-3 py-2 text-right text-sm font-semibold text-gray-600">환불 건수</th>
                    <th className="px-3 py-2 text-right text-sm font-semibold text-gray-600">총 결제 금액</th>
                    <th className="px-3 py-2 text-right text-sm font-semibold text-gray-600">환불 금액</th>
                    <th className="px-3 py-2 text-right text-sm font-semibold text-gray-600">순매출</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryBuckets.map((bucket) => (
                    <tr key={`${bucket.startDate}-${bucket.endDate}`} className="border-b border-gray-100">
                      <td className="px-3 py-2 text-sm text-gray-700">{bucket.label}</td>
                      <td className="px-3 py-2 text-right text-sm text-gray-700">{bucket.paidCount.toLocaleString()}건</td>
                      <td className="px-3 py-2 text-right text-sm text-gray-700">{bucket.refundCount.toLocaleString()}건</td>
                      <td className="px-3 py-2 text-right text-sm font-medium text-gray-900">
                        {formatCurrency(bucket.grossRevenue, summaryTotals.currency)}
                      </td>
                      <td className="px-3 py-2 text-right text-sm font-medium text-red-600">
                        {formatCurrency(bucket.refundAmount, summaryTotals.currency)}
                      </td>
                      <td className="px-3 py-2 text-right text-sm font-semibold text-blue-700">
                        {formatCurrency(bucket.netRevenue, summaryTotals.currency)}
                      </td>
                    </tr>
                  ))}
                  {summaryBuckets.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-10 text-center text-sm text-gray-500">
                        표시할 버킷 데이터가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </PageStateBoundary>
    </Layout>
  );
}
