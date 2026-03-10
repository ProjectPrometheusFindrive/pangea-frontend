import { ApiError, apiClient } from './api';
import { resolveNotificationPath } from './notificationNavigation.js';

export type NotificationLevel = 'urgent' | 'warning' | 'info';

export interface NotificationItem {
  id: string;
  level: NotificationLevel;
  title: string;
  message: string;
  isRead: boolean;
  path: string;
  createdAt: string;
}

export interface NotificationListData {
  items: NotificationItem[];
  totalCount: number;
  unreadCount: number;
}

export interface NotificationSummaryData {
  totalCount: number;
  unreadCount: number;
}

export interface NotificationRequestOptions {
  signal?: AbortSignal;
}

export interface NotificationListRequestOptions extends NotificationRequestOptions {
  page?: number;
  pageSize?: number;
}

export const NOTIFICATION_STATE_UPDATED_EVENT = 'pangea:notifications-updated';

interface NotificationMutationRequest {
  path: string;
  method: 'PATCH' | 'POST';
  signal?: AbortSignal;
  body?: unknown;
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

function toInteger(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  if (typeof value === 'string') {
    const parsedValue = Number(value);
    if (Number.isFinite(parsedValue)) {
      return Math.max(0, Math.trunc(parsedValue));
    }
  }
  return fallback;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase();
    if (normalizedValue === 'true' || normalizedValue === '1' || normalizedValue === 'y' || normalizedValue === 'yes') {
      return true;
    }
    if (normalizedValue === 'false' || normalizedValue === '0' || normalizedValue === 'n' || normalizedValue === 'no') {
      return false;
    }
  }
  return fallback;
}

const NOTIFICATION_TITLE_TRANSLATIONS = {
  'New reservation created': '새 예약이 생성되었습니다.',
  'Reservation status changed': '예약 상태가 변경되었습니다.',
  'Reservation returned': '예약이 반납 처리되었습니다.',
  'Accident reported': '사고가 접수되었습니다.',
  'Action item status changed': '조치 필요 항목 상태가 변경되었습니다.',
  'Action item memo added': '조치 필요 항목 메모가 추가되었습니다.',
  'New support ticket': '새 문의가 접수되었습니다.',
  'Support ticket status changed': '문의 상태가 변경되었습니다.',
  'Domain event notification': '도메인 이벤트 알림',
} as const;

const NOTIFICATION_MESSAGE_TRANSLATIONS = {
  'Reservation R-1 has been created.': '예약 R-1이 생성되었습니다.',
} as const;

function translateNotificationText(
  value: string,
  translations: Readonly<Record<string, string>>,
): string {
  return translations[value] ?? value;
}
function toNotificationLevel(value: unknown): NotificationLevel {
  const normalizedValue = toText(value).toLowerCase();

  if (
    normalizedValue.includes('urgent')
    || normalizedValue.includes('critical')
    || normalizedValue.includes('high')
    || normalizedValue.includes('accident')
    || normalizedValue.includes('theft')
    || normalizedValue.includes('사고')
    || normalizedValue.includes('도난')
  ) {
    return 'urgent';
  }

  if (
    normalizedValue.includes('warning')
    || normalizedValue.includes('warn')
    || normalizedValue.includes('medium')
    || normalizedValue.includes('delay')
    || normalizedValue.includes('overdue')
    || normalizedValue.includes('late')
    || normalizedValue.includes('지연')
    || normalizedValue.includes('만료')
    || normalizedValue.includes('결제')
  ) {
    return 'warning';
  }

  return 'info';
}

function toNotificationArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return [];
  }

  if (Array.isArray(payload.items)) {
    return payload.items;
  }

  if (Array.isArray(payload.notifications)) {
    return payload.notifications;
  }

  if (Array.isArray(payload.results)) {
    return payload.results;
  }

  if (Array.isArray(payload.list)) {
    return payload.list;
  }

  return [];
}

function normalizeNotification(payload: unknown, index: number): NotificationItem | null {
  if (!isRecord(payload)) {
    return null;
  }

  const id = toText(
    payload.id
      ?? payload.notificationId
      ?? payload.eventId
      ?? payload.uuid
      ?? payload._id,
    `notification-${index + 1}`,
  );

  const title = toText(
    payload.title
      ?? payload.subject
      ?? payload.category
      ?? payload.eventType
      ?? payload.type,
    '알림',
  );
  const message = toText(
    payload.message
      ?? payload.content
      ?? payload.body
      ?? payload.description,
    '',
  );
  const createdAt = toText(
    payload.createdAt
      ?? payload.occurredAt
      ?? payload.timestamp
      ?? payload.time,
    new Date().toISOString(),
  );
  const path = resolveNotificationPath(payload);

  const readAtValue = payload.readAt;
  const hasReadAt = (
    (typeof readAtValue === 'string' && readAtValue.trim().length > 0)
    || (readAtValue !== null && readAtValue !== undefined && typeof readAtValue !== 'string')
  );
  const isRead = toBoolean(payload.isRead ?? payload.read ?? payload.readYn, false) || hasReadAt;
  const level = toNotificationLevel(
    payload.level
      ?? payload.severity
      ?? payload.priority
      ?? payload.type
      ?? title,
  );

      return {
        id,
        level,
        title: translateNotificationText(title, NOTIFICATION_TITLE_TRANSLATIONS),
        message: translateNotificationText(message, NOTIFICATION_MESSAGE_TRANSLATIONS),
        isRead,
        path,
        createdAt,
      };
}

function normalizeNotificationList(payload: unknown): NotificationListData {
  const source = isRecord(payload) ? payload : {};
  const items = toNotificationArray(payload)
    .map((entry, index) => normalizeNotification(entry, index))
    .filter((entry): entry is NotificationItem => entry !== null);

  const unreadCountFromPayload = toInteger(
    source.unreadCount
      ?? source.unread
      ?? source.unreadTotal,
    -1,
  );
  const unreadCount = unreadCountFromPayload >= 0
    ? unreadCountFromPayload
    : items.filter((entry) => !entry.isRead).length;
  const totalCountFromPayload = toInteger(
    source.totalCount
      ?? source.total
      ?? source.count,
    -1,
  );
  const totalCount = totalCountFromPayload >= 0
    ? Math.max(totalCountFromPayload, items.length)
    : items.length;

  return {
    items,
    totalCount,
    unreadCount,
  };
}

function normalizeNotificationSummary(payload: unknown): NotificationSummaryData {
  const source = isRecord(payload) ? payload : {};
  const unreadCount = toInteger(
    source.unreadCount
      ?? source.unread
      ?? source.unreadTotal,
  );
  const totalCount = toInteger(
    source.totalCount
      ?? source.total
      ?? source.count,
    unreadCount,
  );

  return {
    totalCount: Math.max(totalCount, unreadCount),
    unreadCount,
  };
}

async function requestNotificationMutation(requests: NotificationMutationRequest[]): Promise<void> {
  let fallbackError: unknown;

  for (const request of requests) {
    try {
      await apiClient.requestData<unknown>({
        path: request.path,
        method: request.method,
        body: request.body,
        signal: request.signal,
      });
      return;
    } catch (error) {
      if (error instanceof ApiError && (error.status === 404 || error.status === 405)) {
        fallbackError = error;
        continue;
      }
      throw error;
    }
  }

  if (fallbackError) {
    throw fallbackError;
  }
}

export async function getNotifications(options: NotificationListRequestOptions = {}): Promise<NotificationListData> {
  const payload = await apiClient.requestData<unknown>({
    path: '/api/v2/notifications',
    method: 'GET',
    query: {
      page: options.page,
      pageSize: options.pageSize,
    },
    signal: options.signal,
  });

  return normalizeNotificationList(payload);
}

export async function getNotificationSummary(
  options: NotificationRequestOptions = {},
): Promise<NotificationSummaryData> {
  const payload = await apiClient.requestData<unknown>({
    path: '/api/v2/notifications/summary',
    method: 'GET',
    signal: options.signal,
  });

  return normalizeNotificationSummary(payload);
}

export async function markNotificationAsRead(
  notificationId: string,
  options: NotificationRequestOptions = {},
): Promise<void> {
  const encodedNotificationId = encodeURIComponent(notificationId);

  await requestNotificationMutation([
    {
      path: `/api/v2/notifications/${encodedNotificationId}/read`,
      method: 'PATCH',
      signal: options.signal,
    },
    {
      path: `/api/v2/notifications/${encodedNotificationId}/read`,
      method: 'POST',
      signal: options.signal,
    },
    {
      path: `/api/v2/notifications/${encodedNotificationId}/mark-read`,
      method: 'POST',
      signal: options.signal,
    },
  ]);
}

export async function markAllNotificationsAsRead(options: NotificationRequestOptions = {}): Promise<void> {
  await requestNotificationMutation([
    {
      path: '/api/v2/notifications/read-all',
      method: 'PATCH',
      signal: options.signal,
    },
    {
      path: '/api/v2/notifications/read-all',
      method: 'POST',
      signal: options.signal,
    },
    {
      path: '/api/v2/notifications/mark-all-read',
      method: 'POST',
      signal: options.signal,
    },
  ]);
}

export function dispatchNotificationStateUpdatedEvent(): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }

  window.dispatchEvent(new Event(NOTIFICATION_STATE_UPDATED_EVENT));
}
