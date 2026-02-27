import { ApiError, apiClient } from './api';

export type DeviceInstallationStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface DeviceInstallationItem {
  id: string;
  companyId?: string;
  vin: string;
  reservationId?: string;
  status: DeviceInstallationStatus;
  scheduledAt: string;
  installedAt?: string;
  installer?: string;
  deviceSerial?: string;
  photos: string[];
  memo?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeviceInstallationListResponse {
  items: DeviceInstallationItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DeviceInstallationListOptions {
  page?: number;
  pageSize?: number;
  status?: DeviceInstallationStatus;
  vin?: string;
  signal?: AbortSignal;
}

export interface CreateDeviceInstallationPayload {
  vin: string;
  scheduledAt: string;
  reservationId?: string;
  installer?: string;
  deviceSerial?: string;
  photos?: string[];
  memo?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function toPhotos(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((photo) => toNonEmptyString(photo))
    .filter((photo): photo is string => photo !== null);
}

function normalizeStatus(value: unknown): DeviceInstallationStatus {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');

  if (normalized === 'scheduled' || normalized === 'pending') {
    return 'scheduled';
  }
  if (normalized === 'in_progress' || normalized === 'inprogress' || normalized === 'processing') {
    return 'in_progress';
  }
  if (normalized === 'completed' || normalized === 'done') {
    return 'completed';
  }
  if (normalized === 'cancelled' || normalized === 'canceled') {
    return 'cancelled';
  }

  return 'scheduled';
}

function toInstallation(value: unknown): DeviceInstallationItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = toNonEmptyString(value.id) ?? toNonEmptyString(value.installationId);
  const vin = toNonEmptyString(value.vin);
  if (!id || !vin) {
    return null;
  }

  return {
    id,
    companyId: toNonEmptyString(value.companyId) ?? undefined,
    vin,
    reservationId: toNonEmptyString(value.reservationId) ?? undefined,
    status: normalizeStatus(value.status),
    scheduledAt: toNonEmptyString(value.scheduledAt) ?? '',
    installedAt: toNonEmptyString(value.installedAt) ?? undefined,
    installer: toNonEmptyString(value.installer) ?? undefined,
    deviceSerial: toNonEmptyString(value.deviceSerial) ?? undefined,
    photos: toPhotos(value.photos),
    memo: toNonEmptyString(value.memo) ?? undefined,
    createdAt: toNonEmptyString(value.createdAt) ?? undefined,
    updatedAt: toNonEmptyString(value.updatedAt) ?? undefined,
  };
}

function toListPayload(
  payload: unknown,
  fallbackPage: number,
  fallbackPageSize: number,
): DeviceInstallationListResponse {
  if (!isRecord(payload)) {
    return {
      items: [],
      total: 0,
      page: fallbackPage,
      pageSize: fallbackPageSize,
    };
  }

  const rawItems = Array.isArray(payload.items)
    ? payload.items
    : Array.isArray(payload.rows)
      ? payload.rows
      : Array.isArray(payload.list)
        ? payload.list
        : [];

  const items = rawItems
    .map((item) => toInstallation(item))
    .filter((item): item is DeviceInstallationItem => item !== null);

  const total = toNumber(payload.total)
    ?? toNumber(payload.totalCount)
    ?? toNumber(payload.count)
    ?? items.length;

  const page = toNumber(payload.page) ?? fallbackPage;
  const pageSize = toNumber(payload.pageSize) ?? fallbackPageSize;

  return {
    items,
    total,
    page,
    pageSize,
  };
}

async function requestListFromPath(
  path: string,
  options: DeviceInstallationListOptions,
): Promise<DeviceInstallationListResponse> {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 20;

  const payload = await apiClient.requestData<unknown>({
    path,
    method: 'GET',
    query: {
      page,
      pageSize,
      status: options.status,
      vin: options.vin,
    },
    signal: options.signal,
  });

  return toListPayload(payload, page, pageSize);
}

export async function getDeviceInstallationList(
  options: DeviceInstallationListOptions = {},
): Promise<DeviceInstallationListResponse> {
  try {
    return await requestListFromPath('/api/v2/device-installations', options);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 405)) {
      return requestListFromPath('/api/v2/device-installations/tasks', options);
    }
    throw error;
  }
}

export async function createDeviceInstallation(
  payload: CreateDeviceInstallationPayload,
): Promise<DeviceInstallationItem> {
  const createdPayload = await apiClient.requestData<unknown>({
    path: '/api/v2/device-installations',
    method: 'POST',
    body: payload,
  });

  const installation = toInstallation(createdPayload);
  if (!installation) {
    throw new ApiError('API_ERROR', 'Unexpected create response payload');
  }
  return installation;
}

async function getInstallationFromPath(path: string): Promise<DeviceInstallationItem> {
  const payload = await apiClient.requestData<unknown>({
    path,
    method: 'GET',
  });

  const installation = toInstallation(payload);
  if (!installation) {
    throw new ApiError('API_ERROR', 'Unexpected detail response payload');
  }
  return installation;
}

export async function getDeviceInstallation(installationId: string): Promise<DeviceInstallationItem> {
  const normalizedId = installationId.trim();
  if (!normalizedId) {
    throw new ApiError('VALIDATION_ERROR', 'installationId is required', { status: 400 });
  }

  const encodedInstallationId = encodeURIComponent(normalizedId);

  try {
    return await getInstallationFromPath(`/api/v2/device-installations/${encodedInstallationId}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 405)) {
      return getInstallationFromPath(`/api/v2/device-installations/tasks/${encodedInstallationId}`);
    }
    throw error;
  }
}

async function cancelFromLegacyPath(installationId: string): Promise<DeviceInstallationItem | null> {
  const payload = await apiClient.requestData<unknown>({
    path: `/api/v2/device-installations/${encodeURIComponent(installationId)}/cancel`,
    method: 'PATCH',
    body: {},
  });

  return toInstallation(payload);
}

async function cancelFromStatusPath(installationId: string): Promise<DeviceInstallationItem | null> {
  const payload = await apiClient.requestData<unknown>({
    path: `/api/v2/device-installations/${encodeURIComponent(installationId)}/status`,
    method: 'PATCH',
    body: {
      status: 'cancelled',
    },
  });

  return toInstallation(payload);
}

export async function cancelDeviceInstallation(installationId: string): Promise<DeviceInstallationItem | null> {
  const normalizedId = installationId.trim();
  if (!normalizedId) {
    throw new ApiError('VALIDATION_ERROR', 'installationId is required', { status: 400 });
  }

  try {
    return await cancelFromLegacyPath(normalizedId);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 405)) {
      return cancelFromStatusPath(normalizedId);
    }
    throw error;
  }
}
