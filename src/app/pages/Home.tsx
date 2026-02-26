import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  Calendar,
  Car,
  ClipboardCheck,
  Clock,
  DollarSign,
  FileText,
  Lock,
  MessageSquare,
  RefreshCw,
  Shield,
  Signal,
  Sparkles,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { toast } from 'sonner';

import { ApiError } from '../../services/api';
import { getHomeSummary, type HomeSummaryResponse } from '../../services/home';
import { ROUTE_PERMISSIONS, type AppRoutePermission } from '../authorization';
import { Layout } from '../components/Layout';
import { PageStateBoundary } from '../components/PageStateBoundary';
import { useAuthorization } from '../context/AuthorizationContext';
import { useAuth } from '../context/AuthContext';
import {
  getPageErrorActionLabel,
  handlePageErrorAction,
  type PageErrorKind,
} from '../hooks/usePageEndpointState';

type PeriodPreset = 'last7Days' | 'last30Days' | 'last90Days';

interface HomeFilters {
  preset: PeriodPreset;
}

interface HomeSnapshot {
  summary: HomeSummaryResponse;
  filters: HomeFilters;
}

interface HomePageError {
  kind: PageErrorKind;
  message: string;
}

interface DashboardDistributionItem {
  name: string;
  value: number;
  color: string;
  status: string;
  unit: '건' | '대';
}

interface HomeStatCard {
  label: string;
  count: number;
  icon: string;
  bg: string;
  color: string;
  onClick: () => void;
  description?: string;
  isPremium?: boolean;
  unit?: string;
}

const PERIOD_OPTIONS: Array<{ value: PeriodPreset; label: string; days: number }> = [
  { value: 'last7Days', label: '최근 7일', days: 7 },
  { value: 'last30Days', label: '최근 30일', days: 30 },
  { value: 'last90Days', label: '최근 90일', days: 90 },
];

const PERIOD_DAYS_BY_PRESET: Record<PeriodPreset, number> = {
  last7Days: 7,
  last30Days: 30,
  last90Days: 90,
};

const DEFAULT_ALERTS = {
  overdue: 0,
  stolen: 0,
};

const DEFAULT_KPIS = {
  totalAssets: 0,
  totalContracts: 0,
  activeContracts: 0,
  completedContracts: 0,
  overdueContracts: 0,
  utilizationRate: 0,
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

function toPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(Math.max(0, Math.min(1, value)) * 100);
}

function toPageErrorState(error: unknown): HomePageError {
  if (error instanceof ApiError) {
    const errorCode = typeof error.code === 'string' ? error.code : '';

    if (error.status === 400) {
      return {
        kind: 'unknown',
        message: error.message
          ? `조회 조건 오류: ${error.message}`
          : '조회 기간/회사 정보를 확인해 주세요.',
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
        message: '홈 데이터 조회 권한이 없습니다. 관리자에게 권한을 요청해 주세요.',
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

function sumByKeys(map: Record<string, number>, keys: string[]): number {
  return keys.reduce((sum, key) => sum + Math.max(0, Math.trunc(map[key] ?? 0)), 0);
}

function toContractFilter(statusLabel: string): string {
  const normalized = statusLabel.trim().toLowerCase();
  if (!normalized) {
    return 'all';
  }
  if (normalized.includes('예약')) {
    return 'reservation';
  }
  if (normalized.includes('대여')) {
    return 'rental';
  }
  if (normalized.includes('반납') || normalized.includes('완료')) {
    return 'return';
  }
  if (normalized.includes('미납') || normalized.includes('연체')) {
    return 'unpaid';
  }
  return 'all';
}

function toAssetStatusFilter(stageLabel: string): string {
  const normalized = stageLabel.trim().toLowerCase();
  if (!normalized) {
    return '';
  }
  if (normalized.includes('정비') || normalized.includes('점검') || normalized.includes('수리')) {
    return 'maintenance';
  }
  if (normalized.includes('예약') || normalized.includes('출고')) {
    return 'reserved';
  }
  if (normalized.includes('운영') || normalized.includes('대여')) {
    return 'rental';
  }
  if (normalized.includes('가용') || normalized.includes('대기')) {
    return 'available';
  }
  return '';
}

function isSnapshotEmpty(snapshot: HomeSnapshot): boolean {
  const { kpis, statusCounts, recentChanges } = snapshot.summary;
  const hasKpiData = (
    kpis.totalAssets > 0
    || kpis.totalContracts > 0
    || kpis.activeContracts > 0
    || kpis.completedContracts > 0
    || kpis.overdueContracts > 0
    || kpis.utilizationRate > 0
  );

  if (hasKpiData) {
    return false;
  }

  const hasContractStatus = Object.values(statusCounts.contractStatus).some((count) => count > 0);
  const hasManagementStage = Object.values(statusCounts.managementStage).some((count) => count > 0);
  const hasAlerts = statusCounts.alerts.overdue > 0 || statusCounts.alerts.stolen > 0;

  return !hasContractStatus && !hasManagementStage && !hasAlerts && recentChanges.length === 0;
}

function toRelativeTimeLabel(value: string): string {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  const diffMs = Date.now() - parsedDate.getTime();
  if (diffMs < 60_000) {
    return '방금 전';
  }
  if (diffMs < 3_600_000) {
    return `${Math.floor(diffMs / 60_000)}분 전`;
  }
  if (diffMs < 86_400_000) {
    return `${Math.floor(diffMs / 3_600_000)}시간 전`;
  }
  return parsedDate.toLocaleDateString('ko-KR');
}

function toRecentChangeLabel(type: string): string {
  if (type === 'reservation_created') {
    return '예약 등록';
  }
  if (type === 'reservation_updated') {
    return '예약 변경';
  }
  if (type === 'reservation_returned') {
    return '반납 완료';
  }
  return '상태 변경';
}

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canAccessRoute } = useAuthorization();
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<PeriodPreset>('last30Days');

  const [snapshot, setSnapshot] = useState<HomeSnapshot | null>(null);
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
  const snapshotRef = useRef<HomeSnapshot | null>(null);
  const skipNextAutoHydrateRef = useRef(false);

  const tenantId = user?.companyId?.trim() ?? '';

  useEffect(() => () => {
    mountedRef.current = false;
    controllerRef.current?.abort();
  }, []);

  const hydrateHome = useCallback(async (filters: HomeFilters) => {
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

    if (!tenantId) {
      const pageError: HomePageError = {
        kind: 'unknown',
        message: '회사(tenant) 정보가 없어 홈 요약을 조회할 수 없습니다. 다시 로그인해 주세요.',
      };
      if (hasSnapshot) {
        setRefreshError(pageError.message);
        setRefreshErrorKind(pageError.kind);
      } else {
        setBlockingError(pageError.message);
        setBlockingErrorKind(pageError.kind);
        setIsEmpty(false);
      }
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    const { from, to } = resolveDateRange(filters.preset);

    try {
      const summary = await getHomeSummary({
        from,
        to,
        tenantId,
        signal: controller.signal,
      });

      if (
        !mountedRef.current
        || requestSequenceRef.current !== requestSequence
        || controller.signal.aborted
      ) {
        return;
      }

      const nextSnapshot: HomeSnapshot = {
        summary,
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

        if (previousSnapshot.filters.preset !== filters.preset) {
          skipNextAutoHydrateRef.current = true;
          setSelectedPreset(previousSnapshot.filters.preset);
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
  }, [tenantId]);

  useEffect(() => {
    if (skipNextAutoHydrateRef.current) {
      skipNextAutoHydrateRef.current = false;
      return;
    }

    void hydrateHome({
      preset: selectedPreset,
    });
  }, [hydrateHome, selectedPreset]);

  const handleRetry = useCallback(() => {
    void hydrateHome({
      preset: selectedPreset,
    });
  }, [hydrateHome, selectedPreset]);

  const handleBlockingErrorAction = useCallback(() => {
    handlePageErrorAction(blockingErrorKind, navigate);
  }, [blockingErrorKind, navigate]);

  const handleRefreshErrorAction = useCallback(() => {
    handlePageErrorAction(refreshErrorKind, navigate);
  }, [navigate, refreshErrorKind]);

  const navigateWithRoutePermission = useCallback((path: string, routePermission: AppRoutePermission) => {
    if (!canAccessRoute(routePermission)) {
      toast.error('접근 권한이 없어 이동할 수 없습니다.');
      navigate('/forbidden');
      return;
    }
    navigate(path);
  }, [canAccessRoute, navigate]);

  const summary = snapshot?.summary;
  const contractStatusCounts = summary?.statusCounts.contractStatus ?? {};
  const managementStageCounts = summary?.statusCounts.managementStage ?? {};
  const alerts = summary?.statusCounts.alerts ?? DEFAULT_ALERTS;
  const kpis = summary?.kpis ?? DEFAULT_KPIS;

  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    Car,
    Calendar,
    FileText,
    Clock,
    AlertCircle,
    Wrench,
    Shield,
    AlertTriangle,
    MessageSquare,
    AlertOctagon,
    ClipboardCheck,
    DollarSign,
    Signal,
    TrendingUp,
  };

  const handleTaskClick = useCallback((filter: string) => {
    navigateWithRoutePermission(
      `/reservations?filter=${encodeURIComponent(filter)}`,
      ROUTE_PERMISSIONS.reservations,
    );
  }, [navigateWithRoutePermission]);

  const handleIssueClick = useCallback((filter: string) => {
    navigateWithRoutePermission(
      `/action-required?filter=${encodeURIComponent(filter)}`,
      ROUTE_PERMISSIONS.actionRequired,
    );
  }, [navigateWithRoutePermission]);

  const handleAssetClick = useCallback((status: string) => {
    if (!status) {
      navigateWithRoutePermission('/assets', ROUTE_PERMISSIONS.assets);
      return;
    }
    navigateWithRoutePermission(
      `/assets?status=${encodeURIComponent(status)}`,
      ROUTE_PERMISSIONS.assets,
    );
  }, [navigateWithRoutePermission]);

  const handleContractClick = useCallback((status: string) => {
    navigateWithRoutePermission(
      `/reservations?filter=${encodeURIComponent(status)}`,
      ROUTE_PERMISSIONS.reservations,
    );
  }, [navigateWithRoutePermission]);

  const todayStats = useMemo(() => {
    const reservationCount = sumByKeys(contractStatusCounts, ['예약중', '예약']);
    const rentalCount = sumByKeys(contractStatusCounts, ['대여중']) || kpis.activeContracts;
    const returnCount = sumByKeys(contractStatusCounts, ['반납완료', '완료']) || kpis.completedContracts;

    return [
      {
        label: '예약중',
        count: reservationCount,
        icon: 'Calendar',
        filter: 'reservation',
      },
      {
        label: '대여중',
        count: rentalCount,
        icon: 'Car',
        filter: 'rental',
      },
      {
        label: '반납완료',
        count: returnCount,
        icon: 'FileText',
        filter: 'return',
      },
    ];
  }, [contractStatusCounts, kpis.activeContracts, kpis.completedContracts]);

  const actionItemsForHome = useMemo<HomeStatCard[]>(() => {
    const operatingAssets = sumByKeys(managementStageCounts, ['운영중']);
    const maintenanceAssets = sumByKeys(managementStageCounts, ['점검대기', '정비중']);

    return [
      {
        label: '반납 지연',
        count: alerts.overdue,
        bg: 'bg-red-50',
        color: 'text-red-600',
        icon: 'AlertCircle',
        onClick: () => handleIssueClick('반납 지연'),
      },
      {
        label: '미납/연체 계약',
        count: kpis.overdueContracts,
        bg: 'bg-yellow-50',
        color: 'text-yellow-600',
        icon: 'DollarSign',
        onClick: () => handleContractClick('unpaid'),
      },
      {
        label: '운영중 자산',
        count: operatingAssets,
        bg: 'bg-blue-50',
        color: 'text-blue-600',
        icon: 'Shield',
        onClick: () => handleAssetClick('rental'),
      },
      {
        label: '점검 대상 자산',
        count: maintenanceAssets,
        bg: 'bg-blue-50',
        color: 'text-blue-600',
        icon: 'ClipboardCheck',
        onClick: () => handleAssetClick('maintenance'),
      },
      {
        label: '총 계약',
        count: kpis.totalContracts,
        bg: 'bg-indigo-50',
        color: 'text-indigo-600',
        icon: 'FileText',
        onClick: () => handleContractClick('all'),
      },
      {
        label: '활용률',
        count: toPercent(kpis.utilizationRate),
        bg: 'bg-green-50',
        color: 'text-green-600',
        icon: 'TrendingUp',
        unit: '%',
        onClick: () => {},
      },
      {
        label: '도난 의심',
        count: alerts.stolen,
        bg: 'bg-orange-50',
        color: 'text-orange-600',
        icon: 'AlertOctagon',
        isPremium: true,
        description: '단말 장착 차량만',
        onClick: () => setShowPremiumModal(true),
      },
      {
        label: '단말 OFF',
        count: 0,
        bg: 'bg-orange-50',
        color: 'text-orange-600',
        icon: 'Signal',
        isPremium: true,
        description: '단말 장착 차량만',
        onClick: () => setShowPremiumModal(true),
      },
    ];
  }, [alerts.overdue, alerts.stolen, handleAssetClick, handleContractClick, handleIssueClick, kpis.overdueContracts, kpis.totalContracts, kpis.utilizationRate, managementStageCounts]);

  const assetData = useMemo<DashboardDistributionItem[]>(() => {
    const palette = ['#1e3a8a', '#60a5fa', '#22c55e', '#f59e0b'];
    const entries = Object.entries(managementStageCounts)
      .filter(([name]) => name.trim().length > 0)
      .sort((left, right) => right[1] - left[1]);

    if (entries.length === 0) {
      return [
        { name: '운영중', value: kpis.activeContracts, color: palette[0], status: 'rental', unit: '대' },
        { name: '가용', value: Math.max(0, kpis.totalAssets - kpis.activeContracts), color: palette[1], status: 'available', unit: '대' },
        { name: '점검대기', value: 0, color: palette[2], status: 'maintenance', unit: '대' },
      ];
    }

    return entries.slice(0, 4).map(([name, value], index) => ({
      name,
      value: Math.max(0, Math.trunc(value)),
      color: palette[index % palette.length],
      status: toAssetStatusFilter(name),
      unit: '대' as const,
    }));
  }, [kpis.activeContracts, kpis.totalAssets, managementStageCounts]);

  const contractData = useMemo<DashboardDistributionItem[]>(() => {
    const palette = ['#1e3a8a', '#8b5cf6', '#ef4444', '#22c55e'];
    const entries = Object.entries(contractStatusCounts)
      .filter(([name]) => name.trim().length > 0)
      .sort((left, right) => right[1] - left[1]);

    if (entries.length === 0) {
      return [
        { name: '대여중', value: kpis.activeContracts, color: palette[0], status: 'rental', unit: '건' },
        { name: '반납완료', value: kpis.completedContracts, color: palette[1], status: 'return', unit: '건' },
        { name: '연체', value: kpis.overdueContracts, color: palette[2], status: 'unpaid', unit: '건' },
      ];
    }

    return entries.slice(0, 4).map(([name, value], index) => ({
      name,
      value: Math.max(0, Math.trunc(value)),
      color: palette[index % palette.length],
      status: toContractFilter(name),
      unit: '건' as const,
    }));
  }, [contractStatusCounts, kpis.activeContracts, kpis.completedContracts, kpis.overdueContracts]);

  const operationScores = useMemo(() => {
    const utilizationRateScore = toPercent(kpis.utilizationRate);
    const completionRateScore = kpis.totalContracts > 0
      ? Math.round((kpis.completedContracts / kpis.totalContracts) * 100)
      : 0;
    const safetyScore = kpis.totalContracts > 0
      ? Math.round(Math.max(0, 1 - (kpis.overdueContracts / kpis.totalContracts)) * 100)
      : 0;

    return [
      { label: '자산 활용률', score: utilizationRateScore, color: 'bg-blue-500' },
      { label: '계약 완료율', score: completionRateScore, color: 'bg-green-500' },
      { label: '연체 안전도', score: safetyScore, color: 'bg-orange-500' },
    ];
  }, [kpis.completedContracts, kpis.overdueContracts, kpis.totalContracts, kpis.utilizationRate]);

  const recentChanges = useMemo(() => (
    (summary?.recentChanges ?? []).slice(0, 5)
  ), [summary?.recentChanges]);

  const periodLabel = useMemo(() => {
    if (!summary) {
      return null;
    }
    return `${summary.from} ~ ${summary.to}`;
  }, [summary]);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: DashboardDistributionItem }> }) => {
    if (!active || !payload || payload.length === 0) {
      return null;
    }

    const data = payload[0];
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-lg">
        <p className="mb-1 font-bold text-gray-900">{data.name}</p>
        <p className="text-lg font-bold" style={{ color: data.payload.color }}>
          {data.value.toLocaleString()}
          {data.payload.unit}
        </p>
        <p className="mt-1 text-xs text-gray-500">클릭하여 상세보기</p>
      </div>
    );
  };

  const premiumVehiclePreviewCount = Math.max(1, kpis.totalAssets);

  return (
    <Layout title="홈">
      <PageStateBoundary
        isLoading={isLoading}
        error={blockingError}
        isEmpty={isEmpty}
        errorDescription="홈 요약 데이터를 불러오는 중 문제가 발생했습니다."
        emptyTitle="조회 기간에 표시할 홈 데이터가 없습니다"
        emptyDescription="기간을 변경하거나 다시 조회해 주세요."
        onRetry={handleRetry}
        errorActionLabel={getPageErrorActionLabel(blockingErrorKind)}
        onErrorAction={handleBlockingErrorAction}
        emptyActionLabel="다시 불러오기"
        onEmptyAction={handleRetry}
        className="m-6 min-h-[320px]"
      >
        <div className="space-y-5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-[#1e2939]">Home Summary</h2>
              <p className="text-xs text-gray-500">
                {periodLabel ? `${periodLabel} · tenant: ${summary?.tenantId}` : '조회 기간을 선택해 주세요.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedPreset(option.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    option.value === selectedPreset
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  disabled={isRefreshing}
                >
                  {option.label}
                </button>
              ))}
              <button
                type="button"
                onClick={handleRetry}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100"
              >
                다시 조회
              </button>
            </div>
          </div>

          {(isRefreshing || refreshError) && (
            <div className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs ${
              refreshError
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-blue-200 bg-blue-50 text-blue-700'
            }`}>
              <span className="inline-flex items-center gap-2">
                {isRefreshing && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                {refreshError ?? '최신 홈 요약 데이터를 동기화하는 중입니다.'}
              </span>
              {refreshError && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="rounded-md border border-amber-300 bg-white px-2 py-1 font-semibold text-amber-700 hover:bg-amber-100"
                  >
                    다시 시도
                  </button>
                  {refreshErrorKind && getPageErrorActionLabel(refreshErrorKind) && (
                    <button
                      type="button"
                      onClick={handleRefreshErrorAction}
                      className="rounded-md border border-amber-300 bg-white px-2 py-1 font-semibold text-amber-700 hover:bg-amber-100"
                    >
                      {getPageErrorActionLabel(refreshErrorKind)}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-bold text-[#1e2939]">기간 핵심 지표</h2>

            <div className="grid grid-cols-[340px_1fr] gap-4">
              <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
                {todayStats.map((task, index) => {
                  const Icon = iconMap[task.icon];
                  return (
                    <div
                      key={index}
                      onClick={() => handleTaskClick(task.filter)}
                      className="flex cursor-pointer items-center justify-between rounded-lg p-3 transition-colors hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                          <Icon className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-xs text-[#4a5565]">{task.label}</p>
                          <p className="mt-0.5 text-2xl font-bold text-[#101828]">{task.count.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-4 gap-3">
                {actionItemsForHome.map((issue, index) => {
                  const Icon = iconMap[issue.icon];

                  if (issue.isPremium) {
                    return (
                      <div
                        key={index}
                        onClick={issue.onClick}
                        className={`${issue.bg} relative cursor-pointer rounded-xl p-3 transition-shadow hover:shadow-md`}
                      >
                        <div className="mb-2 flex items-start justify-between">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
                            <Icon className={`h-4 w-4 ${issue.color}`} />
                          </div>
                          <Lock className="h-3.5 w-3.5 text-gray-500" />
                        </div>
                        <p className="mb-0.5 text-2xl font-bold text-[#101828]">{issue.count.toLocaleString()}</p>
                        <p className="mb-1 text-xs text-[#4a5565]">{issue.label}</p>
                        <p className="text-[10px] leading-tight text-gray-500">{issue.description}</p>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={index}
                      onClick={issue.onClick}
                      className={`${issue.bg} cursor-pointer rounded-xl p-3 transition-shadow hover:shadow-md`}
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
                          <Icon className={`h-4 w-4 ${issue.color}`} />
                        </div>
                      </div>
                      <p className="mb-0.5 text-2xl font-bold text-[#101828]">
                        {issue.count.toLocaleString()}
                        {issue.unit ?? ''}
                      </p>
                      <p className="text-xs text-[#4a5565]">{issue.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-xl font-bold text-[#1e2939]">운영 대시보드</h2>

            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-[#1e2939]">자산 운영 분포</h3>
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={170}>
                    <PieChart>
                      <Pie
                        data={assetData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                        onClick={(data) => handleAssetClick(data.status)}
                        className="cursor-pointer"
                      >
                        {assetData.map((entry, index) => (
                          <Cell
                            key={`asset-cell-${index}`}
                            fill={entry.color}
                            style={{ cursor: 'pointer' }}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="mt-3 grid w-full grid-cols-2 gap-2">
                    {assetData.map((item, index) => (
                      <button
                        key={index}
                        onClick={() => handleAssetClick(item.status)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-gray-100"
                      >
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-xs font-medium text-gray-700">{item.name}</span>
                        <span className="ml-auto text-xs text-gray-500">{item.value.toLocaleString()}대</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-[#1e2939]">계약 상태 분포</h3>
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={170}>
                    <PieChart>
                      <Pie
                        data={contractData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                        onClick={(data) => handleContractClick(data.status)}
                        className="cursor-pointer"
                      >
                        {contractData.map((entry, index) => (
                          <Cell
                            key={`contract-cell-${index}`}
                            fill={entry.color}
                            style={{ cursor: 'pointer' }}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="mt-3 grid w-full grid-cols-2 gap-2">
                    {contractData.map((item, index) => (
                      <button
                        key={index}
                        onClick={() => handleContractClick(item.status)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-gray-100"
                      >
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-xs font-medium text-gray-700">{item.name}</span>
                        <span className="ml-auto text-xs text-gray-500">{item.value.toLocaleString()}건</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-[#1e2939]">운영 점수</h3>
                <div className="mt-6 space-y-5">
                  {operationScores.map((item, index) => (
                    <div key={index}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs text-[#4a5565]">{item.label}</span>
                        <span className="text-base font-bold text-[#1e2939]">{item.score}점</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-200">
                        <div
                          className={`${item.color} h-2 rounded-full transition-all`}
                          style={{ width: `${item.score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 border-t border-gray-100 pt-4">
                  <h4 className="mb-2 text-xs font-semibold text-gray-600">최근 변경</h4>
                  <ul className="space-y-2">
                    {recentChanges.length > 0 && recentChanges.map((change) => (
                      <li
                        key={`${change.type}-${change.reservationId}-${change.timestamp}`}
                        className="rounded-lg border border-gray-100 px-2 py-1.5 text-xs text-gray-600"
                      >
                        <p className="font-medium text-gray-800">
                          {toRecentChangeLabel(change.type)} · {change.contractStatus || '상태 미확인'}
                        </p>
                        <p className="mt-0.5">
                          {change.reservationId} · {toRelativeTimeLabel(change.timestamp)}
                        </p>
                      </li>
                    ))}
                    {recentChanges.length === 0 && (
                      <li className="text-xs text-gray-500">해당 기간의 변경 이력이 없습니다.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
            <div className="absolute -mr-32 -mt-32 h-64 w-64 rounded-full bg-blue-200 opacity-20 blur-3xl"></div>

            <div className="relative z-10">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="h-6 w-6 text-blue-600" />
                    <h3 className="text-xl font-bold text-[#1e2939]">실시간 차량 모니터링</h3>
                    <span className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1 text-xs font-bold text-white">
                      PREMIUM
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    지금 <span className="font-bold text-blue-600">{premiumVehiclePreviewCount.toLocaleString()}대 차량</span>을 실시간으로 추적할 수 있습니다
                  </p>
                </div>
                <button
                  onClick={() => setShowPremiumModal(true)}
                  className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-bold text-white transition-shadow hover:shadow-lg"
                >
                  프리미엄 시작하기
                </button>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="relative rounded-lg bg-white p-4">
                  <div className="absolute inset-0 rounded-lg bg-white/50 backdrop-blur-sm"></div>
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                      <AlertOctagon className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">도난 의심 알림</p>
                      <p className="text-xl font-bold text-gray-900">실시간 감지</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">차량 위치 이상 즉시 알림</p>
                </div>

                <div className="relative rounded-lg bg-white p-4">
                  <div className="absolute inset-0 rounded-lg bg-white/50 backdrop-blur-sm"></div>
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                      <Signal className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">단말 상태 모니터링</p>
                      <p className="text-xl font-bold text-gray-900">24/7 추적</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">GPS 신호 끊김 즉시 확인</p>
                </div>

                <div className="relative rounded-lg bg-white p-4">
                  <div className="absolute inset-0 rounded-lg bg-white/50 backdrop-blur-sm"></div>
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                      <Wrench className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">차량 이상 감지</p>
                      <p className="text-xl font-bold text-gray-900">사전 예방</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">고장 전 미리 파악</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageStateBoundary>

      {showPremiumModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowPremiumModal(false)}>
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-8" onClick={(event) => event.stopPropagation()}>
            <button
              onClick={() => setShowPremiumModal(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-gray-100"
            >
              ×
            </button>

            <div className="mb-8 text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <h2 className="mb-2 text-3xl font-bold text-[#1e2939]">프리미엄으로 업그레이드</h2>
              <p className="text-gray-600">단말 설치로 차량을 실시간으로 모니터링하세요</p>
            </div>

            <div className="mb-8 space-y-4">
              <div className="flex items-start gap-4 rounded-lg bg-red-50 p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-red-100">
                  <AlertOctagon className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="mb-1 font-bold text-gray-900">도난 의심 실시간 알림</h3>
                  <p className="text-sm text-gray-600">차량 위치 이상 감지 시 즉시 알림을 받아 피해를 최소화하세요</p>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-lg bg-orange-50 p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-orange-100">
                  <Signal className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="mb-1 font-bold text-gray-900">단말 OFF 모니터링</h3>
                  <p className="text-sm text-gray-600">GPS 신호 끊김을 즉시 확인하여 차량 추적 손실을 방지하세요</p>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-lg bg-orange-50 p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-orange-100">
                  <Wrench className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="mb-1 font-bold text-gray-900">차량 이상 사전 감지</h3>
                  <p className="text-sm text-gray-600">고장이 발생하기 전에 미리 파악하여 정비 비용을 절감하세요</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPremiumModal(false)}
                className="flex-1 rounded-lg border-2 border-gray-300 px-6 py-3 font-bold text-gray-700 transition-colors hover:bg-gray-50"
              >
                나중에
              </button>
              <button
                onClick={() => {
                  setShowPremiumModal(false);
                  alert('프리미엄 문의: 1588-XXXX');
                }}
                className="flex-1 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-bold text-white transition-shadow hover:shadow-lg"
              >
                지금 시작하기
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
