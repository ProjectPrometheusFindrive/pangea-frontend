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
import { getActionItemTypeCounts } from '../../services/actionRequired';
import { getHomeSummary, type HomeSummaryResponse } from '../../services/home';
import { ROUTE_PERMISSIONS, type AppRoutePermission } from '../authorization';
import { Layout } from '../components/Layout';
import { PageStateBoundary } from '../components/PageStateBoundary';
import { useAuthorization } from '../context/AuthorizationContext';
import { useAuth } from '../context/AuthContext';
import { navigateToPremiumInquiry } from '../utils/premiumInquiry';
import {
  getPageErrorActionLabel,
  handlePageErrorAction,
  type PageErrorKind,
} from '../hooks/usePageEndpointState';
import { shouldShowDashboardCompanySelector } from './dashboardCompanyScope';

interface HomeFilters {
  companyId: string | null;
}

interface HomeSnapshot {
  summary: HomeSummaryResponse;
  actionItemCountsByType: Record<string, number>;
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

interface HomeTodayTaskCard {
  label: string;
  count: number | string;
  icon: string;
  filter: 'pickup' | 'rental' | 'return';
  testId: string;
  unit?: string;
}

interface HomeStatCard {
  label: string;
  count: number | string;
  icon: string;
  bg: string;
  color: string;
  onClick: () => void;
  testId: string;
  description?: string;
  unit?: string;
}

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
  unpaidContracts: 0,
  utilizationRate: 0,
};

const DEFAULT_TODAY = {
  pickupDueCount: 0,
  returnDueCount: 0,
  overdueCount: 0,
};

const DEFAULT_ACTION_ITEM_COUNTS = {
  '반납 지연': 0,
  '미납/결제 문제': 0,
  '보험 만료 임박': 0,
  '정기점검 만료 임박': 0,
  '사고 접수': 0,
  '차량이상': 0,
  '도난 의심': 0,
  '단말 OFF': 0,
} as const;

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resolveTodayRange(): { from: string; to: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return {
    from: toIsoDate(today),
    to: toIsoDate(today),
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
          : '회사 정보를 확인해 주세요.',
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

function toCanonicalAssetBucketName(stageLabel: string): string {
  const normalized = stageLabel.trim().toLowerCase();
  if (!normalized) {
    return '';
  }
  if (normalized.includes('정비') || normalized.includes('점검') || normalized.includes('수리')) {
    return '정비중';
  }
  if (normalized.includes('예약') || normalized.includes('출고')) {
    return '예약';
  }
  if (normalized.includes('운영') || normalized.includes('대여')) {
    return '대여중';
  }
  if (normalized.includes('가용') || normalized.includes('대기')) {
    return '가용';
  }
  return '';
}

function normalizeAssetBucketCounts(stageCounts: Record<string, number>): Record<string, number> {
  const normalizedCounts: Record<string, number> = {};

  for (const [name, value] of Object.entries(stageCounts)) {
    const canonicalName = toCanonicalAssetBucketName(name);
    if (!canonicalName) {
      continue;
    }
    normalizedCounts[canonicalName] = (normalizedCounts[canonicalName] ?? 0) + Math.max(0, Math.trunc(value));
  }

  return normalizedCounts;
}

function buildReservationsFilterPath(filterValue: string): string {
  const params = new URLSearchParams();

  if (filterValue === 'home-unpaid') {
    params.set('filter', 'unpaid');
    params.set('paymentScope', 'delinquent');
  } else {
    params.set('filter', filterValue);
  }

  return `/reservations?${params.toString()}`;
}

function isSnapshotEmpty(snapshot: HomeSnapshot): boolean {
  const { kpis, statusCounts, recentChanges } = snapshot.summary;
  const hasKpiData = (
    kpis.totalAssets > 0
    || kpis.totalContracts > 0
    || kpis.activeContracts > 0
    || kpis.completedContracts > 0
    || kpis.overdueContracts > 0
    || kpis.unpaidContracts > 0
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

function formatStatCardCount(count: number | string, unit?: string): string {
  if (typeof count === 'number') {
    return `${count.toLocaleString()}${unit ?? ''}`;
  }
  return count;
}

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canAccessRoute } = useAuthorization();
  const [showPremiumModal, setShowPremiumModal] = useState(false);

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
  const isSuperAdmin = shouldShowDashboardCompanySelector(user?.role);
  const filters = useMemo<HomeFilters>(() => ({
    companyId: isSuperAdmin ? null : (user?.companyId ?? null),
  }), [isSuperAdmin, user?.companyId]);

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

    const previousSnapshot = snapshotRef.current;
    const hasSnapshot = previousSnapshot !== null;
    if (hasSnapshot) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setBlockingError(null);
    setBlockingErrorKind(null);
    setRefreshError(null);
    setRefreshErrorKind(null);

    if (!isSuperAdmin && !filters.companyId) {
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

    const { from, to } = resolveTodayRange();

    try {
      const [summaryResult, actionItemCountsResult] = await Promise.allSettled([
        getHomeSummary({
          from,
          to,
          companyId: filters.companyId ?? undefined,
          signal: controller.signal,
        }),
        getActionItemTypeCounts({
          pageSize: 100,
          signal: controller.signal,
        }),
      ]);

      if (summaryResult.status === 'rejected') {
        throw summaryResult.reason;
      }

      if (
        !mountedRef.current
        || requestSequenceRef.current !== requestSequence
        || controller.signal.aborted
      ) {
        return;
      }

      if (actionItemCountsResult.status === 'rejected') {
        const actionItemCountError = toPageErrorState(actionItemCountsResult.reason);
        setRefreshError(
          previousSnapshot
            ? '조치 필요 항목 카운트를 갱신하지 못해 이전 집계값을 유지합니다.'
            : '조치 필요 항목 카운트를 불러오지 못해 기본값으로 표시합니다.',
        );
        setRefreshErrorKind(actionItemCountError.kind);
      }

      const nextSnapshot: HomeSnapshot = {
        summary: summaryResult.value,
        actionItemCountsByType: {
          ...DEFAULT_ACTION_ITEM_COUNTS,
          ...(actionItemCountsResult.status === 'fulfilled'
            ? actionItemCountsResult.value
            : previousSnapshot?.actionItemCountsByType ?? {}),
        },
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
      if (previousSnapshot) {
        setRefreshError(pageError.message);
        setRefreshErrorKind(pageError.kind);
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
  }, [isSuperAdmin]);

  useEffect(() => {
    void hydrateHome(filters);
  }, [filters, hydrateHome]);

  const handleRetry = useCallback(() => {
    void hydrateHome(filters);
  }, [filters, hydrateHome]);

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
  const actionItemCountsByType = useMemo(
    () => ({
      ...DEFAULT_ACTION_ITEM_COUNTS,
      ...(snapshot?.actionItemCountsByType ?? {}),
    }),
    [snapshot?.actionItemCountsByType],
  );
  const contractStatusCounts = summary?.statusCounts.contractStatus ?? {};
  const managementStageCounts = summary?.statusCounts.managementStage ?? {};
  const alerts = summary?.statusCounts.alerts ?? DEFAULT_ALERTS;
  const kpis = summary?.kpis ?? DEFAULT_KPIS;
  const today = summary?.today ?? DEFAULT_TODAY;
  const normalizedManagementStageCounts = useMemo(
    () => normalizeAssetBucketCounts(managementStageCounts),
    [managementStageCounts],
  );

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

  const handleTaskClick = useCallback((target: 'pickup' | 'return' | 'overdue') => {
    const params = new URLSearchParams();
    if (target === 'pickup') {
      const todayDate = toIsoDate(new Date());
      params.set('status', 'reservation');
      params.set('from', todayDate);
      params.set('to', todayDate);
      params.set('due', 'pickup');
    } else if (target === 'return') {
      const todayDate = toIsoDate(new Date());
      params.set('status', 'rental');
      params.set('from', todayDate);
      params.set('to', todayDate);
      params.set('due', 'return');
    } else {
      params.set('filter', 'overdue');
    }

    navigateWithRoutePermission(
      `/reservations?${params.toString()}`,
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
      buildReservationsFilterPath(status),
      ROUTE_PERMISSIONS.reservations,
    );
  }, [navigateWithRoutePermission]);

  const todayStats = useMemo<HomeTodayTaskCard[]>(() => {
    return [
      {
        label: '오늘 예약',
        count: today.pickupDueCount,
        icon: 'Calendar',
        filter: 'pickup' as const,
        testId: 'home-today-card-pickup',
      },
      {
        label: '기간 초과 미반납',
        count: today.overdueCount,
        icon: 'Clock',
        filter: 'overdue' as const,
        testId: 'home-today-card-rental',
      },
      {
        label: '오늘 반납',
        count: today.returnDueCount,
        icon: 'FileText',
        filter: 'return' as const,
        testId: 'home-today-card-return',
      },
    ];
  }, [kpis.activeContracts, today.pickupDueCount, today.returnDueCount]);

  const actionItemsForHome = useMemo<HomeStatCard[]>(() => {
    return [
      {
        label: '반납 지연',
        count: actionItemCountsByType['반납 지연'],
        bg: 'bg-red-50',
        color: 'text-red-600',
        icon: 'AlertCircle',
        onClick: () => handleIssueClick('반납 지연'),
        testId: 'home-issue-card-overdue',
      },
      {
        label: '미납/결제 문제',
        count: actionItemCountsByType['미납/결제 문제'],
        bg: 'bg-yellow-50',
        color: 'text-yellow-600',
        icon: 'DollarSign',
        onClick: () => handleIssueClick('미납/결제 문제'),
        testId: 'home-issue-card-unpaid',
      },
      {
        label: '보험 만료 임박',
        count: actionItemCountsByType['보험 만료 임박'],
        bg: 'bg-sky-50',
        color: 'text-blue-600',
        icon: 'Shield',
        onClick: () => handleIssueClick('보험 만료 임박'),
        testId: 'home-issue-card-insurance',
      },
      {
        label: '점검 만료 임박',
        count: actionItemCountsByType['정기점검 만료 임박'],
        bg: 'bg-blue-50',
        color: 'text-blue-600',
        icon: 'ClipboardCheck',
        onClick: () => handleIssueClick('정기점검 만료 임박'),
        testId: 'home-issue-card-maintenance',
      },
      {
        label: '사고 접수',
        count: actionItemCountsByType['사고 접수'],
        bg: 'bg-red-50',
        color: 'text-red-600',
        icon: 'AlertTriangle',
        onClick: () => handleIssueClick('사고 접수'),
        testId: 'home-issue-card-accident',
      },
      {
        label: '차량이상',
        count: actionItemCountsByType['차량이상'],
        bg: 'bg-orange-50',
        color: 'text-orange-600',
        icon: 'Wrench',
        description: '프리미엄 단말 연동 필요',
        onClick: () => setShowPremiumModal(true),
        testId: 'home-issue-card-vehicle-anomaly',
      },
      {
        label: '단말 OFF',
        count: actionItemCountsByType['단말 OFF'],
        bg: 'bg-orange-50',
        color: 'text-orange-600',
        icon: 'Signal',
        description: '단말 장착 차량만',
        onClick: () => setShowPremiumModal(true),
        testId: 'home-issue-card-device-off',
      },
      {
        label: '도난 의심',
        count: actionItemCountsByType['도난 의심'],
        bg: 'bg-purple-50',
        color: 'text-purple-600',
        icon: 'AlertOctagon',
        description: '단말 장착 차량만',
        onClick: () => handleIssueClick('도난 의심'),
        testId: 'home-issue-card-stolen',
      },
    ];
  }, [actionItemCountsByType, handleIssueClick]);

  const assetData = useMemo<DashboardDistributionItem[]>(() => {
    const palette = ['#1e3a8a', '#60a5fa', '#22c55e', '#f59e0b'];
    const bucketOrder = ['대여중', '예약', '가용', '정비중'];
    const entries = Object.entries(normalizedManagementStageCounts)
      .filter(([, value]) => value > 0)
      .sort((left, right) => bucketOrder.indexOf(left[0]) - bucketOrder.indexOf(right[0]));

    if (entries.length === 0) {
      return [
        { name: '대여중', value: kpis.activeContracts, color: palette[0], status: 'rental', unit: '대' },
        { name: '예약', value: 0, color: palette[1], status: 'reserved', unit: '대' },
        { name: '가용', value: Math.max(0, kpis.totalAssets - kpis.activeContracts), color: palette[2], status: 'available', unit: '대' },
        { name: '정비', value: 0, color: palette[3], status: 'maintenance', unit: '대' },
      ];
    }

    return entries.slice(0, 4).map(([name, value], index) => ({
      name: name === '정비중' ? '정비' : name,
      value: Math.max(0, Math.trunc(value)),
      color: palette[index % palette.length],
      status: toAssetStatusFilter(name),
      unit: '대' as const,
    }));
  }, [kpis.activeContracts, kpis.totalAssets, normalizedManagementStageCounts]);

  const contractData = useMemo<DashboardDistributionItem[]>(() => {
    const palette = ['#1e3a8a', '#8b5cf6', '#ef4444', '#22c55e'];
    const contractOrder = ['대여중', '예약', '미납중', '반납완료'];
    const entries = Object.entries(contractStatusCounts)
      .filter(([name]) => name.trim().length > 0)
      .sort((left, right) => contractOrder.indexOf(left[0]) - contractOrder.indexOf(right[0]));

    if (entries.length === 0) {
      return [
        { name: '대여중', value: kpis.activeContracts, color: palette[0], status: 'rental', unit: '건' },
        { name: '예약', value: 0, color: palette[1], status: 'reservation', unit: '건' },
        { name: '미납중', value: kpis.unpaidContracts, color: palette[2], status: 'home-unpaid', unit: '건' },
        { name: '반납완료', value: kpis.completedContracts, color: palette[3], status: 'return', unit: '건' },
      ];
    }

    return entries.slice(0, 4).map(([name, value], index) => ({
      name,
      value: Math.max(0, Math.trunc(value)),
      color: palette[index % palette.length],
      status: toContractFilter(name),
      unit: '건' as const,
    }));
  }, [contractStatusCounts, kpis.activeContracts, kpis.completedContracts, kpis.unpaidContracts]);

const operationScores = useMemo(() => ([
    { label: '안전운전', score: 87, color: 'bg-green-500' },
    { label: '차량관리', score: 68, color: 'bg-orange-500' },
    { label: '사업운영', score: 75, color: 'bg-blue-500' },
  ]), []);

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
        emptyTitle="현재 표시할 홈 데이터가 없습니다"
        emptyDescription="지금 기준으로 집계된 데이터가 없어 잠시 후 다시 확인해 주세요."
        onRetry={handleRetry}
        errorActionLabel={getPageErrorActionLabel(blockingErrorKind)}
        onErrorAction={handleBlockingErrorAction}
        emptyActionLabel="다시 불러오기"
        onEmptyAction={handleRetry}
        className="m-6 min-h-[320px]"
      >
        <div className="space-y-5 p-6">
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

          <div
            data-testid="home-priority-panel"
            className="rounded-xl bg-white p-5 shadow-sm"
          >
            <h2 className="mb-3 text-lg font-bold text-[#1e2939]">오늘 할 일</h2>

            <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-stretch">
              <section
                data-testid="home-today-column"
                className="space-y-3 rounded-xl bg-white p-4 shadow-sm"
              >
                {todayStats.map((task) => {
                  const Icon = iconMap[task.icon];
                  return (
                    <button
                      key={task.testId}
                      type="button"
                      data-testid={task.testId}
                      onClick={() => handleTaskClick(task.filter)}
                      className="flex w-full items-center justify-between rounded-lg p-3 text-left transition-colors hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                          <Icon className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-xs text-[#4a5565]">{task.label}</p>
                          <p className="mt-0.5 text-2xl font-bold text-[#101828]">
                            {formatStatCardCount(task.count, task.unit)}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </section>

              <section
                data-testid="home-issue-grid"
                className="grid grid-cols-2 gap-3 xl:grid-cols-4"
              >
                {actionItemsForHome.map((issue) => {
                  const Icon = iconMap[issue.icon];
                  return (
                    <button
                      key={issue.testId}
                      type="button"
                      data-testid={issue.testId}
                      onClick={issue.onClick}
                      className={`${issue.bg} rounded-xl p-3 text-left transition-shadow hover:shadow-md`}
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
                          <Icon className={`h-4 w-4 ${issue.color}`} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-[#4a5565]">이슈명</p>
                        <p className="text-xs font-bold text-[#101828]">{issue.label}</p>
                      </div>

                      <div className="mt-2 space-y-1">
                        <p className="text-[10px] text-[#4a5565]">이슈 건 수</p>
                        <p className="text-2xl font-bold text-[#101828]">
                          {formatStatCardCount(issue.count, issue.unit)}
                        </p>
                      </div>
                      {issue.description && (
                        <p className="mt-1 text-[10px] leading-tight text-gray-500">
                          {issue.description}
                        </p>
                      )}
                    </button>
                  );
                })}
              </section>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-xl font-bold text-[#1e2939]">운영 대시보드</h2>

            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-[#1e2939]">자산 현황</h3>
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
                <h3 className="mb-3 text-sm font-semibold text-[#1e2939]">계약 현황</h3>
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

              <div data-testid="home-operation-score-card" className="rounded-xl bg-white p-5 shadow-sm">
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
                  navigateToPremiumInquiry(navigate, 'home-modal');
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
