import { ApiError, apiClient } from './api';

export interface SupportRequestOptions {
  signal?: AbortSignal;
}

export interface SupportCategory {
  id: string;
  name: string;
  description?: string;
  priority?: number;
  active?: boolean;
}

export type SupportTicketStatus = 'RECEIVED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | string;

export interface SupportTicketAttachment {
  fileName: string;
  sizeBytes?: number;
  contentType?: string;
  url?: string;
}

export interface SupportTicketStatusHistoryEntry {
  from?: SupportTicketStatus | null;
  to: SupportTicketStatus;
  changedBy?: string;
  changedAt?: string;
  note?: string;
}

export interface SupportTicket {
  id: string;
  companyId?: string;
  category: string;
  title: string;
  content: string;
  contactPhone?: string;
  requesterUserId?: string;
  requesterName?: string;
  requesterRole?: string;
  status: SupportTicketStatus;
  statusHistory: SupportTicketStatusHistoryEntry[];
  attachments: SupportTicketAttachment[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSupportTicketAttachmentPayload {
  fileName: string;
  sizeBytes: number;
  contentType?: string;
}

export interface CreateSupportTicketPayload {
  category: string;
  title: string;
  content: string;
  companyId?: string;
  contactPhone?: string;
  attachments?: CreateSupportTicketAttachmentPayload[];
}

export interface SupportTicketListOptions extends SupportRequestOptions {
  limit?: number;
  offset?: number;
  ticketId?: string;
  companyId?: string;
  status?: SupportTicketStatus | '';
  from?: string;
  to?: string;
}

export interface SupportTicketDetailOptions extends SupportRequestOptions {
  companyId?: string;
}

export interface UpdateSupportTicketStatusPayload {
  status: SupportTicketStatus;
  note?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toStringValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalizedValue = value.trim();
    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function toNumberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsedValue = Number(value);
    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return null;
}

function normalizeSupportTicketStatus(value: unknown): SupportTicketStatus {
  const normalizedValue = toStringValue(value)?.toUpperCase().replace(/-/g, '_');
  if (!normalizedValue) {
    return 'RECEIVED';
  }

  if (normalizedValue === 'INPROGRESS') {
    return 'IN_PROGRESS';
  }
  if (normalizedValue === 'DONE') {
    return 'RESOLVED';
  }

  return normalizedValue;
}

function toSupportAttachment(value: unknown): SupportTicketAttachment | null {
  if (typeof value === 'string') {
    return {
      fileName: value,
    };
  }

  if (!isRecord(value)) {
    return null;
  }

  const fileName = toStringValue(value.fileName) ?? toStringValue(value.name);
  if (!fileName) {
    return null;
  }

  const attachment: SupportTicketAttachment = {
    fileName,
  };

  const sizeBytes = toNumberValue(value.sizeBytes) ?? toNumberValue(value.size);
  if (sizeBytes !== null && sizeBytes >= 0) {
    attachment.sizeBytes = sizeBytes;
  }

  const contentType = toStringValue(value.contentType) ?? toStringValue(value.type);
  if (contentType) {
    attachment.contentType = contentType;
  }

  const url = toStringValue(value.url);
  if (url) {
    attachment.url = url;
  }

  return attachment;
}

function toSupportStatusHistoryEntry(value: unknown): SupportTicketStatusHistoryEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const toStatus = toStringValue(value.to) ?? toStringValue(value.status);
  if (!toStatus) {
    return null;
  }

  return {
    from: toStringValue(value.from) ?? null,
    to: normalizeSupportTicketStatus(toStatus),
    changedBy: toStringValue(value.changedBy) ?? undefined,
    changedAt: toStringValue(value.changedAt) ?? toStringValue(value.updatedAt) ?? undefined,
    note: toStringValue(value.note) ?? undefined,
  };
}

function toSupportTicket(value: unknown): SupportTicket | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = toStringValue(value.id) ?? toStringValue(value.ticketId);
  if (!id) {
    return null;
  }

  const rawHistory = Array.isArray(value.statusHistory)
    ? value.statusHistory
    : Array.isArray(value.history)
      ? value.history
      : [];

  const statusHistory = rawHistory
    .map((entry) => toSupportStatusHistoryEntry(entry))
    .filter((entry): entry is SupportTicketStatusHistoryEntry => entry !== null);

  const rawAttachments = Array.isArray(value.attachments)
    ? value.attachments
    : Array.isArray(value.files)
      ? value.files
      : [];

  const attachments = rawAttachments
    .map((attachment) => toSupportAttachment(attachment))
    .filter((attachment): attachment is SupportTicketAttachment => attachment !== null);

  return {
    id,
    companyId: toStringValue(value.companyId) ?? undefined,
    category: toStringValue(value.category) ?? '기타',
    title: toStringValue(value.title) ?? '제목 없음',
    content: toStringValue(value.content) ?? '',
    contactPhone: toStringValue(value.contactPhone) ?? undefined,
    requesterUserId: toStringValue(value.requesterUserId) ?? undefined,
    requesterName: toStringValue(value.requesterName) ?? undefined,
    requesterRole: toStringValue(value.requesterRole) ?? undefined,
    status: normalizeSupportTicketStatus(value.status),
    statusHistory,
    attachments,
    createdAt: toStringValue(value.createdAt) ?? undefined,
    updatedAt: toStringValue(value.updatedAt) ?? undefined,
  };
}

function toSupportTicketFromPayload(payload: unknown): SupportTicket | null {
  if (isRecord(payload)) {
    const directTicket = toSupportTicket(payload.ticket);
    if (directTicket) {
      return directTicket;
    }

    if (isRecord(payload.data)) {
      const dataTicket = toSupportTicket(payload.data.ticket);
      if (dataTicket) {
        return dataTicket;
      }

      const dataAsTicket = toSupportTicket(payload.data);
      if (dataAsTicket) {
        return dataAsTicket;
      }
    }
  }

  return toSupportTicket(payload);
}

function toSupportCategory(value: unknown, index: number): SupportCategory | null {
  if (typeof value === 'string') {
    return {
      id: value,
      name: value,
    };
  }

  if (!isRecord(value)) {
    return null;
  }

  const name = toStringValue(value.name)
    ?? toStringValue(value.label)
    ?? toStringValue(value.displayName)
    ?? toStringValue(value.title)
    ?? toStringValue(value.code)
    ?? toStringValue(value.value);
  if (!name) {
    return null;
  }

  const id = toStringValue(value.id)
    ?? toStringValue(value.key)
    ?? toStringValue(value.code)
    ?? toStringValue(value.value)
    ?? name
    ?? `category-${index + 1}`;

  const category: SupportCategory = {
    id,
    name,
  };

  const description = toStringValue(value.description) ?? toStringValue(value.desc);
  if (description) {
    category.description = description;
  }

  const priority = toNumberValue(value.priority) ?? toNumberValue(value.order);
  if (priority !== null) {
    category.priority = priority;
  }

  if (typeof value.active === 'boolean') {
    category.active = value.active;
  } else if (typeof value.isActive === 'boolean') {
    category.active = value.isActive;
  }

  return category;
}

function toSupportCategories(payload: unknown): SupportCategory[] {
  if (Array.isArray(payload)) {
    return payload
      .map((entry, index) => toSupportCategory(entry, index))
      .filter((entry): entry is SupportCategory => entry !== null);
  }

  if (!isRecord(payload)) {
    return [];
  }

  const candidates = [
    payload.items,
    payload.categories,
    payload.list,
    payload.data,
  ];

  for (const candidate of candidates) {
    const normalized = toSupportCategories(candidate);
    if (normalized.length > 0 || Array.isArray(candidate)) {
      return normalized;
    }
  }

  return [];
}

function toSupportTicketList(payload: unknown): SupportTicket[] {
  if (!isRecord(payload)) {
    return [];
  }

  const rawItems = Array.isArray(payload.items)
    ? payload.items
    : isRecord(payload.data) && Array.isArray(payload.data.items)
      ? payload.data.items
      : Array.isArray(payload.list)
        ? payload.list
        : [];

  return rawItems
    .map((item) => toSupportTicket(item))
    .filter((item): item is SupportTicket => item !== null);
}

export async function listSupportTickets({
  limit = 200,
  offset = 0,
  ticketId,
  companyId,
  status,
  from,
  to,
  signal,
}: SupportTicketListOptions = {}): Promise<SupportTicket[]> {
  const payload = await apiClient.requestData<unknown>({
    path: '/api/v2/support/tickets',
    method: 'GET',
    query: {
      limit,
      offset,
      ticketId,
      companyId,
      status: toStringValue(status) ?? undefined,
      from,
      to,
    },
    signal,
  });

  return toSupportTicketList(payload);
}

function deriveCategoriesFromTickets(tickets: SupportTicket[]): SupportCategory[] {
  const uniqueCategories = new Map<string, SupportCategory>();

  for (const ticket of tickets) {
    const categoryName = toStringValue(ticket.category);
    if (!categoryName) {
      continue;
    }

    const key = categoryName.toLowerCase();
    if (uniqueCategories.has(key)) {
      continue;
    }

    uniqueCategories.set(key, {
      id: categoryName,
      name: categoryName,
    });
  }

  return Array.from(uniqueCategories.values());
}

export async function getSupportCategories(options: SupportRequestOptions = {}): Promise<SupportCategory[]> {
  try {
    const payload = await apiClient.requestData<unknown>({
      path: '/api/v2/support/categories',
      method: 'GET',
      signal: options.signal,
    });
    return toSupportCategories(payload);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 405)) {
      const fallbackTickets = await listSupportTickets({
        limit: 200,
        offset: 0,
        signal: options.signal,
      });
      return deriveCategoriesFromTickets(fallbackTickets);
    }

    throw error;
  }
}

export async function createSupportTicket(payload: CreateSupportTicketPayload): Promise<SupportTicket> {
  const category = payload.category.trim();
  const title = payload.title.trim();
  const content = payload.content.trim();
  const contactPhone = payload.contactPhone?.trim();

  if (!category || !title || !content) {
    throw new ApiError('VALIDATION_ERROR', 'category, title, content are required', { status: 400 });
  }

  const createdPayload = await apiClient.requestData<unknown>({
    path: '/api/v2/support/tickets',
    method: 'POST',
    body: {
      category,
      title,
      content,
      companyId: toStringValue(payload.companyId) ?? undefined,
      contactPhone: contactPhone || undefined,
      attachments: payload.attachments ?? [],
    },
  });

  const ticket = toSupportTicketFromPayload(createdPayload);
  if (!ticket) {
    throw new ApiError('API_ERROR', 'Unexpected support ticket create response payload');
  }

  return ticket;
}

export async function getSupportTicketDetail(
  ticketId: string,
  options: SupportTicketDetailOptions = {},
): Promise<SupportTicket> {
  const normalizedTicketId = ticketId.trim();
  if (!normalizedTicketId) {
    throw new ApiError('VALIDATION_ERROR', 'ticketId is required', { status: 400 });
  }

  try {
    const payload = await apiClient.requestData<unknown>({
      path: `/api/v2/support/tickets/${encodeURIComponent(normalizedTicketId)}`,
      method: 'GET',
      query: {
        companyId: options.companyId,
      },
      signal: options.signal,
    });

    const ticket = toSupportTicketFromPayload(payload);
    if (ticket) {
      return ticket;
    }

    throw new ApiError('API_ERROR', 'Unexpected support ticket detail response payload');
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 405)) {
      const listedTickets = await listSupportTickets({
        limit: 200,
        offset: 0,
        ticketId: normalizedTicketId,
        companyId: options.companyId,
        signal: options.signal,
      });

      const matchedTicket = listedTickets.find((item) => item.id.toUpperCase() === normalizedTicketId.toUpperCase());
      if (matchedTicket) {
        return matchedTicket;
      }

      throw new ApiError('NOT_FOUND', '지원 문의를 찾을 수 없습니다.', { status: 404 });
    }

    throw error;
  }
}

export async function updateSupportTicketStatus(
  ticketId: string,
  payload: UpdateSupportTicketStatusPayload,
  options: SupportTicketDetailOptions = {},
): Promise<SupportTicket> {
  const normalizedTicketId = ticketId.trim();
  const nextStatus = normalizeSupportTicketStatus(payload.status);
  const note = toStringValue(payload.note) ?? undefined;

  if (!normalizedTicketId) {
    throw new ApiError('VALIDATION_ERROR', 'ticketId is required', { status: 400 });
  }

  const responsePayload = await apiClient.requestData<unknown>({
    path: `/api/v2/support/tickets/${encodeURIComponent(normalizedTicketId)}/status`,
    method: 'PATCH',
    query: {
      companyId: options.companyId,
    },
    body: {
      status: nextStatus,
      note,
    },
    signal: options.signal,
  });

  const updatedTicket = toSupportTicketFromPayload(responsePayload);
  if (!updatedTicket) {
    throw new ApiError('API_ERROR', 'Unexpected support ticket update response payload');
  }

  return updatedTicket;
}
