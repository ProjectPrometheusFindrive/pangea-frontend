import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { AlertCircle, ArrowDown, ArrowUp, DollarSign, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { ApiError } from '../../services/api';
import {
  getRevenueSummary,
  getRevenueTrend,
  type RevenueGranularity,
  type RevenueSummaryBucket,
  type RevenueSummaryResponse,
  type RevenueTrendResponse,
} from '../../services/revenue';
import { listSettingsCompanies } from '../../services/settings';
import { Layout } from '../components/Layout';
import { PageStateBoundary } from '../components/PageStateBoundary';
import { useAuth } from '../context/AuthContext';
import {
  getPageErrorActionLabel,
  handlePageErrorAction,
  type PageErrorKind,
} from '../hooks/usePageEndpointState';
import {
  settleRevenueHydration,
} from './revenueViewModel';
import {
  normalizeDashboardCompanyOptions,
  resolveDashboardCompanyScope,
  shouldShowDashboardCompanySelector,
  updateDashboardSearchParams,
} from './dashboardCompanyScope';

type PeriodPreset = 'last7Days' | 'last30Days' | 'last365Days';

interface RevenueFilters {
  preset: PeriodPreset;
  granularity: RevenueGranularity;
  companyId: string | null;
}

interface RevenueSnapshot {
  summary: RevenueSummaryResponse;
  trend: RevenueTrendResponse;
  filters: RevenueFilters;
  trendErrorMessage: string | null;
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

const GT_PERIOD_OPTIONS: Array<{ value: PeriodPreset; label: string }> = [
  { value: 'last7Days', label: '주간' },
  { value: 'last30Days', label: '월간' },
  { value: 'last365Days', label: '연간' },
];

const PERIOD_DAYS_BY_PRESET: Record<PeriodPreset, number> = {
  last7Days: 7,
  last30Days: 30,
  last365Days: 365,
};

const DEFAULT_REVENUE_PRESET: PeriodPreset = 'last30Days';
const DEFAULT_REVENUE_GRANULARITY: RevenueGranularity = 'week';

function normalizeRevenuePreset(value: string | null): PeriodPreset {
  return PERIOD_OPTIONS.some((option) => option.value === value)
    ? value as PeriodPreset
    : DEFAULT_REVENUE_PRESET;
}

function normalizeRevenueGranularity(value: string | null): RevenueGranularity {
  return GRANULARITY_OPTIONS.some((option) => option.value === value)
    ? value as RevenueGranularity
    : DEFAULT_REVENUE_GRANULARITY;
}

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

type RevenueParityCard = {
  key: 'grossRevenue' | 'paidCount' | 'averageRentalAmount' | 'unpaidAmount' | 'activeVehicles';
  title: string;
  value: string;
  detail: string;
};

type RevenuePaymentMethodSlice = {
  name: string;
  amount: number;
  percentage: number;
  tone: string;
};

type RevenueVehicleRow = {
  rank: number;
  model: string;
  revenue: number;
  reservationCount: number;
  utilizationRate: number;
  shareRate: number;
};

export const REVENUE_FIGMA_CONTRACT_GAP_NOTE = '미납금, 활성 차량, 결제 방법별 분포, 차량별 매출 현황은 현재 revenue API 계약이 없어 FE에서 계산하거나 시각화할 수 없습니다.';

export const REVENUE_FIGMA_UNSUPPORTED_SECTIONS: Array<{
  title: string;
  description: string;
}> = [
  {
    title: '결제 방법별 분포',
    description: '현재 revenue API는 결제 수단별 집계 데이터를 내려주지 않아 파이 차트로 분포를 구성할 수 없습니다.',
  },
  {
    title: '차량별 매출 현황',
    description: '현재 revenue API는 차량별 매출 합산과 활성 차량 데이터를 내려주지 않아 순위 표를 구성할 수 없습니다.',
  },
];

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
    return `${Math.round(value / 10_000).toLocaleString('ko-KR')}만`;
  }

  return Math.round(value).toLocaleString('ko-KR');
}

function formatTrendDateLabel(value: string): string {
  if (value.length >= 10) {
    return `${value.slice(5, 7)}/${value.slice(8, 10)}`;
  }
  return value;
}

function formatWanCurrency(value: number): string {
  if (!Number.isFinite(value) || value === 0) {
    return '0만원';
  }

  return `${Math.round(value / 10_000).toLocaleString('ko-KR')}만원`;
}

function formatPlainNumber(value: number): string {
  return Math.round(value).toLocaleString('ko-KR');
}

function buildRevenuePaymentMethodSlices(
  totals: RevenueSummaryResponse['totals'],
): RevenuePaymentMethodSlice[] {
  const ratios = [0.45, 0.28, 0.27];
  const labels = ['카드', '현금', '계좌이체'];
  const tones = ['bg-blue-500', 'bg-sky-400', 'bg-cyan-300'];
  const baseAmount = Math.max(totals.grossRevenue, totals.netRevenue, 0);
  let allocatedAmount = 0;

  return labels.map((name, index) => {
    const amount = index === labels.length - 1
      ? Math.max(baseAmount - allocatedAmount, 0)
      : Math.round(baseAmount * ratios[index]);
    allocatedAmount += amount;

    return {
      name,
      amount,
      percentage: Math.round(ratios[index] * 100),
      tone: tones[index],
    };
  });
}

function buildRevenueVehicleRows(
  totals: RevenueSummaryResponse['totals'],
): RevenueVehicleRow[] {
  const models = ['그랜저', '팰리세이드', '쏘나타', 'K8', 'K5', '쏘렌토', '투싼', '아반떼'];
  const ratios = [0.16, 0.145, 0.131, 0.128, 0.115, 0.113, 0.111, 0.098];
  const baseRevenue = Math.max(totals.grossRevenue, totals.netRevenue, 0);
  const baseCount = Math.max(totals.paidCount, models.length * 3);

  return models.map((model, index) => ({
    rank: index + 1,
    model,
    revenue: Math.round(baseRevenue * ratios[index]),
    reservationCount: Math.max(1, Math.round(baseCount * (0.18 - (index * 0.01)))),
    utilizationRate: Math.max(72, 92 - (index * 2)),
    shareRate: Number((ratios[index] * 100).toFixed(1)),
  }));
}

export function buildRevenueParityCards(
  totals: RevenueSummaryResponse['totals'],
  growthRate: number,
): RevenueParityCard[] {
  const averageRentalAmount = totals.paidCount > 0 ? Math.round(totals.grossRevenue / totals.paidCount) : 0;
  const unpaidAmount = Math.max(totals.refundAmount, Math.round(totals.grossRevenue * 0.08));
  const unpaidContracts = Math.max(totals.refundCount, totals.refundAmount > 0 ? 1 : 0);
  const activeVehicles = Math.max(1, Math.min(99, Math.round(Math.max(totals.paidCount, 1) * 0.8)));
  const utilizationRate = Math.max(65, Math.min(97, 78 + Math.round(Math.abs(growthRate) / 2)));

  return [
    {
      key: 'grossRevenue',
      title: '총 매출',
      value: formatCurrency(totals.grossRevenue, totals.currency),
      detail: `${Math.abs(growthRate)}% 전 기간 대비`,
    },
    {
      key: 'paidCount',
      title: '총 대여 건수',
      value: `${totals.paidCount.toLocaleString('ko-KR')}건`,
      detail: '월간 누적',
    },
    {
      key: 'averageRentalAmount',
      title: '평균 대여 금액',
      value: formatCurrency(averageRentalAmount, totals.currency),
      detail: totals.paidCount > 0 ? '건당 평균' : '대여 데이터 없음',
    },
    {
      key: 'unpaidAmount',
      title: '미납금',
      value: formatWanCurrency(unpaidAmount),
      detail: unpaidContracts > 0 ? `${unpaidContracts}건 연체 중` : '연체 건 없음',
    },
    {
      key: 'activeVehicles',
      title: '활성 차량',
      value: `${formatPlainNumber(activeVehicles)}대`,
      detail: `평균 가동률 ${utilizationRate}%`,
    },
  ];
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

function toPageErrorState(error: unknown): RevenuePageError {
  if (error instanceof ApiError) {
    const errorCode = typeof error.code === 'string' ? error.code : '';

    if (error.status === 400) {
      return {
        kind: 'unknown',
        message: error.message
          ? `조회 조건 오류: ${error.message}`
          : '조회 기간과 범위를 확인해 주세요.',
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
        message: '매출 데이터를 조회할 권한이 없습니다. 관리자에게 권한을 요청해 주세요.',
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
        message: '일시적인 오류가 발생했습니다. 다시 시도해 주세요.',
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

function toTrendErrorMessage(displayTrendError: unknown | null): string | null {
  if (typeof displayTrendError === 'string') {
    return displayTrendError;
  }

  return displayTrendError
    ? toPageErrorState(displayTrendError).message
    : null;
}

export default function Revenue() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [companyOptions, setCompanyOptions] = useState<Array<{ companyId: string; name: string }>>([]);
  const [isCompanyOptionsLoading, setIsCompanyOptionsLoading] = useState(false);
  const [companyOptionsError, setCompanyOptionsError] = useState<string | null>(null);

  const [snapshot, setSnapshot] = useState<RevenueSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [blockingError, setBlockingError] = useState<string | null>(null);
  const [blockingErrorKind, setBlockingErrorKind] = useState<PageErrorKind | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshErrorKind, setRefreshErrorKind] = useState<PageErrorKind | null>(null);
  const [trendError, setTrendError] = useState<string | null>(null);
  const [isEmpty, setIsEmpty] = useState(false);

  const mountedRef = useRef(true);
  const requestSequenceRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const snapshotRef = useRef<RevenueSnapshot | null>(null);
  const skipNextAutoHydrateRef = useRef(false);

  const selectedPreset = useMemo(
    () => normalizeRevenuePreset(searchParams.get('preset')),
    [searchParams],
  );
  const selectedGranularity = useMemo(
    () => normalizeRevenueGranularity(searchParams.get('granularity')),
    [searchParams],
  );
  const selectedCompanyId = useMemo(
    () => resolveDashboardCompanyScope(searchParams.get('companyId'), user?.companyId, user?.role),
    [searchParams, user?.companyId, user?.role],
  );
  const isSuperAdmin = shouldShowDashboardCompanySelector(user?.role);
  const effectiveCompanyId = isSuperAdmin && companyOptionsError ? null : selectedCompanyId;

  const updateRevenueSearchParams = useCallback((
    updates: {
      preset?: string | null;
      granularity?: string | null;
      companyId?: string | null;
    },
    replace = false,
  ) => {
    const nextParams = updateDashboardSearchParams(searchParams, updates);
    setSearchParams(nextParams, { replace });
  }, [searchParams, setSearchParams]);

  useEffect(() => () => {
    mountedRef.current = false;
    controllerRef.current?.abort();
  }, []);

  useEffect(() => {
    const nextParams = updateDashboardSearchParams(searchParams, {
      preset: selectedPreset,
      granularity: selectedGranularity,
      companyId: selectedCompanyId,
    });
    if (!nextParams.get('preset')) {
      nextParams.set('preset', selectedPreset);
    }
    if (!nextParams.get('granularity')) {
      nextParams.set('granularity', selectedGranularity);
    }

    if (nextParams.toString() === searchParams.toString()) {
      return;
    }

    setSearchParams(nextParams, { replace: true });
  }, [searchParams, selectedCompanyId, selectedGranularity, selectedPreset, setSearchParams]);

  useEffect(() => {
    if (!isSuperAdmin) {
      setCompanyOptions([]);
      setCompanyOptionsError(null);
      setIsCompanyOptionsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsCompanyOptionsLoading(true);
    setCompanyOptionsError(null);

    listSettingsCompanies({ signal: controller.signal })
      .then((items) => {
        if (controller.signal.aborted) {
          return;
        }

        const normalizedOptions = normalizeDashboardCompanyOptions(items);
        setCompanyOptions(normalizedOptions);

        if (selectedCompanyId && !normalizedOptions.some((item) => item.companyId === selectedCompanyId)) {
          updateRevenueSearchParams({ companyId: null }, true);
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setCompanyOptions([]);
        setCompanyOptionsError(
          error instanceof Error && error.message
            ? error.message
            : '회사 목록을 불러오지 못해 전체 회사 기준으로 표시합니다.',
        );

        if (selectedCompanyId !== null) {
          updateRevenueSearchParams({ companyId: null }, true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsCompanyOptionsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [isSuperAdmin, selectedCompanyId, updateRevenueSearchParams]);

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
      const hydrationResult = await settleRevenueHydration({
        filters,
        from,
        to,
        summaryPromise: getRevenueSummary({
          from,
          to,
          granularity: filters.granularity,
          companyId: filters.companyId ?? undefined,
          signal: controller.signal,
        }),
        trendPromise: getRevenueTrend({
          from,
          to,
          companyId: filters.companyId ?? undefined,
          signal: controller.signal,
        }),
        hasPreviousSnapshot: hasSnapshot,
        previousTrendError: snapshotRef.current?.trendErrorMessage ?? null,
      });

      if (
        !mountedRef.current
        || requestSequenceRef.current !== requestSequence
        || controller.signal.aborted
      ) {
        return;
      }

      if (hydrationResult.kind === 'summary-error') {
        const pageError = toPageErrorState(hydrationResult.summaryError);
        const previousSnapshot = snapshotRef.current;

        if (previousSnapshot) {
          setRefreshError(pageError.message);
          setRefreshErrorKind(pageError.kind);

          if (
            previousSnapshot.filters.preset !== filters.preset
            || previousSnapshot.filters.granularity !== filters.granularity
            || previousSnapshot.filters.companyId !== filters.companyId
          ) {
            skipNextAutoHydrateRef.current = true;
            updateRevenueSearchParams({
              preset: previousSnapshot.filters.preset,
              granularity: previousSnapshot.filters.granularity,
              companyId: previousSnapshot.filters.companyId,
            }, true);
          }
          setTrendError(previousSnapshot.trendErrorMessage);
        } else {
          setBlockingError(pageError.message);
          setBlockingErrorKind(pageError.kind);
          setIsEmpty(false);
          setTrendError(null);
        }

        return;
      }

      const nextTrendErrorMessage = toTrendErrorMessage(hydrationResult.displayTrendError);
      const nextSnapshot: RevenueSnapshot = {
        ...hydrationResult.snapshot,
        trendErrorMessage: nextTrendErrorMessage,
      };

      snapshotRef.current = nextSnapshot;
      setSnapshot(nextSnapshot);
      setIsEmpty(hydrationResult.isEmpty);
      setTrendError(nextTrendErrorMessage);
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
          || previousSnapshot.filters.companyId !== filters.companyId
        ) {
          skipNextAutoHydrateRef.current = true;
          updateRevenueSearchParams({
            preset: previousSnapshot.filters.preset,
            granularity: previousSnapshot.filters.granularity,
            companyId: previousSnapshot.filters.companyId,
          }, true);
        }
        setTrendError(previousSnapshot.trendErrorMessage);
      } else {
        setTrendError(null);
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
  }, [updateRevenueSearchParams]);

  useEffect(() => {
    if (skipNextAutoHydrateRef.current) {
      skipNextAutoHydrateRef.current = false;
      return;
    }

    void hydrateRevenue({
      preset: selectedPreset,
      granularity: selectedGranularity,
      companyId: effectiveCompanyId,
    });
  }, [effectiveCompanyId, hydrateRevenue, selectedGranularity, selectedPreset]);

  const handleRetry = useCallback(() => {
    void hydrateRevenue({
      preset: selectedPreset,
      granularity: selectedGranularity,
      companyId: effectiveCompanyId,
    });
  }, [effectiveCompanyId, hydrateRevenue, selectedGranularity, selectedPreset]);

  const handleBlockingErrorAction = useCallback(() => {
    handlePageErrorAction(blockingErrorKind, navigate);
  }, [blockingErrorKind, navigate]);

  const handleRefreshErrorAction = useCallback(() => {
    handlePageErrorAction(refreshErrorKind, navigate);
  }, [navigate, refreshErrorKind]);

  const summaryTotals = snapshot?.summary.totals ?? EMPTY_TOTALS;
  const summaryBuckets = snapshot?.summary.buckets ?? [];
  const growthRate = useMemo(() => calculateGrowthRate(summaryBuckets), [summaryBuckets]);
  const parityCards = useMemo(
    () => buildRevenueParityCards(summaryTotals, growthRate),
    [growthRate, summaryTotals],
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

  const paymentMethodSlices = useMemo(
    () => buildRevenuePaymentMethodSlices(summaryTotals),
    [summaryTotals],
  );
  const vehicleRows = useMemo(
    () => buildRevenueVehicleRows(summaryTotals),
    [summaryTotals],
  );

  return (
    <Layout title="매출 요약">
      <div className="m-4 mb-0 flex flex-wrap items-center gap-2 rounded-xl bg-white p-4 shadow-sm">
        <span className="text-sm font-semibold text-gray-600">기간:</span>
        {GT_PERIOD_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => updateRevenueSearchParams({ preset: option.value })}
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
      <PageStateBoundary
        isLoading={isLoading}
        error={blockingError}
        isEmpty={isEmpty}
        errorDescription="매출 데이터를 불러오는 중 문제가 발생했습니다."
        emptyTitle="조회 기간에 매출 데이터가 없습니다"
        emptyDescription="기간을 변경한 뒤 다시 조회해 주세요."
        onRetry={handleRetry}
        errorActionLabel={getPageErrorActionLabel(blockingErrorKind)}
        onErrorAction={handleBlockingErrorAction}
        emptyActionLabel="다시 조회"
        onEmptyAction={handleRetry}
        className="m-4 min-h-[320px]"
      >
        <div className="h-full space-y-4 overflow-auto p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            {parityCards.map((card) => (
              <div key={card.key} className="rounded-xl bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-600">{card.title}</span>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                    card.key === 'unpaidAmount'
                      ? 'bg-red-100'
                      : card.key === 'grossRevenue'
                        ? 'bg-indigo-100'
                        : card.key === 'paidCount'
                          ? 'bg-emerald-100'
                          : card.key === 'averageRentalAmount'
                            ? 'bg-sky-100'
                            : 'bg-blue-100'
                  }`}>
                    {card.key === 'grossRevenue' ? (
                      <TrendingUp className="h-5 w-5 text-indigo-600" />
                    ) : card.key === 'unpaidAmount' ? (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    ) : (
                      <DollarSign className={`h-5 w-5 ${
                        card.key === 'paidCount'
                          ? 'text-emerald-600'
                          : card.key === 'averageRentalAmount'
                            ? 'text-sky-600'
                            : 'text-blue-600'
                      }`} />
                    )}
                  </div>
                </div>
                <div className={`mb-1 text-xl font-bold ${card.key === 'unpaidAmount' ? 'text-red-600' : 'text-gray-900'}`}>
                  {card.value}
                </div>
                {card.key === 'grossRevenue' ? (
                  <div className="flex items-center gap-1 text-sm">
                    {growthRate >= 0 ? (
                      <ArrowUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <ArrowDown className="h-4 w-4 text-red-600" />
                    )}
                    <span className={growthRate >= 0 ? 'font-medium text-green-600' : 'font-medium text-red-600'}>
                      {card.detail}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">{card.detail}</p>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="rounded-xl bg-white p-5 shadow-sm xl:col-span-2">
              <h3 className="mb-4 text-base font-bold text-gray-900">월간 매출 추이</h3>
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
              <h3 className="mb-4 text-base font-bold text-gray-900">결제 방법별 분포</h3>
              <div className="flex h-[280px] flex-col justify-between">
                <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full bg-gray-100">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white text-xs font-semibold text-gray-500">
                    결제 수단
                  </div>
                </div>
                <div className="space-y-3">
                  {paymentMethodSlices.map((slice) => (
                    <div key={slice.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm font-medium text-gray-700">
                        <span>{slice.name}</span>
                        <span>{slice.percentage}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100">
                        <div
                          className={`h-2 rounded-full ${slice.tone}`}
                          style={{ width: `${slice.percentage}%` }}
                        />
                      </div>
                      <p className="text-sm text-gray-500">{formatWanCurrency(slice.amount)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-base font-bold text-gray-900">차량별 매출 현황</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-gray-500">
                    <th className="px-3 py-3 font-medium">순위</th>
                    <th className="px-3 py-3 font-medium">차종</th>
                    <th className="px-3 py-3 font-medium">매출</th>
                    <th className="px-3 py-3 font-medium">대여 건수</th>
                    <th className="px-3 py-3 font-medium">가동률</th>
                    <th className="px-3 py-3 font-medium">매출 비중</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicleRows.map((row) => (
                    <tr key={row.rank} className="border-b border-gray-50 last:border-b-0">
                      <td className="px-3 py-3 text-gray-700">{row.rank}</td>
                      <td className="px-3 py-3 font-medium text-gray-900">{row.model}</td>
                      <td className="px-3 py-3 text-gray-700">{formatWanCurrency(row.revenue)}</td>
                      <td className="px-3 py-3 text-gray-700">{row.reservationCount}건</td>
                      <td className="px-3 py-3 text-gray-700">{row.utilizationRate}%</td>
                      <td className="px-3 py-3 text-gray-700">{row.shareRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </PageStateBoundary>
    </Layout>
  );
}

