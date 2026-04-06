import { ApiError, apiClient } from './api';
import { resolveNotificationPath } from './notificationNavigation.js';

export type NotificationLevel = 'urgent' | 'warning' | 'info';

export interface NotificationItem {
  id: string;
  level: NotificationLevel;
  notificationCode?: string;
  title: string;
  message: string;
  isRead: boolean;
  path: string;
  createdAt: string;
  vehicleNumber?: string;
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

function firstNonEmptyText(...values: unknown[]): string {
  for (const value of values) {
    const normalizedValue = toText(value);
    if (normalizedValue) {
      return normalizedValue;
    }
  }

  return '';
}

function toMetadata(payload: Record<string, unknown>): Record<string, unknown> {
  return isRecord(payload.metadata) ? payload.metadata : {};
}

const LEGACY_NOTIFICATION_CODE_BY_EVENT_TYPE = {
  reservation_created: 'RESERVATION_START',
  reservation_status_changed: 'RESERVATION_STATUS_CHANGED',
  reservation_returned: 'RESERVATION_RETURNED',
  reservation_accident_reported: 'ACCIDENT_REPORTED',
  action_item_status_changed: 'ACTION_ITEM_STATUS_CHANGED',
  action_item_memo_added: 'ACTION_ITEM_MEMO_ADDED',
  support_ticket_created: 'SUPPORT_TICKET_CREATED',
  support_ticket_status_changed: 'SUPPORT_TICKET_STATUS_CHANGED',
  domain_event: 'DOMAIN_EVENT',
  'New reservation created': 'RESERVATION_START',
  'Reservation status changed': 'RESERVATION_STATUS_CHANGED',
  'Reservation returned': 'RESERVATION_RETURNED',
  'Accident reported': 'ACCIDENT_REPORTED',
  'Action item status changed': 'ACTION_ITEM_STATUS_CHANGED',
  'Action item memo added': 'ACTION_ITEM_MEMO_ADDED',
  'New support ticket': 'SUPPORT_TICKET_CREATED',
  'Support ticket status changed': 'SUPPORT_TICKET_STATUS_CHANGED',
  'Domain event notification': 'DOMAIN_EVENT',
} as const;

const NOTIFICATION_TITLE_BY_CODE = {
  RESERVATION_START: '오늘 대여 시작',
  RESERVATION_STATUS_CHANGED: '예약 상태 변경',
  RESERVATION_RETURNED: '반납 완료',
  ACCIDENT_REPORTED: '사고 접수',
  ACTION_ITEM_STATUS_CHANGED: '조치 필요 항목',
  ACTION_ITEM_MEMO_ADDED: '조치 필요 항목',
  SUPPORT_TICKET_CREATED: '새 지원 티켓',
  SUPPORT_TICKET_STATUS_CHANGED: '문의 상태 변경',
  DOMAIN_EVENT: '도메인 이벤트',
} as const;

const NOTIFICATION_MESSAGE_BY_CODE = {
} as const;

const ACTION_ITEM_IDENTIFIER_PATTERN = /(?:DERIVED-)?ACTION-ITEM:[A-Za-z0-9:_-]+/gu;

function normalizeActionItemTypeLabel(value: string): string {
  const normalizedValue = value.replace(/\s+/g, '').toLowerCase();
  if (!normalizedValue) {
    return '';
  }

  if (normalizedValue.includes('정기점검') || normalizedValue.includes('maintenance') || normalizedValue.includes('inspection')) {
    return '정기점검 만료 임박';
  }
  if (
    normalizedValue.includes('미납')
    || normalizedValue.includes('결제')
    || normalizedValue.includes('연체')
    || normalizedValue.includes('payment')
    || normalizedValue.includes('billing')
    || normalizedValue.includes('arrear')
    || normalizedValue.includes('unpaid')
  ) {
    return '미납/결제 문제';
  }
  if (
    normalizedValue.includes('반납지연')
    || normalizedValue.includes('overdue')
    || normalizedValue.includes('returndelay')
    || normalizedValue.includes('returnlate')
  ) {
    return '반납 지연';
  }
  if (
    (normalizedValue.includes('단말') || normalizedValue.includes('device') || normalizedValue.includes('terminal'))
    && normalizedValue.includes('off')
  ) {
    return '단말 OFF';
  }
  if (
    normalizedValue.includes('도난')
    || normalizedValue.includes('theft')
    || normalizedValue.includes('stolen')
    || normalizedValue.includes('geofence')
  ) {
    return '도난 의심';
  }
  if (normalizedValue.includes('사고') || normalizedValue.includes('accident') || normalizedValue.includes('collision')) {
    return '사고 접수';
  }
  if (
    normalizedValue.includes('차량이상')
    || normalizedValue.includes('vehicleissue')
    || normalizedValue.includes('vehicleproblem')
    || normalizedValue.includes('malfunction')
  ) {
    return '차량이상';
  }
  if (normalizedValue.includes('보험만료') || normalizedValue.includes('insurance')) {
    return '보험 만료 임박';
  }

  return value;
}

function toLegacyActionItemTitle(value: string): string {
  switch (value) {
    case '정기점검 만료 임박':
      return '정기점검 예정';
    case '미납/결제 문제':
      return '결제 문제';
    default:
      return value;
  }
}

function resolveNotificationCode(payload: Record<string, unknown>, title: string): string {
  const metadata = toMetadata(payload);
  const explicitCode = firstNonEmptyText(
    payload.notificationCode,
    payload.notification_code,
    payload.code,
    metadata.notificationCode,
    metadata.notification_code,
    metadata.code,
  );
  if (explicitCode) {
    return explicitCode.toUpperCase();
  }

  const eventType = firstNonEmptyText(payload.eventType, metadata.eventType, title);
  return LEGACY_NOTIFICATION_CODE_BY_EVENT_TYPE[
    eventType as keyof typeof LEGACY_NOTIFICATION_CODE_BY_EVENT_TYPE
  ] ?? '';
}

function normalizeSupportStatusLabel(value: string): string {
  const normalizedValue = value.replace(/-/g, '_').trim().toUpperCase();
  switch (normalizedValue) {
    case 'RECEIVED':
      return '접수';
    case 'IN_PROGRESS':
    case 'INPROGRESS':
      return '처리중';
    case 'RESOLVED':
      return '해결';
    case 'CLOSED':
      return '종결';
    default:
      return value;
  }
}

function normalizeReservationStatusLabel(value: string): string {
  const normalizedValue = value.trim().toLowerCase();
  switch (normalizedValue) {
    case 'reserved':
      return '예약중';
    case 'in_use':
    case 'active':
      return '대여중';
    case 'returned':
    case 'completed':
      return '반납 완료';
    case 'cancelled':
      return '취소';
    default:
      return value;
  }
}

function looksLikeRawActionItemStatusMessage(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return (
    Boolean(message.match(ACTION_ITEM_IDENTIFIER_PATTERN))
    || normalizedMessage.includes(' 상태가 open')
    || normalizedMessage.includes(' 상태가 done')
    || normalizedMessage.includes(' 상태가 in_progress')
    || normalizedMessage.includes(' 상태가 resolved')
  );
}

function isActionItemEventLabel(value: string): boolean {
  const normalizedValue = value.replace(/\s+/g, '').toLowerCase();

  return (
    normalizedValue.includes('actionitemmemoadded')
    || normalizedValue.includes('actionitemstatuschanged')
    || normalizedValue.includes('조치필요항목메모가추가되었습니다')
    || normalizedValue.includes('조치필요항목상태가변경되었습니다')
  );
}

function extractActionItemTypeFromIdentifier(value: string): string {
  const identifier = firstNonEmptyText(value);
  if (!identifier) {
    return '';
  }

  const matchedIdentifier = identifier.match(ACTION_ITEM_IDENTIFIER_PATTERN)?.[0] ?? '';
  if (!matchedIdentifier) {
    return '';
  }

  const [, actionItemType = ''] = matchedIdentifier.split(':');
  return actionItemType;
}

function toActionItemDisplayName(
  payload: Record<string, unknown>,
  message: string,
  vehicleNumber?: string,
): string {
  if (!vehicleNumber) {
    return '';
  }

  const metadata = toMetadata(payload);
  const rawActionItemType = firstNonEmptyText(
    payload.issueType,
    payload.actionItemType,
    payload.actionCategory,
    metadata.issueType,
    metadata.actionItemType,
    metadata.actionCategory,
    isActionItemEventLabel(toText(metadata.category)) ? '' : metadata.category,
    isActionItemEventLabel(toText(payload.category)) ? '' : payload.category,
    extractActionItemTypeFromIdentifier(firstNonEmptyText(
      payload.actionItemId,
      payload.resourceId,
      payload.entityId,
      metadata.actionItemId,
      metadata.resourceId,
      metadata.entityId,
      message,
    )),
  );
  const actionItemType = normalizeActionItemTypeLabel(rawActionItemType);
  if (!actionItemType) {
    return '';
  }

  return `${actionItemType}-${vehicleNumber}`;
}

function toReservationDisplayTarget(payload: Record<string, unknown>, vehicleNumber?: string): string {
  const metadata = toMetadata(payload);
  return firstNonEmptyText(
    vehicleNumber,
    payload.plateNumber,
    payload.plate,
    metadata.vehicleNumber,
    metadata.plateNumber,
    metadata.plate,
    payload.reservationId,
    metadata.reservationId,
    metadata.rentalId,
  );
}

function toConciseReservationTitle(title: string, message: string): string {
  const normalizedTitle = title.replace(/\s+/g, '').toLowerCase();
  const normalizedMessage = message.replace(/\s+/g, '').toLowerCase();

  if (
    normalizedTitle.includes('반납')
    || normalizedTitle.includes('returned')
    || normalizedMessage.includes('반납')
    || normalizedMessage.includes('returned')
  ) {
    return '반납 완료';
  }

  if (
    normalizedTitle.includes('대여')
    || normalizedTitle.includes('예약')
    || normalizedTitle.includes('reservation')
    || normalizedMessage.includes('대여')
    || normalizedMessage.includes('예약')
    || normalizedMessage.includes('reservation')
  ) {
    return '오늘 대여 시작';
  }

  return title;
}

function formatNotificationTitle(
  payload: Record<string, unknown>,
  notificationCode: string,
  title: string,
  message: string,
  vehicleNumber?: string,
): string {
  if (title) {
    const normalizedTitle = title.replace(/\s+/g, '').toLowerCase();
    const isLegacyOrGenericTitle = (
      normalizedTitle === '알림'
      || normalizedTitle === '조치필요항목'
      || normalizedTitle === '예약상태변경'
      || normalizedTitle === '문의상태변경'
      || normalizedTitle === '도메인이벤트'
    );
    if (!isLegacyOrGenericTitle) {
      return title;
    }
  }

  const actionItemDisplayName = toActionItemDisplayName(payload, message, vehicleNumber);
  if (
    actionItemDisplayName
    && (notificationCode === 'ACTION_ITEM_STATUS_CHANGED' || notificationCode === 'ACTION_ITEM_MEMO_ADDED')
  ) {
    const [actionItemType] = actionItemDisplayName.split('-');
    return toLegacyActionItemTitle(actionItemType ?? title);
  }

  if (notificationCode === 'RESERVATION_STATUS_CHANGED') {
    return toConciseReservationTitle(title, message);
  }

  const mappedTitle = NOTIFICATION_TITLE_BY_CODE[
    notificationCode as keyof typeof NOTIFICATION_TITLE_BY_CODE
  ];
  if (mappedTitle) {
    return mappedTitle;
  }

  return title;
}

function formatNotificationMessage(
  payload: Record<string, unknown>,
  notificationCode: string,
  message: string,
  vehicleNumber?: string,
): string {
  const metadata = toMetadata(payload);
  const actionItemDisplayName = toActionItemDisplayName(payload, message, vehicleNumber);

  if (message && notificationCode !== 'ACTION_ITEM_MEMO_ADDED' && notificationCode !== 'ACTION_ITEM_STATUS_CHANGED') {
    return message;
  }
  if (
    actionItemDisplayName
    && notificationCode === 'ACTION_ITEM_MEMO_ADDED'
    && message.match(ACTION_ITEM_IDENTIFIER_PATTERN)
  ) {
    return `${actionItemDisplayName}에 메모가 추가되었습니다.`;
  }
  if (
    actionItemDisplayName
    && notificationCode === 'ACTION_ITEM_STATUS_CHANGED'
    && (!message || looksLikeRawActionItemStatusMessage(message))
  ) {
    const nextStatus = firstNonEmptyText(
      payload.toStatusLabel,
      metadata.toStatusLabel,
      normalizeSupportStatusLabel(firstNonEmptyText(payload.toStatus, metadata.toStatus)),
    );
    return nextStatus
      ? `${actionItemDisplayName} 상태가 ${nextStatus}(으)로 변경되었습니다.`
      : `${actionItemDisplayName} 상태가 변경되었습니다.`;
  }

  if (message) {
    return message;
  }

  if (notificationCode === 'RESERVATION_START') {
    const target = toReservationDisplayTarget(payload, vehicleNumber);
    return target ? `${target} 예약이 생성되었습니다.` : '예약이 생성되었습니다.';
  }
  if (notificationCode === 'RESERVATION_STATUS_CHANGED') {
    const target = toReservationDisplayTarget(payload, vehicleNumber);
    const nextStatus = normalizeReservationStatusLabel(firstNonEmptyText(payload.toStatus, metadata.toStatus));
    if (target && nextStatus) {
      return `${target} 상태가 ${nextStatus}(으)로 변경되었습니다.`;
    }
    return target ? `${target} 예약 상태가 변경되었습니다.` : '예약 상태가 변경되었습니다.';
  }
  if (notificationCode === 'RESERVATION_RETURNED') {
    const target = toReservationDisplayTarget(payload, vehicleNumber);
    return target ? `${target} 반납이 완료되었습니다.` : '반납이 완료되었습니다.';
  }
  if (notificationCode === 'ACCIDENT_REPORTED') {
    const target = toReservationDisplayTarget(payload, vehicleNumber);
    return target ? `${target} 사고가 접수되었습니다.` : '사고가 접수되었습니다.';
  }
  if (notificationCode === 'SUPPORT_TICKET_CREATED') {
    const ticketId = firstNonEmptyText(payload.ticketId, metadata.ticketId, payload.entityId);
    return ticketId ? `지원 티켓 ${ticketId}이 생성되었습니다.` : '지원 티켓이 생성되었습니다.';
  }
  if (notificationCode === 'SUPPORT_TICKET_STATUS_CHANGED') {
    const ticketId = firstNonEmptyText(payload.ticketId, metadata.ticketId, payload.entityId);
    const nextStatus = normalizeSupportStatusLabel(firstNonEmptyText(payload.toStatus, metadata.toStatus));
    if (ticketId && nextStatus) {
      return `지원 티켓 ${ticketId} 상태가 ${nextStatus}(으)로 변경되었습니다.`;
    }
    return ticketId ? `지원 티켓 ${ticketId} 상태가 변경되었습니다.` : '문의 상태가 변경되었습니다.';
  }
  if (notificationCode === 'DOMAIN_EVENT') {
    return '새 알림이 도착했습니다.';
  }

  return NOTIFICATION_MESSAGE_BY_CODE[
    notificationCode as keyof typeof NOTIFICATION_MESSAGE_BY_CODE
  ] ?? message;
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

  const metadata = toMetadata(payload);

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
  const vehicleNumber = toText(
    payload.vehicleNumber
      ?? payload.vehicle_number
      ?? payload.plateNumber
      ?? payload.carNumber
      ?? payload.plate
      ?? metadata.vehicleNumber
      ?? metadata.vehicle_number
      ?? metadata.plateNumber
      ?? metadata.carNumber
      ?? metadata.plate,
    '',
  ) || undefined;

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
  const notificationCode = resolveNotificationCode(payload, title);

  return {
    id,
    level,
    notificationCode: notificationCode || undefined,
    title: formatNotificationTitle(payload, notificationCode, title, message, vehicleNumber),
    message: formatNotificationMessage(payload, notificationCode, message, vehicleNumber),
    isRead,
    path,
    createdAt,
    vehicleNumber,
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
