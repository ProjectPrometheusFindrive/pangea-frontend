import { ApiError, apiClient } from './api';

export interface ActionRequiredListRequestOptions {
  page?: number;
  size?: number;
  status?: string;
  priority?: string;
  assignee?: string;
  signal?: AbortSignal;
}

export interface ActionRequiredDetailRequestOptions {
  signal?: AbortSignal;
}

export interface ActionRequiredStatusPatchOptions {
  status: string;
  memo?: string | null;
  signal?: AbortSignal;
}

export interface ActionRequiredMemoPatchOptions {
  memo: string;
  signal?: AbortSignal;
}

export function getActionRequiredList(options: ActionRequiredListRequestOptions = {}): Promise<unknown> {
  const { page, size, status, priority, assignee, signal } = options;

  return apiClient.requestData<unknown>({
    path: '/api/v2/action-required',
    method: 'GET',
    query: {
      page,
      size,
      status,
      priority,
      assignee,
    },
    signal,
  });
}

export function getActionRequiredDetail(
  actionId: string,
  options: ActionRequiredDetailRequestOptions = {},
): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: `/api/v2/action-required/${encodeURIComponent(actionId)}`,
    method: 'GET',
    signal: options.signal,
  });
}

function toLegacyActionItemStatus(statusValue: string): string {
  const normalized = statusValue.trim().toLowerCase().replace(/_/g, '-');
  if (normalized === 'resolved' || normalized === 'done' || normalized === 'closed' || statusValue === '완료') {
    return 'done';
  }
  if (
    normalized === 'in-progress'
    || normalized === 'in progress'
    || normalized === 'inprogress'
    || normalized === 'processing'
    || statusValue === '진행중'
  ) {
    return 'in_progress';
  }
  return 'open';
}

function isLegacyActionStatusValidationError(error: ApiError): boolean {
  return (
    error.status === 400
    && typeof error.message === 'string'
    && error.message.includes('open|in_progress|done')
  );
}

function requestStatusPatch(
  path: string,
  status: string,
  memo: string | null | undefined,
  signal?: AbortSignal,
): Promise<unknown> {
  const body: Record<string, unknown> = { status };
  if (memo !== undefined) {
    body.memo = memo;
  }

  return apiClient.requestData<unknown>({
    path,
    method: 'PATCH',
    body,
    signal,
  });
}

function requestMemoPatch(path: string, method: 'PATCH' | 'POST', memo: string, signal?: AbortSignal): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path,
    method,
    body: { memo },
    signal,
  });
}

export async function patchActionRequiredStatus(
  actionId: string,
  options: ActionRequiredStatusPatchOptions,
): Promise<unknown> {
  const encodedActionId = encodeURIComponent(actionId);
  const primaryPath = `/api/v2/action-required/${encodedActionId}/status`;

  try {
    return await requestStatusPatch(primaryPath, options.status, options.memo, options.signal);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      throw error;
    }

    const legacyPath = `/api/v2/action-items/${encodedActionId}/status`;
    if (error.status === 404 || error.status === 405 || isLegacyActionStatusValidationError(error)) {
      return requestStatusPatch(
        legacyPath,
        toLegacyActionItemStatus(options.status),
        options.memo,
        options.signal,
      );
    }

    throw error;
  }
}

export async function patchActionRequiredMemo(
  actionId: string,
  options: ActionRequiredMemoPatchOptions,
): Promise<unknown> {
  const encodedActionId = encodeURIComponent(actionId);
  const primaryPath = `/api/v2/action-required/${encodedActionId}/memo`;

  try {
    return await requestMemoPatch(primaryPath, 'PATCH', options.memo, options.signal);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      throw error;
    }

    if (error.status === 404 || error.status === 405) {
      return requestMemoPatch(`/api/v2/action-items/${encodedActionId}/memos`, 'POST', options.memo, options.signal);
    }

    throw error;
  }
}
