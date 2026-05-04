import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { AlertCircle, ArrowDown, ArrowUp, DollarSign, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { ApiError } from '../../services/api';
import {
  getBillingLedger,
  getBillingLedgerCsv,
  type BillingLedgerResponse,
} from '../../services/billing';
import {
  getRevenueSummary,
  getRevenueTrend,
  type RevenueGranularity,
  type RevenuePayerType,
  type RevenuePayerTypeBreakdown,
  type RevenuePaymentMethod,
  type RevenueRentalTypeBreakdown,
  type RevenueRentalType,
  type RevenueSummaryBucket,
  type RevenueSummaryResponse,
  type RevenueTrendResponse,
  type RevenueVehicle,
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
import { formatDateKst } from '../utils/dateTimeFormat';

type PeriodPreset = 'last7Days' | 'last30Days' | 'last365Days';
type RevenueTab = 'summary' | 'ledger';

interface RevenueFilters {
  preset: PeriodPreset;
  granularity: RevenueGranularity;
  companyId: string | null;
  rentalType: RevenueRentalType | null;
  payerType: RevenuePayerType | null;
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

function normalizeRevenueRentalType(value: string | null): RevenueRentalType | null {
  return RENTAL_TYPE_OPTIONS.some((option) => option.value === value) && value !== 'all'
    ? value as RevenueRentalType
    : null;
}

function normalizeRevenuePayerType(value: string | null): RevenuePayerType | null {
  return PAYER_TYPE_OPTIONS.some((option) => option.value === value) && value !== 'all'
    ? value as RevenuePayerType
    : null;
}

const GRANULARITY_OPTIONS: Array<{ value: RevenueGranularity; label: string }> = [
  { value: 'day', label: '일별' },
  { value: 'week', label: '주별' },
  { value: 'month', label: '월별' },
];

const RENTAL_TYPE_OPTIONS: Array<{ value: RevenueRentalType | 'all'; label: string }> = [
  { value: 'all', label: '전체 유형' },
  { value: 'short_term', label: '단기렌트' },
  { value: 'long_term', label: '장기렌트' },
  { value: 'accident_replacement', label: '사고대차' },
];

const PAYER_TYPE_OPTIONS: Array<{ value: RevenuePayerType | 'all'; label: string }> = [
  { value: 'all', label: '전체 책임자' },
  { value: 'customer', label: '고객' },
  { value: 'insurer', label: '보험사' },
  { value: 'corporate', label: '법인' },
  { value: 'repair_shop', label: '정비공장' },
];

const LEDGER_STATUS_OPTIONS = [
  { value: 'all', label: '전체 상태' },
  { value: 'pending', label: '수납 예정' },
  { value: 'partial', label: '부분 수납' },
  { value: 'paid', label: '수납 완료' },
  { value: 'waived', label: '면제' },
  { value: 'confirmed', label: '확정 수납' },
  { value: 'needs_confirmation', label: '확인 필요' },
];

const EMPTY_TOTALS = {
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

type RevenueParityCard = {
  key: 'grossRevenue' | 'paidCount' | 'averageRentalAmount' | 'unpaidAmount' | 'activeVehicles';
  title: string;
  value: string;
  detail: string;
};

type RevenuePaymentMethodSlice = {
  name: string;
  amount: number;
  count: number;
  percentage: number;
  tone: string;
};

type RevenueModelRow = {
  rank: number;
  model: string;
  revenue: number;
  reservationCount: number;
  utilizationRate: number;
  shareRate: number;
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
    return `${Math.round(value / 10_000).toLocaleString('ko-KR')}만`;
  }

  return Math.round(value).toLocaleString('ko-KR');
}

function formatTrendDateLabel(value: string): string {
  return formatDateKst(value, value);
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

function triggerCsvDownload(filename: string, csv: string): void {
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getRentalTypeLabel(value?: string | null): string {
  return RENTAL_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? '단기렌트';
}

function getPayerTypeLabel(value?: string | null): string {
  return PAYER_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? '고객';
}

function getLedgerEntryTypeLabel(value?: string | null): string {
  return value === 'payment' ? '수납' : '청구';
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return '0%';
  }
  const rounded = Math.round(value * 10) / 10;
  return `${rounded.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%`;
}

function toDisplayPercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

function buildRevenuePaymentMethodSlices(
  paymentMethods: RevenuePaymentMethod[],
): RevenuePaymentMethodSlice[] {
  const tones = ['bg-blue-500', 'bg-sky-400', 'bg-cyan-300'];

  return paymentMethods.map((item, index) => ({
    name: item.method || '미지정',
    amount: item.amount,
    count: item.count,
    percentage: toDisplayPercentage(item.percentage),
    tone: tones[index % tones.length],
  }));
}

function normalizeRevenueRentalTypeRows(rows: RevenueRentalTypeBreakdown[]) {
  return rows.map((item) => ({
    label: getRentalTypeLabel(item.rentalType),
    amount: item.amount,
    count: item.count,
    percentage: toDisplayPercentage(item.percentage),
  }));
}

function normalizeRevenuePayerTypeRows(rows: RevenuePayerTypeBreakdown[]) {
  return rows.map((item) => ({
    label: getPayerTypeLabel(item.payerType),
    amount: item.amount,
    count: item.count,
    percentage: toDisplayPercentage(item.percentage),
  }));
}

export function buildRevenueModelRows(
  vehicles: RevenueVehicle[],
): RevenueModelRow[] {
  const grouped = new Map<string, {
    model: string;
    revenue: number;
    reservationCount: number;
    utilizationRateSum: number;
    vehicleCount: number;
  }>();

  for (const item of vehicles) {
    const normalizedModel = (item.model || '').trim() || '차종 미확인';
    const current = grouped.get(normalizedModel) ?? {
      model: normalizedModel,
      revenue: 0,
      reservationCount: 0,
      utilizationRateSum: 0,
      vehicleCount: 0,
    };
    current.revenue += item.revenue;
    current.reservationCount += item.reservationCount;
    current.utilizationRateSum += item.utilizationRate;
    current.vehicleCount += 1;
    grouped.set(normalizedModel, current);
  }

  const groupedRows = Array.from(grouped.values())
    .sort((left, right) => {
      if (right.revenue !== left.revenue) {
        return right.revenue - left.revenue;
      }
      return left.model.localeCompare(right.model, 'ko-KR');
    });

  const totalRevenue = groupedRows.reduce((sum, row) => sum + row.revenue, 0);
  return groupedRows.map((row, index) => {
    const averageUtilization = row.vehicleCount > 0
      ? row.utilizationRateSum / row.vehicleCount
      : 0;
    const shareRate = totalRevenue > 0
      ? (row.revenue / totalRevenue) * 100
      : 0;
    return {
      rank: index + 1,
      model: row.model,
      revenue: row.revenue,
      reservationCount: row.reservationCount,
      utilizationRate: averageUtilization * 100,
      shareRate,
    };
  });
}

export function buildRevenueParityCards(
  totals: RevenueSummaryResponse['totals'],
  growthRate: number,
): RevenueParityCard[] {
  const averageRentalAmount = totals.paidCount > 0 ? Math.round(totals.grossRevenue / totals.paidCount) : 0;

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
      value: formatWanCurrency(totals.unpaidAmount),
      detail: totals.unpaidCount > 0 ? `${totals.unpaidCount.toLocaleString('ko-KR')}건 미납` : '미납 건 없음',
    },
    {
      key: 'activeVehicles',
      title: '활성 차량',
      value: `${formatPlainNumber(totals.activeVehicleCount)}대`,
      detail: `평균 가동률 ${formatPercent(totals.utilizationRate * 100)}`,
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
  const [activeTab, setActiveTab] = useState<RevenueTab>('summary');
  const [ledgerReservationId, setLedgerReservationId] = useState('');
  const [ledgerVehicleNumber, setLedgerVehicleNumber] = useState('');
  const [ledgerStatus, setLedgerStatus] = useState('all');
  const [ledgerData, setLedgerData] = useState<BillingLedgerResponse | null>(null);
  const [isLedgerLoading, setIsLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [isLedgerCsvDownloading, setIsLedgerCsvDownloading] = useState(false);

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
  const selectedRentalType = useMemo(
    () => normalizeRevenueRentalType(searchParams.get('rentalType')),
    [searchParams],
  );
  const selectedPayerType = useMemo(
    () => normalizeRevenuePayerType(searchParams.get('payerType')),
    [searchParams],
  );
  const isSuperAdmin = shouldShowDashboardCompanySelector(user?.role);
  const effectiveCompanyId = isSuperAdmin && companyOptionsError ? null : selectedCompanyId;

  const updateRevenueSearchParams = useCallback((
    updates: {
      preset?: string | null;
      granularity?: string | null;
      companyId?: string | null;
      rentalType?: string | null;
      payerType?: string | null;
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
      rentalType: selectedRentalType,
      payerType: selectedPayerType,
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
  }, [searchParams, selectedCompanyId, selectedGranularity, selectedPayerType, selectedPreset, selectedRentalType, setSearchParams]);

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
          rentalType: filters.rentalType ?? undefined,
          payerType: filters.payerType ?? undefined,
          signal: controller.signal,
        }),
        trendPromise: getRevenueTrend({
          from,
          to,
          companyId: filters.companyId ?? undefined,
          rentalType: filters.rentalType ?? undefined,
          payerType: filters.payerType ?? undefined,
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
            || previousSnapshot.filters.rentalType !== filters.rentalType
            || previousSnapshot.filters.payerType !== filters.payerType
          ) {
            skipNextAutoHydrateRef.current = true;
            updateRevenueSearchParams({
              preset: previousSnapshot.filters.preset,
              granularity: previousSnapshot.filters.granularity,
              companyId: previousSnapshot.filters.companyId,
              rentalType: previousSnapshot.filters.rentalType,
              payerType: previousSnapshot.filters.payerType,
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
          || previousSnapshot.filters.rentalType !== filters.rentalType
          || previousSnapshot.filters.payerType !== filters.payerType
        ) {
          skipNextAutoHydrateRef.current = true;
          updateRevenueSearchParams({
            preset: previousSnapshot.filters.preset,
            granularity: previousSnapshot.filters.granularity,
            companyId: previousSnapshot.filters.companyId,
            rentalType: previousSnapshot.filters.rentalType,
            payerType: previousSnapshot.filters.payerType,
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
      rentalType: selectedRentalType,
      payerType: selectedPayerType,
    });
  }, [effectiveCompanyId, hydrateRevenue, selectedGranularity, selectedPayerType, selectedPreset, selectedRentalType]);

  const handleRetry = useCallback(() => {
    void hydrateRevenue({
      preset: selectedPreset,
      granularity: selectedGranularity,
      companyId: effectiveCompanyId,
      rentalType: selectedRentalType,
      payerType: selectedPayerType,
    });
  }, [effectiveCompanyId, hydrateRevenue, selectedGranularity, selectedPayerType, selectedPreset, selectedRentalType]);

  const handleBlockingErrorAction = useCallback(() => {
    handlePageErrorAction(blockingErrorKind, navigate);
  }, [blockingErrorKind, navigate]);

  const handleRefreshErrorAction = useCallback(() => {
    handlePageErrorAction(refreshErrorKind, navigate);
  }, [navigate, refreshErrorKind]);

  const summaryTotals = snapshot?.summary.totals ?? EMPTY_TOTALS;
  const summaryBuckets = snapshot?.summary.buckets ?? [];
  const summaryPaymentMethods = snapshot?.summary.paymentMethods ?? [];
  const summaryRentalTypes = snapshot?.summary.rentalTypes ?? [];
  const summaryPayerTypes = snapshot?.summary.payerTypes ?? [];
  const summaryVehicles = snapshot?.summary.vehicles ?? [];
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
    () => buildRevenuePaymentMethodSlices(summaryPaymentMethods),
    [summaryPaymentMethods],
  );
  const rentalTypeRows = useMemo(
    () => normalizeRevenueRentalTypeRows(summaryRentalTypes),
    [summaryRentalTypes],
  );
  const payerTypeRows = useMemo(
    () => normalizeRevenuePayerTypeRows(summaryPayerTypes),
    [summaryPayerTypes],
  );
  const modelRows = useMemo(
    () => buildRevenueModelRows(summaryVehicles),
    [summaryVehicles],
  );
  const ledgerDateRange = useMemo(() => resolveDateRange(selectedPreset), [selectedPreset]);

  const loadLedger = useCallback(async () => {
    setIsLedgerLoading(true);
    setLedgerError(null);
    try {
      const data = await getBillingLedger({
        from: ledgerDateRange.from,
        to: ledgerDateRange.to,
        reservationId: ledgerReservationId.trim() || undefined,
        vehicleNumber: ledgerVehicleNumber.trim() || undefined,
        rentalType: selectedRentalType ?? undefined,
        payerType: selectedPayerType ?? undefined,
        status: ledgerStatus === 'all' ? undefined : ledgerStatus,
        page: 1,
        pageSize: 200,
      });
      setLedgerData(data);
    } catch (error) {
      setLedgerData(null);
      setLedgerError(error instanceof Error ? error.message : '정산 원장을 불러오지 못했습니다.');
    } finally {
      setIsLedgerLoading(false);
    }
  }, [ledgerDateRange.from, ledgerDateRange.to, ledgerReservationId, ledgerStatus, ledgerVehicleNumber, selectedPayerType, selectedRentalType]);

  useEffect(() => {
    if (activeTab !== 'ledger') {
      return;
    }
    void loadLedger();
  }, [activeTab, loadLedger]);

  const handleDownloadLedgerCsv = useCallback(async () => {
    setIsLedgerCsvDownloading(true);
    setLedgerError(null);
    try {
      const csv = await getBillingLedgerCsv({
        from: ledgerDateRange.from,
        to: ledgerDateRange.to,
        reservationId: ledgerReservationId.trim() || undefined,
        vehicleNumber: ledgerVehicleNumber.trim() || undefined,
        rentalType: selectedRentalType ?? undefined,
        payerType: selectedPayerType ?? undefined,
        status: ledgerStatus === 'all' ? undefined : ledgerStatus,
      });
      triggerCsvDownload(`billing-ledger-${ledgerDateRange.from}-${ledgerDateRange.to}.csv`, csv);
    } catch (error) {
      setLedgerError(error instanceof Error ? error.message : '정산 원장 CSV 다운로드에 실패했습니다.');
    } finally {
      setIsLedgerCsvDownloading(false);
    }
  }, [ledgerDateRange.from, ledgerDateRange.to, ledgerReservationId, ledgerStatus, ledgerVehicleNumber, selectedPayerType, selectedRentalType]);

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
        <div className="mx-2 hidden h-6 w-px bg-gray-200 md:block" />
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-600">
          집계:
          <select
            value={selectedGranularity}
            onChange={(event) => updateRevenueSearchParams({ granularity: event.target.value })}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {GRANULARITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-600">
          계약유형:
          <select
            value={selectedRentalType ?? 'all'}
            onChange={(event) => updateRevenueSearchParams({
              rentalType: event.target.value === 'all' ? null : event.target.value,
            })}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {RENTAL_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-600">
          지급책임자:
          <select
            value={selectedPayerType ?? 'all'}
            onChange={(event) => updateRevenueSearchParams({
              payerType: event.target.value === 'all' ? null : event.target.value,
            })}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {PAYER_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        {isSuperAdmin ? (
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-600">
            회사:
            <select
              value={selectedCompanyId ?? 'all'}
              disabled={isCompanyOptionsLoading || companyOptionsError !== null}
              onChange={(event) => updateRevenueSearchParams({
                companyId: event.target.value === 'all' ? null : event.target.value,
              })}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="all">전체 회사</option>
              {companyOptions.map((option) => (
                <option key={option.companyId} value={option.companyId}>{option.name}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <PageStateBoundary
        isLoading={isLoading}
        error={blockingError}
        isEmpty={activeTab === 'summary' && isEmpty}
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
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3">
            {([
              ['summary', '요약'],
              ['ledger', '정산 원장'],
            ] as Array<[RevenueTab, string]>).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'ledger' ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1 text-sm font-semibold text-gray-600">
                    예약번호
                    <input
                      value={ledgerReservationId}
                      onChange={(event) => setLedgerReservationId(event.target.value)}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      placeholder="R-..."
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-semibold text-gray-600">
                    차량번호
                    <input
                      value={ledgerVehicleNumber}
                      onChange={(event) => setLedgerVehicleNumber(event.target.value)}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      placeholder="12가3456"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-semibold text-gray-600">
                    상태
                    <select
                      value={ledgerStatus}
                      onChange={(event) => setLedgerStatus(event.target.value)}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      {LEDGER_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => void loadLedger()}
                    disabled={isLedgerLoading}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLedgerLoading ? '조회 중...' : '정산 원장 조회'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDownloadLedgerCsv()}
                    disabled={isLedgerCsvDownloading || isLedgerLoading}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLedgerCsvDownloading ? '다운로드 중...' : 'CSV 다운로드'}
                  </button>
                </div>
                {ledgerError && (
                  <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{ledgerError}</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                {[
                  ['총 청구', ledgerData?.totals.chargeAmount ?? 0],
                  ['수납액', ledgerData?.totals.paymentAmount ?? 0],
                  ['미수액', ledgerData?.totals.remainingAmount ?? 0],
                  ['청구 건수', ledgerData?.totals.chargeCount ?? 0],
                  ['수납 건수', ledgerData?.totals.paymentCount ?? 0],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-white p-4 shadow-sm">
                    <span className="text-xs font-semibold text-gray-500">{label}</span>
                    <p className="mt-1 text-lg font-bold text-gray-900">
                      {typeof value === 'number' && String(label).includes('건수')
                        ? `${value.toLocaleString('ko-KR')}건`
                        : formatCurrency(Number(value), summaryTotals.currency)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-base font-bold text-gray-900">기간별 정산 원장</h3>
                  <span className="text-sm text-gray-500">총 {(ledgerData?.total ?? 0).toLocaleString('ko-KR')}건</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-gray-500">
                        <th className="px-3 py-3 font-medium">구분</th>
                        <th className="px-3 py-3 font-medium">일자</th>
                        <th className="px-3 py-3 font-medium">예약</th>
                        <th className="px-3 py-3 font-medium">차량</th>
                        <th className="px-3 py-3 font-medium">유형</th>
                        <th className="px-3 py-3 font-medium">청구처</th>
                        <th className="px-3 py-3 text-right font-medium">금액</th>
                        <th className="px-3 py-3 text-right font-medium">수납</th>
                        <th className="px-3 py-3 text-right font-medium">잔액</th>
                        <th className="px-3 py-3 font-medium">상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerData?.items.length ? (
                        ledgerData.items.map((item) => (
                          <tr key={`${item.entryType}-${item.id}`} className="border-b border-gray-50 last:border-b-0">
                            <td className="px-3 py-3 font-semibold text-gray-900">{getLedgerEntryTypeLabel(item.entryType)}</td>
                            <td className="px-3 py-3 text-gray-700">{item.eventDate ? formatDateKst(item.eventDate, '-') : '-'}</td>
                            <td className="px-3 py-3 text-gray-700">{item.reservationId || '-'}</td>
                            <td className="px-3 py-3 text-gray-700">{item.vehicleNumber || '-'}</td>
                            <td className="px-3 py-3 text-gray-700">{getRentalTypeLabel(item.rentalType)}</td>
                            <td className="px-3 py-3 text-gray-700">{getPayerTypeLabel(item.payerType)}</td>
                            <td className="px-3 py-3 text-right font-semibold text-gray-900">{formatCurrency(item.amount, summaryTotals.currency)}</td>
                            <td className="px-3 py-3 text-right text-emerald-700">{formatCurrency(item.paidAmount, summaryTotals.currency)}</td>
                            <td className="px-3 py-3 text-right text-red-600">{formatCurrency(item.remainingAmount, summaryTotals.currency)}</td>
                            <td className="px-3 py-3 text-gray-700">{item.status || '-'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={10} className="px-3 py-8 text-center text-gray-500">
                            조회 기간에 정산 원장 데이터가 없습니다
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <>
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
                  {paymentMethodSlices.length > 0 ? (
                    paymentMethodSlices.map((slice) => (
                      <div key={slice.name} className="space-y-1">
                        <div className="flex items-center justify-between text-sm font-medium text-gray-700">
                          <span>{slice.name}</span>
                          <span>{formatPercent(slice.percentage)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100">
                          <div
                            className={`h-2 rounded-full ${slice.tone}`}
                            style={{ width: `${slice.percentage}%` }}
                          />
                        </div>
                        <p className="text-sm text-gray-500">
                          {formatWanCurrency(slice.amount)} · {slice.count.toLocaleString('ko-KR')}건
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
                      결제 수단별 매출 데이터가 없습니다
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-base font-bold text-gray-900">렌트 유형별 매출</h3>
              <div className="space-y-3">
                {rentalTypeRows.length > 0 ? (
                  rentalTypeRows.map((row) => (
                    <div key={row.label} className="space-y-1">
                      <div className="flex items-center justify-between text-sm font-medium text-gray-700">
                        <span>{row.label}</span>
                        <span>{formatPercent(row.percentage)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100">
                        <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${row.percentage}%` }} />
                      </div>
                      <p className="text-sm text-gray-500">{formatWanCurrency(row.amount)} · {row.count.toLocaleString('ko-KR')}건</p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">렌트 유형별 매출 데이터가 없습니다</p>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-base font-bold text-gray-900">청구 주체별 매출</h3>
              <div className="space-y-3">
                {payerTypeRows.length > 0 ? (
                  payerTypeRows.map((row) => (
                    <div key={row.label} className="space-y-1">
                      <div className="flex items-center justify-between text-sm font-medium text-gray-700">
                        <span>{row.label}</span>
                        <span>{formatPercent(row.percentage)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100">
                        <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${row.percentage}%` }} />
                      </div>
                      <p className="text-sm text-gray-500">{formatWanCurrency(row.amount)} · {row.count.toLocaleString('ko-KR')}건</p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">청구 주체별 매출 데이터가 없습니다</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-base font-bold text-gray-900">차종별 매출 현황</h3>
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
                  {modelRows.length > 0 ? (
                    modelRows.map((row) => (
                      <tr key={`${row.model}-${row.rank}`} className="border-b border-gray-50 last:border-b-0">
                        <td className="px-3 py-3 text-gray-700">{row.rank}</td>
                        <td className="px-3 py-3 font-medium text-gray-900">{row.model}</td>
                        <td className="px-3 py-3 text-gray-700">{formatWanCurrency(row.revenue)}</td>
                        <td className="px-3 py-3 text-gray-700">{row.reservationCount.toLocaleString('ko-KR')}건</td>
                        <td className="px-3 py-3 text-gray-700">{formatPercent(row.utilizationRate)}</td>
                        <td className="px-3 py-3 text-gray-700">{formatPercent(row.shareRate)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                        차종별 매출 데이터가 없습니다
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
            </>
          )}
        </div>
      </PageStateBoundary>
    </Layout>
  );
}
