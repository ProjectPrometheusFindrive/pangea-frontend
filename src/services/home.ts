import { apiClient } from './api';

export type HomeRecentChangeType = 'reservation_created' | 'reservation_updated' | 'reservation_returned' | string;

export interface HomeSummaryKpis {
  totalAssets: number;
  totalContracts: number;
  activeContracts: number;
  completedContracts: number;
  overdueContracts: number;
  utilizationRate: number;
}

export interface HomeSummaryStatusCounts {
  contractStatus: Record<string, number>;
  managementStage: Record<string, number>;
  alerts: {
    overdue: number;
    stolen: number;
  };
}

export interface HomeRecentChange {
  type: HomeRecentChangeType;
  reservationId: string;
  contractStatus: string;
  timestamp: string;
}

export interface HomeSummaryResponse {
  tenantId: string;
  from: string;
  to: string;
  kpis: HomeSummaryKpis;
  statusCounts: HomeSummaryStatusCounts;
  recentChanges: HomeRecentChange[];
}

export interface HomeSummaryRequestParams {
  from: string;
  to: string;
  tenantId: string;
  signal?: AbortSignal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    const normalizedValue = value.trim();
    return normalizedValue.length > 0 ? normalizedValue : fallback;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return fallback;
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

function normalizeStatusMap(value: unknown): Record<string, number> {
  if (!isRecord(value)) {
    return {};
  }

  const normalized: Record<string, number> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      continue;
    }
    normalized[normalizedKey] = toInteger(entryValue);
  }
  return normalized;
}

function normalizeKpis(value: unknown): HomeSummaryKpis {
  if (!isRecord(value)) {
    return {
      totalAssets: 0,
      totalContracts: 0,
      activeContracts: 0,
      completedContracts: 0,
      overdueContracts: 0,
      utilizationRate: 0,
    };
  }

  const utilizationRate = toNumber(value.utilizationRate);
  return {
    totalAssets: toInteger(value.totalAssets),
    totalContracts: toInteger(value.totalContracts),
    activeContracts: toInteger(value.activeContracts),
    completedContracts: toInteger(value.completedContracts),
    overdueContracts: toInteger(value.overdueContracts),
    utilizationRate: Math.max(0, Math.min(1, utilizationRate)),
  };
}

function normalizeStatusCounts(value: unknown): HomeSummaryStatusCounts {
  if (!isRecord(value)) {
    return {
      contractStatus: {},
      managementStage: {},
      alerts: {
        overdue: 0,
        stolen: 0,
      },
    };
  }

  const alertsValue = isRecord(value.alerts) ? value.alerts : {};

  return {
    contractStatus: normalizeStatusMap(value.contractStatus),
    managementStage: normalizeStatusMap(value.managementStage),
    alerts: {
      overdue: toInteger(alertsValue.overdue),
      stolen: toInteger(alertsValue.stolen),
    },
  };
}

function normalizeRecentChange(value: unknown): HomeRecentChange | null {
  if (!isRecord(value)) {
    return null;
  }

  const reservationId = toText(value.reservationId);
  const timestamp = toText(value.timestamp);
  if (!reservationId || !timestamp) {
    return null;
  }

  return {
    type: toText(value.type, 'reservation_updated'),
    reservationId,
    contractStatus: toText(value.contractStatus, '기타'),
    timestamp,
  };
}

function normalizeHomeSummary(
  payload: unknown,
  defaults: { from: string; to: string; tenantId: string },
): HomeSummaryResponse {
  const source = isRecord(payload) ? payload : {};
  const recentChangesRaw = Array.isArray(source.recentChanges) ? source.recentChanges : [];

  return {
    tenantId: toText(source.tenantId, defaults.tenantId),
    from: toText(source.from, defaults.from),
    to: toText(source.to, defaults.to),
    kpis: normalizeKpis(source.kpis),
    statusCounts: normalizeStatusCounts(source.statusCounts),
    recentChanges: recentChangesRaw
      .map(normalizeRecentChange)
      .filter((entry): entry is HomeRecentChange => entry !== null),
  };
}

export async function getHomeSummary({
  from,
  to,
  tenantId,
  signal,
}: HomeSummaryRequestParams): Promise<HomeSummaryResponse> {
  const payload = await apiClient.requestData<unknown>({
    path: '/api/v2/home/summary',
    method: 'GET',
    query: {
      from,
      to,
      tenantId,
    },
    signal,
  });

  return normalizeHomeSummary(payload, {
    from,
    to,
    tenantId,
  });
}
